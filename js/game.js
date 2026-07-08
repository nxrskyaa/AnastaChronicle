import * as THREE from "three";
import { ITEMS, RECIPES, canCraft, doCraft, xpFor, applyLevel } from "./crafting.js";

const WORLD = 80; // units
const MAP_N = 80; // heightmap resolution

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePixelTex(draw, size = 32) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.paused = false;
    this.t = 0;
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this.projectiles = [];
    this.drops = [];
    this.dmgCd = 0;

    this.rng = mulberry32(0x414e4153);
    this._initThree();
    this._buildWorld();
    this._initPlayer();
    this._spawnSlimes(26);
    this._bind();
    this.ui.sync();
  }

  _initThree() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x87a0b4, 1);

    // low-res pixel look via CSS + renderer size? use full res but nearest textures
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x9eb6a8, 0.028);

    // 2.5D: orthographic-ish perspective from above
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200);
    this.camera.position.set(0, 28, 22);
    this.camera.lookAt(0, 0, 0);

    // lights
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a30, 1.05);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.35);
    this.sun.position.set(18, 30, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -40;
    this.sun.shadow.camera.right = 40;
    this.sun.shadow.camera.top = 40;
    this.sun.shadow.camera.bottom = -40;
    this.scene.add(this.sun);

    this.ambTorch = new THREE.Group();
    this.scene.add(this.ambTorch);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();
    this.moveTarget = null;

    // cursor ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 24),
      new THREE.MeshBasicMaterial({ color: 0x5ad8a8, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    this.cursor = ring;
    this.scene.add(ring);

    // attack slash helper
    this.slash = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.08, 6, 18, Math.PI * 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0 })
    );
    this.slash.rotation.x = Math.PI / 2;
    this.scene.add(this.slash);

    window.addEventListener("resize", () => this._onResize());
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _texGrass() {
    return makePixelTex((g, s) => {
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          const v = ((x * 13 + y * 7) % 5) / 5;
          g.fillStyle = v < 0.4 ? "#4a8c48" : v < 0.75 ? "#3f7a3e" : "#56a050";
          g.fillRect(x, y, 1, 1);
        }
    }, 32);
  }

  _texPath() {
    return makePixelTex((g, s) => {
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          g.fillStyle = ((x + y) % 3) ? "#b89660" : "#9a7a48";
          g.fillRect(x, y, 1, 1);
        }
    }, 16);
  }

  _texWater() {
    return makePixelTex((g, s) => {
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          const v = (x + y) % 6;
          g.fillStyle = v < 2 ? "#2f6fb0" : v < 4 ? "#3d86c8" : "#245a96";
          g.fillRect(x, y, 1, 1);
        }
    }, 16);
  }

  _buildWorld() {
    this.map = new Uint8Array(MAP_N * MAP_N); // 0 grass 1 path 2 dirt 3 water
    const rng = this.rng;

    for (let i = 0; i < this.map.length; i++) this.map[i] = 0;

    // path
    let px = 8;
    let pz = MAP_N >> 1;
    this.spawn = {
      x: (px / MAP_N - 0.5) * WORLD + 1,
      z: (pz / MAP_N - 0.5) * WORLD,
    };
    for (let s = 0; s < 240; s++) {
      for (let oz = -1; oz <= 1; oz++)
        for (let ox = -1; ox <= 1; ox++) {
          const x = px + ox;
          const z = pz + oz;
          if (x < 0 || z < 0 || x >= MAP_N || z >= MAP_N) continue;
          this.map[z * MAP_N + x] = ox === 0 && oz === 0 ? 1 : 2;
        }
      const r = rng();
      if (r < 0.58) px++;
      else if (r < 0.75) pz++;
      else if (r < 0.92) pz--;
      else px++;
      px = Math.max(2, Math.min(MAP_N - 3, px));
      pz = Math.max(2, Math.min(MAP_N - 3, pz));
    }

    // camp pad
    for (let z = (MAP_N >> 1) - 3; z <= (MAP_N >> 1) + 3; z++)
      for (let x = 6; x <= 14; x++) this.map[z * MAP_N + x] = 1;

    // ponds
    for (let n = 0; n < 8; n++) {
      const cx = 8 + Math.floor(rng() * (MAP_N - 16));
      const cz = 8 + Math.floor(rng() * (MAP_N - 16));
      const rr = 3 + Math.floor(rng() * 4);
      for (let z = cz - rr; z <= cz + rr; z++)
        for (let x = cx - rr; x <= cx + rr; x++) {
          if (x < 1 || z < 1 || x >= MAP_N - 1 || z >= MAP_N - 1) continue;
          if ((x - cx) ** 2 + (z - cz) ** 2 <= rr * rr && this.map[z * MAP_N + x] !== 1)
            this.map[z * MAP_N + x] = 3;
        }
    }

    // ground mesh from map colors (vertex color plane subdivisions)
    const seg = MAP_N;
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const col = new Float32Array((seg + 1) * (seg + 1) * 3);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const mx = Math.min(MAP_N - 1, Math.max(0, Math.floor(((x / WORLD) + 0.5) * MAP_N)));
      const mz = Math.min(MAP_N - 1, Math.max(0, Math.floor(((z / WORLD) + 0.5) * MAP_N)));
      const t = this.map[mz * MAP_N + mx];
      let r, g, b;
      if (t === 1) { r = 0.72; g = 0.58; b = 0.36; }
      else if (t === 2) { r = 0.48; g = 0.38; b = 0.24; }
      else if (t === 3) { r = 0.22; g = 0.45; b = 0.72; }
      else {
        const n = ((mx * 13 + mz * 7) % 5) / 5;
        r = 0.28 + n * 0.08; g = 0.52 + n * 0.1; b = 0.26;
      }
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      // slight height
      if (t === 0) pos.setY(i, (Math.sin(mx * 0.4) + Math.cos(mz * 0.35)) * 0.08);
      else if (t === 3) pos.setY(i, -0.12);
      else pos.setY(i, 0.02);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.02,
        flatShading: true,
      })
    );
    ground.receiveShadow = true;
    this.ground = ground;
    this.scene.add(ground);

    // water plane overlays with animated material
    this.waters = [];
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3a8fd0,
      transparent: true,
      opacity: 0.72,
      roughness: 0.2,
      metalness: 0.3,
      flatShading: true,
    });
    this.waterMat = waterMat;
    // simple full water patches as discs where map water
    for (let z = 0; z < MAP_N; z++)
      for (let x = 0; x < MAP_N; x++) {
        if (this.map[z * MAP_N + x] !== 3) continue;
        // only place one mesh per connected seed roughly: sample every few
        if ((x + z) % 3) continue;
        const wx = (x / MAP_N - 0.5) * WORLD;
        const wz = (z / MAP_N - 0.5) * WORLD;
        const m = new THREE.Mesh(new THREE.CircleGeometry(1.15, 10), waterMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(wx, 0.02, wz);
        this.scene.add(m);
        this.waters.push(m);
      }

    // trees
    this.trees = [];
    this.rocks = [];
    this.chests = [];
    this.torches = [];
    const treeGeoTrunk = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 6);
    const treeGeoLeaf = new THREE.ConeGeometry(1.05, 2.1, 7);
    const bark = new THREE.MeshStandardMaterial({ color: 0x5a3c28, flatShading: true, roughness: 1 });
    const leafs = [
      new THREE.MeshStandardMaterial({ color: 0x2f7a42, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x3d8f50, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x256638, flatShading: true }),
    ];

    for (let z = 2; z < MAP_N - 2; z++) {
      for (let x = 2; x < MAP_N - 2; x++) {
        const t = this.map[z * MAP_N + x];
        if (t === 1 || t === 3) continue;
        const r = rng();
        const wx = (x / MAP_N - 0.5) * WORLD + (rng() - 0.5) * 0.4;
        const wz = (z / MAP_N - 0.5) * WORLD + (rng() - 0.5) * 0.4;
        if (r < 0.085) {
          const g = new THREE.Group();
          const trunk = new THREE.Mesh(treeGeoTrunk, bark);
          trunk.position.y = 0.7;
          trunk.castShadow = true;
          const leaf = new THREE.Mesh(treeGeoLeaf, leafs[Math.floor(rng() * 3)]);
          leaf.position.y = 2.1;
          leaf.castShadow = true;
          leaf.receiveShadow = true;
          g.add(trunk, leaf);
          g.position.set(wx, 0, wz);
          const s = 0.85 + rng() * 0.5;
          g.scale.setScalar(s);
          this.scene.add(g);
          this.trees.push({ mesh: g, x: wx, z: wz, hp: 3, r: 0.55 * s });
        } else if (r < 0.1) {
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.35 + rng() * 0.2, 0),
            new THREE.MeshStandardMaterial({ color: 0x6a7078, flatShading: true, roughness: 1 })
          );
          rock.position.set(wx, 0.25, wz);
          rock.castShadow = true;
          rock.receiveShadow = true;
          this.scene.add(rock);
          this.rocks.push({ mesh: rock, x: wx, z: wz, hp: 2, r: 0.45 });
        }
      }
    }

    // path torches
    for (let z = 0; z < MAP_N; z++)
      for (let x = 0; x < MAP_N; x++) {
        if (this.map[z * MAP_N + x] !== 1 || rng() > 0.035) continue;
        const wx = (x / MAP_N - 0.5) * WORLD;
        const wz = (z / MAP_N - 0.5) * WORLD;
        const g = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 1.1, 5),
          new THREE.MeshStandardMaterial({ color: 0x4a3424, flatShading: true })
        );
        pole.position.y = 0.55;
        const flame = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffa040 })
        );
        flame.position.y = 1.2;
        const light = new THREE.PointLight(0xff9a40, 1.2, 8, 2);
        light.position.y = 1.25;
        g.add(pole, flame, light);
        g.position.set(wx, 0, wz);
        this.scene.add(g);
        this.torches.push({ mesh: g, flame, light });
      }

    // chests
    for (let i = 0; i < 7; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const x = 4 + Math.floor(rng() * (MAP_N - 8));
        const z = 4 + Math.floor(rng() * (MAP_N - 8));
        if (this.map[z * MAP_N + x] !== 0) continue;
        const wx = (x / MAP_N - 0.5) * WORLD;
        const wz = (z / MAP_N - 0.5) * WORLD;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.45, 0.5),
          new THREE.MeshStandardMaterial({ color: 0x8a6238, flatShading: true })
        );
        box.position.set(wx, 0.22, wz);
        box.castShadow = true;
        const lid = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 0.12, 0.52),
          new THREE.MeshStandardMaterial({ color: 0xa87840, flatShading: true })
        );
        lid.position.set(wx, 0.48, wz);
        this.scene.add(box, lid);
        this.chests.push({ box, lid, x: wx, z: wz, open: false });
        break;
      }
    }

    // campfire at spawn
    const camp = new THREE.Group();
    const logs = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 0.25, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a3424, flatShading: true })
    );
    logs.position.y = 0.1;
    const fire = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.7, 6),
      new THREE.MeshBasicMaterial({ color: 0xff7030 })
    );
    fire.position.y = 0.55;
    const cl = new THREE.PointLight(0xff8020, 2.2, 14, 2);
    cl.position.y = 1;
    camp.add(logs, fire, cl);
    camp.position.set(this.spawn.x, 0, this.spawn.z);
    this.scene.add(camp);
    this.campFire = fire;
  }

  _initPlayer() {
    const g = new THREE.Group();
    // body
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.55, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xc44048, flatShading: true })
    );
    body.position.y = 0.75;
    body.castShadow = true;
    // head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8bc94, flatShading: true })
    );
    head.position.y = 1.35;
    head.castShadow = true;
    // hair
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.7),
      new THREE.MeshStandardMaterial({ color: 0x2a2228, flatShading: true })
    );
    hair.position.y = 1.42;
    // weapon
    const weapon = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.95),
      new THREE.MeshStandardMaterial({ color: 0xc0c8d4, metalness: 0.6, roughness: 0.35, flatShading: true })
    );
    weapon.position.set(0.38, 0.85, 0.15);
    weapon.castShadow = true;

    g.add(body, head, hair, weapon);
    g.position.set(this.spawn.x, 0, this.spawn.z);
    this.scene.add(g);

    this.playerMesh = g;
    this.playerWeapon = weapon;
    this.player = {
      x: this.spawn.x,
      z: this.spawn.z,
      y: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      speed: 7.2,
      level: 1,
      xp: 0,
      hp: 50,
      maxHp: 50,
      stamina: 100,
      maxStamina: 100,
      baseDmg: 2,
      inv: { wood: 4, gel: 2, ore: 2, herb: 2, dagger: 1 },
      gold: 5,
      equipped: "dagger",
      attackT: 0,
      attackCd: 0,
      shield: false,
      evadeT: 0,
      evadeCd: 0,
      invuln: 0,
      dead: false,
      skillCd: [0, 0, 0, 0],
    };
    applyLevel(this.player);
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
  }

  _makeSlime(x, z, tier = 1) {
    const col = tier > 1 ? 0x40e0a0 : 0x50d890;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.45 * (tier > 1 ? 1.25 : 1), 10, 8),
      new THREE.MeshStandardMaterial({
        color: col,
        flatShading: true,
        roughness: 0.45,
        metalness: 0.05,
        emissive: col,
        emissiveIntensity: 0.08,
      })
    );
    mesh.scale.y = 0.75;
    mesh.position.set(x, 0.35 * (tier > 1 ? 1.2 : 1), z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // HP bar sprite
    const bar = this._makeHpBar();
    bar.position.set(0, 0.9, 0);
    mesh.add(bar);

    return {
      mesh,
      bar,
      barFill: bar.userData.fill,
      x,
      z,
      hp: 20 * tier,
      maxHp: 20 * tier,
      dmg: 5 * tier,
      speed: 2.4 + tier * 0.5,
      tier,
      xp: 14 * tier,
      atkCd: 0,
      hurtT: 0,
      dead: false,
      aggro: 11 + tier * 2,
      bob: Math.random() * Math.PI * 2,
    };
  }

  _makeHpBar() {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x1a1010, depthTest: false })
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xe05050, depthTest: false })
    );
    fill.position.z = 0.01;
    g.add(bg, fill);
    g.userData.fill = fill;
    return g;
  }

  _spawnSlimes(n) {
    this.enemies = [];
    const rng = this.rng;
    for (let i = 0; i < n; i++) {
      let x, z, ok = false;
      for (let t = 0; t < 40 && !ok; t++) {
        x = (rng() - 0.5) * (WORLD - 8);
        z = (rng() - 0.5) * (WORLD - 8);
        if (!this.blocked(x, z, 0.5) && Math.hypot(x - this.spawn.x, z - this.spawn.z) > 10) ok = true;
      }
      if (!ok) continue;
      this.enemies.push(this._makeSlime(x, z, rng() < 0.18 ? 2 : 1));
    }
  }

  tileAt(x, z) {
    const mx = Math.floor(((x / WORLD) + 0.5) * MAP_N);
    const mz = Math.floor(((z / WORLD) + 0.5) * MAP_N);
    if (mx < 0 || mz < 0 || mx >= MAP_N || mz >= MAP_N) return 3;
    return this.map[mz * MAP_N + mx];
  }

  blocked(x, z, r = 0.4) {
    if (this.tileAt(x, z) === 3) return true;
    if (this.tileAt(x + r, z) === 3 || this.tileAt(x - r, z) === 3) return true;
    if (this.tileAt(x, z + r) === 3 || this.tileAt(x, z - r) === 3) return true;
    for (const tr of this.trees || []) {
      if (tr.hp <= 0) continue;
      if (Math.hypot(x - tr.x, z - tr.z) < tr.r + r * 0.5) return true;
    }
    for (const rk of this.rocks || []) {
      if (rk.hp <= 0) continue;
      if (Math.hypot(x - rk.x, z - rk.z) < rk.r + r * 0.4) return true;
    }
    return false;
  }

  _bind() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (e.code === "KeyI") this.ui.toggle("inv");
      if (e.code === "KeyC") this.ui.toggle("craft");
      if (e.code === "Escape") this.ui.closeAll();
      if (e.code === "Digit1") this.useSkill(0);
      if (e.code === "Digit2") this.useSkill(1);
      if (e.code === "Digit3") this.useSkill(2);
      if (e.code === "Digit4") this.useSkill(3);
      if (e.code === "KeyF") this.interact();
    });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });

    const c = this.canvas;
    c.addEventListener("mousemove", (e) => this._mouse(e));
    c.addEventListener("mousedown", (e) => {
      this._mouse(e);
      if (e.button === 0) {
        this.mouse.down = true;
        // click-to-move if not near enemy, else attack
        const p = this.player;
        let nearEnemy = false;
        for (const en of this.enemies) {
          if (en.dead) continue;
          if (Math.hypot(en.x - this._hit.x, en.z - this._hit.z) < 1.2) {
            nearEnemy = true;
            break;
          }
        }
        if (nearEnemy || e.shiftKey) this.tryAttack();
        else {
          this.moveTarget = this._hit.clone();
          this.moveTarget.y = 0;
        }
      }
    });
    c.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _mouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, this._hit);
  }

  start() {
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.033, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused && !this.player.dead) this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  weapon() {
    return ITEMS[this.player.equipped] || ITEMS.dagger;
  }

  update(dt) {
    this.t += dt;
    const p = this.player;
    p.attackT = Math.max(0, p.attackT - dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.evadeT = Math.max(0, p.evadeT - dt);
    p.evadeCd = Math.max(0, p.evadeCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    for (let i = 0; i < 4; i++) p.skillCd[i] = Math.max(0, p.skillCd[i] - dt);

    // torch / fire anim
    for (const to of this.torches) {
      const s = 0.9 + Math.sin(this.t * 10 + to.mesh.position.x) * 0.15;
      to.flame.scale.setScalar(s);
      to.light.intensity = 1.0 + Math.sin(this.t * 12 + to.mesh.position.z) * 0.35;
    }
    if (this.campFire) {
      this.campFire.scale.y = 0.9 + Math.sin(this.t * 14) * 0.15;
      this.campFire.rotation.y += dt * 2;
    }
    if (this.waterMat) this.waterMat.opacity = 0.65 + Math.sin(this.t * 2) * 0.08;

    p.shield = !!(this.keys.ShiftLeft || this.keys.ShiftRight);
    if (p.shield) {
      p.stamina = Math.max(0, p.stamina - 16 * dt);
      if (p.stamina <= 0) p.shield = false;
    } else p.stamina = Math.min(p.maxStamina, p.stamina + 20 * dt);

    // evade toward cursor
    if ((this.keys.Space || this.keys.KeyE) && p.evadeCd <= 0 && p.stamina >= 18) {
      p.evadeT = 0.2;
      p.evadeCd = 0.85;
      p.stamina -= 18;
      p.invuln = 0.2;
      const ang = Math.atan2(this._hit.x - p.x, this._hit.z - p.z);
      // in XZ: yaw from atan2(dx,dz)
      p.vx = Math.sin(ang) * 18;
      p.vz = Math.cos(ang) * 18;
      this.moveTarget = null;
    }

    // WASD
    let mx = 0, mz = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) mz -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) mz += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
    if (mx || mz) {
      this.moveTarget = null;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len; mz /= len;
      // camera-relative: camera looks from +z-ish; simplify world axes
      const slow = p.shield ? 0.55 : 1;
      if (p.evadeT <= 0) {
        p.vx = mx * p.speed * slow;
        p.vz = mz * p.speed * slow;
      }
      p.yaw = Math.atan2(mx, mz);
    } else if (this.moveTarget && p.evadeT <= 0) {
      const dx = this.moveTarget.x - p.x;
      const dz = this.moveTarget.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.25) {
        this.moveTarget = null;
        p.vx = p.vz = 0;
      } else {
        const slow = p.shield ? 0.55 : 1;
        p.vx = (dx / d) * p.speed * slow;
        p.vz = (dz / d) * p.speed * slow;
        p.yaw = Math.atan2(dx, dz);
      }
    } else if (p.evadeT <= 0) {
      p.vx *= 0.85;
      p.vz *= 0.85;
      if (Math.hypot(p.vx, p.vz) < 0.2) p.vx = p.vz = 0;
    }

    this._move(p, p.vx * dt, p.vz * dt, 0.35);
    this.playerMesh.position.set(p.x, 0, p.z);
    this.playerMesh.rotation.y = p.yaw;
    // bob
    const moving = Math.hypot(p.vx, p.vz) > 0.5;
    this.playerMesh.position.y = moving ? Math.abs(Math.sin(this.t * 12)) * 0.06 : 0;
    if (p.attackT > 0) {
      this.playerWeapon.rotation.x = -Math.sin((1 - p.attackT / 0.18) * Math.PI) * 1.2;
    } else this.playerWeapon.rotation.x = 0;

    // face cursor for combat
    const faceAng = Math.atan2(this._hit.x - p.x, this._hit.z - p.z);
    if (p.attackT > 0 || this.mouse.down) p.yaw = faceAng;

    if (this.mouse.down && p.attackCd <= 0) this.tryAttack();

    // cursor
    this.cursor.position.set(this._hit.x, 0.06, this._hit.z);
    this.cursor.rotation.z = this.t * 1.5;

    // interact prompt
    let nearChest = false;
    for (const c of this.chests) {
      if (!c.open && Math.hypot(c.x - p.x, c.z - p.z) < 1.6) nearChest = true;
    }
    this.ui.setInteract(nearChest);

    this._updateEnemies(dt);
    this._updateProjectiles(dt);
    this._updateDrops(dt);

    // camera follow
    const camTarget = new THREE.Vector3(p.x, 0, p.z);
    const camPos = new THREE.Vector3(p.x + 0.2, 26, p.z + 20);
    this.camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(camTarget.x, 0.5, camTarget.z);
    this.sun.position.set(p.x + 18, 30, p.z + 10);
    this.sun.target.position.copy(camTarget);
    this.sun.target.updateMatrixWorld();

    // slash fade
    if (this.slash.material.opacity > 0) {
      this.slash.material.opacity = Math.max(0, this.slash.material.opacity - dt * 3);
    }

    this.ui.sync();
    this._drawMinimap();
  }

  _move(ent, dx, dz, r) {
    const nx = ent.x + dx;
    if (!this.blocked(nx, ent.z, r)) ent.x = nx;
    const nz = ent.z + dz;
    if (!this.blocked(ent.x, nz, r)) ent.z = nz;
    const half = WORLD / 2 - 1;
    ent.x = Math.max(-half, Math.min(half, ent.x));
    ent.z = Math.max(-half, Math.min(half, ent.z));
  }

  tryAttack() {
    const p = this.player;
    if (p.attackCd > 0 || p.dead) return;
    const w = this.weapon();
    if (p.stamina < w.cost * 0.4) {
      this.ui.toast("Not enough stamina");
      return;
    }
    p.stamina = Math.max(0, p.stamina - w.cost);
    p.attackT = 0.18;
    p.attackCd = w.speed;
    p.yaw = Math.atan2(this._hit.x - p.x, this._hit.z - p.z);

    // slash FX
    this.slash.position.set(p.x + Math.sin(p.yaw) * 1.1, 0.8, p.z + Math.cos(p.yaw) * 1.1);
    this.slash.rotation.z = -p.yaw;
    this.slash.material.opacity = 0.9;

    const dmg = w.dmg + p.baseDmg;

    if (w.ranged) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe080 })
      );
      mesh.position.set(p.x, 1, p.z);
      this.scene.add(mesh);
      this.projectiles.push({
        mesh,
        x: p.x,
        z: p.z,
        vx: Math.sin(p.yaw) * 18,
        vz: Math.cos(p.yaw) * 18,
        life: 1.1,
        dmg,
      });
      return;
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > w.range + 0.4) continue;
      const a = Math.atan2(dx, dz);
      let da = Math.abs(a - p.yaw);
      while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
      if (da < 1.05) this.damageEnemy(e, dmg);
    }

    // harvest
    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      if (Math.hypot(tr.x - p.x, tr.z - p.z) < w.range + 0.6) {
        tr.hp--;
        this.floatDmg(tr.x, 1.5, tr.z, "-1");
        if (tr.hp <= 0) {
          this.scene.remove(tr.mesh);
          this.addItem("wood", 2 + Math.floor(Math.random() * 3));
          this.ui.toast("+ Timber");
        }
      }
    }
    for (const rk of this.rocks) {
      if (rk.hp <= 0) continue;
      if (Math.hypot(rk.x - p.x, rk.z - p.z) < w.range + 0.4) {
        rk.hp--;
        if (rk.hp <= 0) {
          this.scene.remove(rk.mesh);
          this.addItem("ore", 1 + Math.floor(Math.random() * 2));
          this.ui.toast("+ Iron Ore");
        }
      }
    }
  }

  interact() {
    const p = this.player;
    for (const c of this.chests) {
      if (c.open) continue;
      if (Math.hypot(c.x - p.x, c.z - p.z) < 1.7) {
        c.open = true;
        c.lid.rotation.x = -1.1;
        c.lid.material.color.setHex(0xd4a050);
        const loot = [
          ["gel", 2],
          ["ore", 2],
          ["wood", 4],
          ["herb", 2],
          ["gold", 20],
        ];
        const L = loot[Math.floor(Math.random() * loot.length)];
        if (L[0] === "gold") {
          p.gold += L[1];
          this.ui.toast(`+${L[1]} gold`);
        } else {
          this.addItem(L[0], L[1]);
          this.ui.toast(`Chest: +${L[1]} ${ITEMS[L[0]].name}`);
        }
        return;
      }
    }
    // forage
    this.addItem("herb", 1);
    this.ui.toast("+ Wild Herb");
  }

  useSkill(i) {
    const p = this.player;
    if (p.skillCd[i] > 0 || p.dead) return;
    if (i === 0) {
      p.skillCd[0] = 4;
      const w = this.weapon();
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) < w.range + 1.2)
          this.damageEnemy(e, Math.floor((w.dmg + p.baseDmg) * 1.85), true);
      }
      this.slash.material.opacity = 1;
      this.slash.scale.setScalar(1.4);
      this.ui.toast("Power Strike!");
      setTimeout(() => this.slash.scale.setScalar(1), 200);
    } else if (i === 1) {
      if ((p.inv.herb || 0) < 1) return this.ui.toast("Need Wild Herb");
      p.inv.herb--;
      p.skillCd[1] = 6;
      const heal = 18 + p.level * 2;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.floatDmg(p.x, 1.6, p.z, `+${heal}`, false, true);
      this.ui.toast("Herbal Remedy");
    } else if (i === 2) {
      p.skillCd[2] = 7;
      p.stamina = Math.max(0, p.stamina - 14);
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) < 3.2)
          this.damageEnemy(e, 9 + p.baseDmg + Math.floor(this.weapon().dmg * 0.45));
      }
      this.ui.toast("Whirlwind!");
    } else if (i === 3) {
      p.skillCd[3] = 5;
      p.stamina = Math.min(p.maxStamina, p.stamina + 32);
      p.invuln = 0.18;
      this.ui.toast("Second Wind");
    }
    this.ui.sync();
  }

  damageEnemy(e, dmg, forceCrit = false) {
    if (e.dead) return;
    let crit = forceCrit;
    if (!crit && Math.random() < 0.12) {
      dmg = Math.floor(dmg * 1.55);
      crit = true;
    }
    e.hp -= dmg;
    e.hurtT = 0.18;
    e.mesh.material.emissiveIntensity = 0.55;
    this.floatDmg(e.x, 1.1, e.z, String(dmg), crit);
    // knockback
    const p = this.player;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    e.x += (dx / d) * 0.45;
    e.z += (dz / d) * 0.45;
    e.mesh.position.x = e.x;
    e.mesh.position.z = e.z;

    const ratio = Math.max(0, e.hp / e.maxHp);
    e.barFill.scale.x = Math.max(0.01, ratio);
    e.barFill.position.x = -0.43 * (1 - ratio);

    if (e.hp <= 0) {
      e.dead = true;
      this.grantXp(e.xp);
      p.gold += 1 + Math.floor(Math.random() * 4);
      this.drop(e.x, e.z, "gel", 1 + Math.floor(Math.random() * 2));
      if (Math.random() < 0.28) this.drop(e.x, e.z, "herb", 1);
      if (Math.random() < 0.16) this.drop(e.x, e.z, "ore", 1);
      // death pop
      e.mesh.scale.setScalar(0.01);
      setTimeout(() => {
        this.scene.remove(e.mesh);
        // respawn
        const rng = Math.random;
        let x, z;
        for (let t = 0; t < 30; t++) {
          x = (rng() - 0.5) * (WORLD - 8);
          z = (rng() - 0.5) * (WORLD - 8);
          if (!this.blocked(x, z, 0.5) && Math.hypot(x - this.player.x, z - this.player.z) > 14) break;
        }
        const idx = this.enemies.indexOf(e);
        if (idx >= 0) this.enemies[idx] = this._makeSlime(x, z, Math.random() < 0.18 ? 2 : 1);
      }, 400);
    }
  }

  grantXp(amount) {
    const p = this.player;
    p.xp += amount;
    let up = false;
    while (p.xp >= xpFor(p.level)) {
      p.xp -= xpFor(p.level);
      p.level++;
      applyLevel(p);
      p.hp = p.maxHp;
      p.stamina = p.maxStamina;
      up = true;
    }
    if (up) {
      this.ui.showLevel(p.level);
      this.ui.toast(`Level ${p.level}!`);
    }
  }

  addItem(id, n) {
    this.player.inv[id] = (this.player.inv[id] || 0) + n;
  }

  drop(x, z, id, n) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({
        color: id === "gel" ? 0x60f0b0 : id === "ore" ? 0x8090a8 : id === "herb" ? 0x50c060 : 0xb08040,
        flatShading: true,
        emissive: 0x224422,
        emissiveIntensity: 0.2,
      })
    );
    mesh.position.set(x, 0.35, z);
    this.scene.add(mesh);
    this.drops.push({ mesh, x, z, id, n, t: 0 });
  }

  _updateDrops(dt) {
    const p = this.player;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      d.mesh.position.y = 0.35 + Math.sin(this.t * 5 + d.x) * 0.08;
      d.mesh.rotation.y += dt * 2;
      if (Math.hypot(d.x - p.x, d.z - p.z) < 1.1) {
        this.addItem(d.id, d.n);
        this.ui.toast(`+${d.n} ${ITEMS[d.id].name}`);
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
      } else if (d.t > 40) {
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
      }
    }
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.z += pr.vz * dt;
      pr.life -= dt;
      pr.mesh.position.set(pr.x, 1, pr.z);
      if (pr.life <= 0 || this.tileAt(pr.x, pr.z) === 3) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - pr.x, e.z - pr.z) < 0.7) {
          this.damageEnemy(e, pr.dmg);
          this.scene.remove(pr.mesh);
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  _updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.bob += dt * 4;
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.atkCd = Math.max(0, e.atkCd - dt);
      if (e.hurtT <= 0) e.mesh.material.emissiveIntensity = 0.08;

      e.mesh.scale.y = 0.7 + Math.sin(e.bob) * 0.08;
      e.mesh.position.y = 0.32 + Math.abs(Math.sin(e.bob)) * 0.06;
      // billboard HP bar
      e.bar.quaternion.copy(this.camera.quaternion);

      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist < e.aggro && dist > 0.9) {
        const sp = e.speed * dt;
        const nx = e.x + (dx / dist) * sp;
        const nz = e.z + (dz / dist) * sp;
        if (!this.blocked(nx, e.z, 0.35)) e.x = nx;
        if (!this.blocked(e.x, nz, 0.35)) e.z = nz;
        e.mesh.position.x = e.x;
        e.mesh.position.z = e.z;
      }
      if (dist < 1.05 && e.atkCd <= 0 && p.evadeT <= 0) {
        e.atkCd = 1.05;
        let dmg = e.dmg;
        if (p.shield) {
          dmg = Math.floor(dmg * 0.28);
          p.stamina = Math.max(0, p.stamina - 10);
          this.floatDmg(p.x, 1.5, p.z, "block");
        }
        if (p.invuln <= 0) {
          p.hp -= dmg;
          p.invuln = 0.35;
          this.floatDmg(p.x, 1.4, p.z, String(dmg));
          if (p.hp <= 0) {
            p.hp = 0;
            p.dead = true;
            this.ui.showDeath();
          }
        }
      }
    }
  }

  floatDmg(x, y, z, text, crit = false, heal = false) {
    // project to screen
    const v = new THREE.Vector3(x, y, z);
    v.project(this.camera);
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.ui.dmg(sx, sy, text, crit, heal);
  }

  craft(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) return;
    if (doCraft(this.player.inv, r)) {
      this.ui.toast(`Crafted ${ITEMS[r.result].name}`);
      if (ITEMS[r.result].weapon) this.player.equipped = r.result;
      this.ui.renderCraft();
      this.ui.renderInv();
      this.ui.sync();
    } else this.ui.toast("Missing materials");
  }

  equip(id) {
    if (!ITEMS[id]?.weapon || (this.player.inv[id] || 0) < 1) return;
    this.player.equipped = id;
    this.ui.toast(`Equipped ${ITEMS[id].name}`);
    this.ui.renderInv();
    this.ui.sync();
  }

  respawn() {
    const p = this.player;
    p.dead = false;
    p.x = this.spawn.x;
    p.z = this.spawn.z;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.invuln = 1.5;
    this.playerMesh.position.set(p.x, 0, p.z);
    this.ui.hideDeath();
    this.ui.toast("Returned to camp");
  }

  _drawMinimap() {
    const mm = document.getElementById("minimap");
    if (!mm) return;
    const m = mm.getContext("2d");
    const W = mm.width;
    const H = mm.height;
    m.clearRect(0, 0, W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const mx = Math.floor((x / W) * MAP_N);
        const mz = Math.floor((y / H) * MAP_N);
        const t = this.map[mz * MAP_N + mx];
        m.fillStyle = t === 3 ? "#3a80c0" : t === 1 ? "#c0a060" : t === 2 ? "#7a6038" : "#3f8048";
        m.fillRect(x, y, 1, 1);
      }
    }
    // trees dots
    m.fillStyle = "#1e5030";
    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      const x = ((tr.x / WORLD) + 0.5) * W;
      const y = ((tr.z / WORLD) + 0.5) * H;
      m.fillRect(x, y, 1, 1);
    }
    m.fillStyle = "#60f0b0";
    for (const e of this.enemies) {
      if (e.dead) continue;
      const x = ((e.x / WORLD) + 0.5) * W;
      const y = ((e.z / WORLD) + 0.5) * H;
      m.fillRect(x - 1, y - 1, 2, 2);
    }
    const px = ((this.player.x / WORLD) + 0.5) * W;
    const py = ((this.player.z / WORLD) + 0.5) * H;
    m.fillStyle = "#fff";
    m.fillRect(px - 2, py - 2, 4, 4);
    m.fillStyle = "#f0c84a";
    m.fillRect(px - 1, py - 1, 2, 2);
  }

  render() {
    // invuln blink
    this.playerMesh.visible = !(this.player.invuln > 0 && Math.floor(this.t * 18) % 2 === 0);
    // shield aura
    if (this.player.shield) {
      if (!this._shieldMesh) {
        this._shieldMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.85, 12, 10),
          new THREE.MeshBasicMaterial({ color: 0x80c0ff, transparent: true, opacity: 0.18, wireframe: true })
        );
        this.playerMesh.add(this._shieldMesh);
      }
      this._shieldMesh.visible = true;
    } else if (this._shieldMesh) this._shieldMesh.visible = false;

    this.renderer.render(this.scene, this.camera);
  }
}
