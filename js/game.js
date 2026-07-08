import * as THREE from "../vendor/three.module.js";
import { ITEMS, RECIPES, canCraft, doCraft, xpFor, applyLevel } from "./crafting.js";
import {
  createPalette,
  createPlayerMesh,
  createPineTree,
  createSlimeMesh,
  createTorchMesh,
  createRockMesh,
  createChestMesh,
  createCampfire,
  createHpBar,
  makeGroundTexture,
} from "./meshes.js";

const WORLD = 90;
const MAP_N = 90;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    this.stick = { x: 0, y: 0, active: false };

    this.rng = mulberry32(0x414e4153);
    this._initThree();
    this.mat = createPalette(this.isMobile);
    this._buildWorld();
    this._initPlayer();
    this._clearPlayableSpace();
    this._spawnSlimes(24);
    this._bind();
    this._bindTouch();
    this.ui.sync();
  }

  _initThree() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isMobile = /Mobi|Android|iPhone|iPad|Telegram/i.test(navigator.userAgent) || w < 900;
    this.isMobile = isMobile;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: !isMobile,
        powerPreference: isMobile ? "low-power" : "high-performance",
        alpha: false,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (e) {
      throw new Error("WebGL unavailable: " + (e?.message || e));
    }
    this.renderer = renderer;
    if (!this.renderer.getContext()) throw new Error("WebGL context failed");

    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.35 : 1.75));
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // muted overcast sky like reference
    this.renderer.setClearColor(0x8a9a92, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8a9a92);
    this.scene.fog = new THREE.FogExp2(0x8f9f94, 0.016);

    // higher top-down camera (ref angle)
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 220);
    this.camera.position.set(0, 36, 12);
    this.camera.lookAt(0, 0, 0);

    // soft forest light
    const hemi = new THREE.HemisphereLight(0xd8e8e0, 0x3a4a38, 0.95);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xfff0d8, 1.15);
    this.sun.position.set(22, 36, 12);
    this.sun.castShadow = !isMobile;
    if (!isMobile) {
      this.sun.shadow.mapSize.set(1536, 1536);
      this.sun.shadow.camera.left = -45;
      this.sun.shadow.camera.right = 45;
      this.sun.shadow.camera.top = 45;
      this.sun.shadow.camera.bottom = -45;
      this.sun.shadow.bias = -0.0005;
    }
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // fill light cool
    const fill = new THREE.DirectionalLight(0xa8c8c0, 0.35);
    fill.position.set(-16, 18, -10);
    this.scene.add(fill);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();
    this.moveTarget = null;

    // soft green ground cursor (ref)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.58, 32),
      new THREE.MeshBasicMaterial({
        color: 0x6ad8a0,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    this.cursor = ring;
    this.scene.add(ring);

    const inner = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xb8ffe0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    inner.rotation.x = -Math.PI / 2;
    ring.add(inner);

    this.slash = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.07, 6, 24, Math.PI * 1.15),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0 })
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

  _buildWorld() {
    this.map = new Uint8Array(MAP_N * MAP_N);
    const rng = this.rng;
    for (let i = 0; i < this.map.length; i++) this.map[i] = 0;

    // winding dirt path
    let px = 10;
    let pz = MAP_N >> 1;
    this.spawn = {
      x: (px / MAP_N - 0.5) * WORLD + 1.5,
      z: (pz / MAP_N - 0.5) * WORLD,
    };
    for (let s = 0; s < 280; s++) {
      for (let oz = -2; oz <= 2; oz++)
        for (let ox = -2; ox <= 2; ox++) {
          const x = px + ox;
          const z = pz + oz;
          if (x < 0 || z < 0 || x >= MAP_N || z >= MAP_N) continue;
          const edge = Math.abs(ox) === 2 || Math.abs(oz) === 2;
          this.map[z * MAP_N + x] = edge ? 2 : 1;
        }
      const r = rng();
      if (r < 0.55) px++;
      else if (r < 0.72) pz++;
      else if (r < 0.89) pz--;
      else px++;
      px = Math.max(3, Math.min(MAP_N - 4, px));
      pz = Math.max(3, Math.min(MAP_N - 4, pz));
    }

    // camp clearing
    for (let z = (MAP_N >> 1) - 4; z <= (MAP_N >> 1) + 4; z++)
      for (let x = 7; x <= 16; x++) this.map[z * MAP_N + x] = 1;

    // ponds
    for (let n = 0; n < 7; n++) {
      const cx = 10 + Math.floor(rng() * (MAP_N - 20));
      const cz = 10 + Math.floor(rng() * (MAP_N - 20));
      const rr = 3 + Math.floor(rng() * 4);
      for (let z = cz - rr; z <= cz + rr; z++)
        for (let x = cx - rr; x <= cx + rr; x++) {
          if (x < 1 || z < 1 || x >= MAP_N - 1 || z >= MAP_N - 1) continue;
          const d = (x - cx) ** 2 + (z - cz) ** 2;
          if (d <= rr * rr && this.map[z * MAP_N + x] !== 1) this.map[z * MAP_N + x] = 3;
        }
    }

    // terrain mesh with soft multi-tone greens (ref style)
    const seg = this.isMobile ? 70 : MAP_N;
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const col = new Float32Array((seg + 1) * (seg + 1) * 3);
    const pos = geo.attributes.position;

    const grassA = [0.35, 0.48, 0.36];
    const grassB = [0.28, 0.42, 0.30];
    const grassC = [0.40, 0.52, 0.38];
    const moss = [0.32, 0.45, 0.34];
    const pathC = [0.62, 0.52, 0.36];
    const pathEdge = [0.48, 0.40, 0.28];
    const waterC = [0.30, 0.48, 0.55];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const mx = Math.min(MAP_N - 1, Math.max(0, Math.floor((x / WORLD + 0.5) * MAP_N)));
      const mz = Math.min(MAP_N - 1, Math.max(0, Math.floor((z / WORLD + 0.5) * MAP_N)));
      const t = this.map[mz * MAP_N + mx];
      const n =
        Math.sin(mx * 0.35 + mz * 0.21) * 0.5 +
        Math.cos(mx * 0.12 - mz * 0.28) * 0.5;
      let rgb;
      if (t === 1) rgb = pathC;
      else if (t === 2) rgb = pathEdge;
      else if (t === 3) rgb = waterC;
      else {
        const pick = (mx * 17 + mz * 31) % 4;
        rgb = pick === 0 ? grassA : pick === 1 ? grassB : pick === 2 ? grassC : moss;
      }
      // subtle variation
      const v = 0.92 + n * 0.08;
      col[i * 3] = rgb[0] * v;
      col[i * 3 + 1] = rgb[1] * v;
      col[i * 3 + 2] = rgb[2] * v;

      if (t === 0) pos.setY(i, (Math.sin(mx * 0.35) + Math.cos(mz * 0.3)) * 0.12 + n * 0.06);
      else if (t === 3) pos.setY(i, -0.15);
      else pos.setY(i, 0.03 + n * 0.02);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
      flatShading: true,
      map: makeGroundTexture(),
    });
    // mix map lightly with vertex colors
    groundMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * sampledDiffuseColor.rgb * 1.15, 0.35 );
        #endif
        `
      );
    };

    const ground = new THREE.Mesh(geo, groundMat);
    ground.receiveShadow = !this.isMobile;
    this.ground = ground;
    this.scene.add(ground);

    // huge underlay so world edge never shows as empty sky slab
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD * 4, WORLD * 4),
      new THREE.MeshStandardMaterial({ color: 0x4a6a52, roughness: 1, flatShading: true })
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = -0.4;
    under.receiveShadow = false;
    this.scene.add(under);

    // water discs with soft color
    this.waters = [];
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x4a90a8,
      transparent: true,
      opacity: 0.78,
      roughness: 0.15,
      metalness: 0.35,
      flatShading: true,
    });
    this.waterMat = waterMat;
    for (let z = 0; z < MAP_N; z++)
      for (let x = 0; x < MAP_N; x++) {
        if (this.map[z * MAP_N + x] !== 3 || (x + z) % 4) continue;
        const m = new THREE.Mesh(new THREE.CircleGeometry(1.3, 12), waterMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set((x / MAP_N - 0.5) * WORLD, 0.04, (z / MAP_N - 0.5) * WORLD);
        this.scene.add(m);
        this.waters.push(m);
      }

    // props
    this.trees = [];
    this.rocks = [];
    this.chests = [];
    this.torches = [];

    const treeChance = this.isMobile ? 0.032 : 0.048;
    for (let z = 2; z < MAP_N - 2; z++) {
      for (let x = 2; x < MAP_N - 2; x++) {
        const t = this.map[z * MAP_N + x];
        if (t === 1 || t === 3) continue;
        const r = rng();
        const wx = (x / MAP_N - 0.5) * WORLD + (rng() - 0.5) * 0.35;
        const wz = (z / MAP_N - 0.5) * WORLD + (rng() - 0.5) * 0.35;

        if (r < treeChance) {
          const mesh = createPineTree(this.mat, rng, !this.isMobile);
          mesh.position.set(wx, 0, wz);
          this.scene.add(mesh);
          const s = mesh.scale.x;
          this.trees.push({ mesh, x: wx, z: wz, hp: 3, r: 0.42 * s });
        } else if (r < treeChance + 0.012) {
          const mesh = createRockMesh(this.mat, rng, !this.isMobile);
          mesh.position.set(wx, 0, wz);
          this.scene.add(mesh);
          this.rocks.push({ mesh, x: wx, z: wz, hp: 2, r: 0.4 });
        }
      }
    }

    // path torches
    for (let z = 0; z < MAP_N; z++)
      for (let x = 0; x < MAP_N; x++) {
        if (this.map[z * MAP_N + x] !== 1 || rng() > 0.018) continue;
        const wx = (x / MAP_N - 0.5) * WORLD + (rng() > 0.5 ? 1.1 : -1.1);
        const wz = (z / MAP_N - 0.5) * WORLD;
        const withLight = this.torches.length < (this.isMobile ? 3 : 7);
        const mesh = createTorchMesh(this.mat, withLight, this.isMobile);
        mesh.position.set(wx, 0, wz);
        this.scene.add(mesh);
        this.torches.push({
          mesh,
          flame: mesh.userData.flame,
          core: mesh.userData.core,
          light: mesh.userData.light,
        });
      }

    // chests
    for (let i = 0; i < 7; i++) {
      for (let tries = 0; tries < 50; tries++) {
        const x = 5 + Math.floor(rng() * (MAP_N - 10));
        const z = 5 + Math.floor(rng() * (MAP_N - 10));
        if (this.map[z * MAP_N + x] !== 0) continue;
        const wx = (x / MAP_N - 0.5) * WORLD;
        const wz = (z / MAP_N - 0.5) * WORLD;
        const mesh = createChestMesh(this.mat, !this.isMobile);
        mesh.position.set(wx, 0, wz);
        mesh.rotation.y = rng() * Math.PI * 2;
        this.scene.add(mesh);
        this.chests.push({
          mesh,
          lid: mesh.userData.lid,
          x: wx,
          z: wz,
          open: false,
        });
        break;
      }
    }

    // campfire
    const camp = createCampfire(this.mat, this.isMobile);
    camp.position.set(this.spawn.x, 0, this.spawn.z);
    this.scene.add(camp);
    this.campFire = camp.userData.fire;
    this.campCore = camp.userData.core;
  }

  _initPlayer() {
    const mesh = createPlayerMesh(this.mat, !this.isMobile);
    mesh.scale.setScalar(1.35);
    mesh.position.set(this.spawn.x, 0, this.spawn.z);
    this.scene.add(mesh);
    this.playerMesh = mesh;
    this.playerWeapon = mesh.userData.weapon;

    this.player = {
      x: this.spawn.x,
      z: this.spawn.z,
      y: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      speed: 9.5,
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

  _clearPlayableSpace() {
    const sx = this.spawn.x;
    const sz = this.spawn.z;
    const keepTree = (tr) => {
      if (this.tileAt(tr.x, tr.z) === 1 || this.tileAt(tr.x, tr.z) === 2) return false;
      if (Math.hypot(tr.x - sx, tr.z - sz) < 7) return false;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        if (this.tileAt(tr.x + Math.cos(a) * 0.9, tr.z + Math.sin(a) * 0.9) === 1) return false;
      }
      return true;
    };
    for (const tr of [...this.trees]) {
      if (!keepTree(tr)) {
        this.scene.remove(tr.mesh);
        tr.hp = 0;
      }
    }
    this.trees = this.trees.filter((t) => t.hp > 0);
    for (const rk of [...this.rocks]) {
      if (Math.hypot(rk.x - sx, rk.z - sz) < 7 || this.tileAt(rk.x, rk.z) === 1) {
        this.scene.remove(rk.mesh);
        rk.hp = 0;
      }
    }
    this.rocks = this.rocks.filter((r) => r.hp > 0);
    this.player.x = sx;
    this.player.z = sz;
    this.playerMesh.position.set(sx, 0, sz);
  }

  _makeSlime(x, z, tier = 1) {
    const mesh = createSlimeMesh(this.mat, tier, !this.isMobile);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const bar = createHpBar();
    bar.position.set(0, 0.95 * (tier > 1 ? 1.25 : 1), 0);
    mesh.add(bar);
    return {
      mesh,
      bar,
      barFill: bar.userData.fill,
      body: mesh.userData.body,
      x,
      z,
      hp: 20 * tier,
      maxHp: 20 * tier,
      dmg: 5 * tier,
      speed: 2.5 + tier * 0.45,
      tier,
      xp: 14 * tier,
      atkCd: 0,
      hurtT: 0,
      dead: false,
      aggro: 12 + tier * 2,
      bob: Math.random() * Math.PI * 2,
    };
  }

  _spawnSlimes(n) {
    this.enemies = [];
    const rng = this.rng;
    for (let i = 0; i < n; i++) {
      let x, z, ok = false;
      for (let t = 0; t < 45 && !ok; t++) {
        x = (rng() - 0.5) * (WORLD - 10);
        z = (rng() - 0.5) * (WORLD - 10);
        if (!this.blocked(x, z, 0.5) && Math.hypot(x - this.spawn.x, z - this.spawn.z) > 11) ok = true;
      }
      if (!ok) continue;
      this.enemies.push(this._makeSlime(x, z, rng() < 0.18 ? 2 : 1));
    }
  }

  tileAt(x, z) {
    const mx = Math.floor((x / WORLD + 0.5) * MAP_N);
    const mz = Math.floor((z / WORLD + 0.5) * MAP_N);
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
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    const c = this.canvas;
    c.addEventListener("mousemove", (e) => this._mouse(e));
    c.addEventListener("mousedown", (e) => {
      this._mouse(e);
      if (e.button === 0) {
        this.mouse.down = true;
        let nearEnemy = false;
        for (const en of this.enemies) {
          if (en.dead) continue;
          if (Math.hypot(en.x - this._hit.x, en.z - this._hit.z) < 1.25) {
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
    c.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches[0]) return;
        e.preventDefault();
        const t = e.touches[0];
        this._mouse({ clientX: t.clientX, clientY: t.clientY, button: 0, shiftKey: false });
        let nearEnemy = false;
        for (const en of this.enemies) {
          if (en.dead) continue;
          if (Math.hypot(en.x - this._hit.x, en.z - this._hit.z) < 1.4) {
            nearEnemy = true;
            break;
          }
        }
        if (nearEnemy) this.tryAttack();
        else {
          this.moveTarget = this._hit.clone();
          this.moveTarget.y = 0;
        }
      },
      { passive: false }
    );
  }

  _bindTouch() {
    const stick = document.getElementById("stick");
    const knob = document.getElementById("stick-knob");
    if (stick && knob) {
      const maxR = 40;
      const setFromEvent = (clientX, clientY) => {
        const rect = stick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const len = Math.hypot(dx, dy) || 1;
        if (len > maxR) {
          dx = (dx / len) * maxR;
          dy = (dy / len) * maxR;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.stick.active = true;
        this.stick.x = dx / maxR;
        this.stick.y = dy / maxR;
      };
      const end = () => {
        this.stick.active = false;
        this.stick.x = 0;
        this.stick.y = 0;
        knob.style.transform = "translate(0,0)";
      };
      const onDown = (e) => {
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        setFromEvent(t.clientX, t.clientY);
      };
      const onMove = (e) => {
        if (!this.stick.active) return;
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        setFromEvent(t.clientX, t.clientY);
      };
      stick.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", end);
      stick.addEventListener("touchstart", onDown, { passive: false });
      stick.addEventListener("touchmove", onMove, { passive: false });
      stick.addEventListener("touchend", end);
    }

    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        on();
      };
      const stop = (e) => {
        e.preventDefault();
        off();
      };
      el.addEventListener("pointerdown", start);
      el.addEventListener("pointerup", stop);
      el.addEventListener("pointerleave", stop);
      el.addEventListener("touchstart", start, { passive: false });
      el.addEventListener("touchend", stop);
    };
    hold(
      "btn-attack",
      () => {
        this.mouse.down = true;
        this.tryAttack();
      },
      () => {
        this.mouse.down = false;
      }
    );
    hold(
      "btn-shield",
      () => {
        this.keys.ShiftLeft = true;
      },
      () => {
        this.keys.ShiftLeft = false;
      }
    );
    hold(
      "btn-evade",
      () => {
        this.keys.Space = true;
        setTimeout(() => {
          this.keys.Space = false;
        }, 120);
      },
      () => {}
    );
    document.getElementById("btn-craft")?.addEventListener("click", () => this.ui.toggle("craft"));
    document.getElementById("btn-inv")?.addEventListener("click", () => this.ui.toggle("inv"));
    document.querySelectorAll("#action-bar .slot").forEach((btn) => {
      btn.addEventListener("click", () => this.useSkill(Number(btn.dataset.i)));
    });
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
      const s = 0.85 + Math.sin(this.t * 11 + to.mesh.position.x) * 0.2;
      if (to.flame) to.flame.scale.set(s, 0.9 + s * 0.2, s);
      if (to.core) to.core.scale.setScalar(0.9 + Math.sin(this.t * 14) * 0.15);
      if (to.light) to.light.intensity = 0.75 + Math.sin(this.t * 12 + to.mesh.position.z) * 0.25;
    }
    if (this.campFire) {
      this.campFire.scale.y = 0.9 + Math.sin(this.t * 13) * 0.18;
      this.campFire.rotation.y += dt * 1.8;
    }
    if (this.campCore) this.campCore.scale.setScalar(0.95 + Math.sin(this.t * 16) * 0.12);
    if (this.waterMat) this.waterMat.opacity = 0.7 + Math.sin(this.t * 1.8) * 0.08;

    p.shield = !!(this.keys.ShiftLeft || this.keys.ShiftRight);
    if (p.shield) {
      p.stamina = Math.max(0, p.stamina - 16 * dt);
      if (p.stamina <= 0) p.shield = false;
    } else p.stamina = Math.min(p.maxStamina, p.stamina + 20 * dt);

    if ((this.keys.Space || this.keys.KeyE) && p.evadeCd <= 0 && p.stamina >= 18) {
      p.evadeT = 0.2;
      p.evadeCd = 0.85;
      p.stamina -= 18;
      p.invuln = 0.2;
      const ang = Math.atan2(this._hit.x - p.x, this._hit.z - p.z);
      p.vx = Math.sin(ang) * 18;
      p.vz = Math.cos(ang) * 18;
      this.moveTarget = null;
    }

    let mx = 0,
      mz = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) mz -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) mz += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
    if (this.stick && this.stick.active) {
      mx += this.stick.x;
      mz += this.stick.y;
    }
    if (Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05) {
      this.moveTarget = null;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
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

    // walk cycle
    const moving = Math.hypot(p.vx, p.vz) > 0.5;
    const bob = moving ? Math.sin(this.t * 14) : 0;
    this.playerMesh.position.y = Math.abs(bob) * 0.05;
    if (this.playerMesh.userData.legL) {
      this.playerMesh.userData.legL.rotation.x = bob * 0.45;
      this.playerMesh.userData.legR.rotation.x = -bob * 0.45;
    }
    if (this.playerMesh.userData.cloak) {
      this.playerMesh.userData.cloak.rotation.x = 0.12 + (moving ? Math.abs(bob) * 0.08 : 0);
    }

    if (p.attackT > 0 && this.playerWeapon) {
      this.playerWeapon.rotation.x = -0.15 - Math.sin((1 - p.attackT / 0.18) * Math.PI) * 1.3;
    } else if (this.playerWeapon) {
      this.playerWeapon.rotation.x = -0.15;
    }

    const faceAng = Math.atan2(this._hit.x - p.x, this._hit.z - p.z);
    if (p.attackT > 0 || this.mouse.down) p.yaw = faceAng;

    if (this.mouse.down && p.attackCd <= 0) this.tryAttack();

    this.cursor.position.set(this._hit.x, 0.08, this._hit.z);
    this.cursor.rotation.z = this.t * 1.2;

    let nearChest = false;
    for (const c of this.chests) {
      if (!c.open && Math.hypot(c.x - p.x, c.z - p.z) < 1.6) nearChest = true;
    }
    this.ui.setInteract(nearChest);

    this._updateEnemies(dt);
    this._updateProjectiles(dt);
    this._updateDrops(dt);

    // camera follow — higher, softer
    const camPos = new THREE.Vector3(p.x + 0.1, 34, p.z + 12);
    this.camera.position.lerp(camPos, 1 - Math.pow(0.0008, dt));
    this.camera.lookAt(p.x, 0.6, p.z);
    this.sun.position.set(p.x + 22, 36, p.z + 12);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.target.updateMatrixWorld();

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

    this.slash.position.set(p.x + Math.sin(p.yaw) * 1.15, 0.85, p.z + Math.cos(p.yaw) * 1.15);
    this.slash.rotation.z = -p.yaw;
    this.slash.material.opacity = 0.95;

    const dmg = w.dmg + p.baseDmg;

    if (w.ranged) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
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
      if (dist > w.range + 0.45) continue;
      const a = Math.atan2(dx, dz);
      let da = Math.abs(a - p.yaw);
      while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
      if (da < 1.05) this.damageEnemy(e, dmg);
    }

    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      if (Math.hypot(tr.x - p.x, tr.z - p.z) < w.range + 0.65) {
        tr.hp--;
        this.floatDmg(tr.x, 1.8, tr.z, "-1");
        if (tr.hp <= 0) {
          this.scene.remove(tr.mesh);
          this.addItem("wood", 2 + Math.floor(Math.random() * 3));
          this.ui.toast("+ Timber");
        }
      }
    }
    for (const rk of this.rocks) {
      if (rk.hp <= 0) continue;
      if (Math.hypot(rk.x - p.x, rk.z - p.z) < w.range + 0.45) {
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
        if (c.lid) {
          c.lid.rotation.x = -1.15;
          c.lid.position.z -= 0.1;
        }
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
      this.slash.scale.setScalar(1.45);
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
    if (e.body?.material) e.body.material.emissiveIntensity = 0.55;
    this.floatDmg(e.x, 1.1, e.z, String(dmg), crit);
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
    e.barFill.position.x = -0.45 * (1 - ratio);
    e.barFill.material.color.setHex(ratio > 0.5 ? 0x60d070 : ratio > 0.25 ? 0xe0a040 : 0xe05058);

    if (e.hp <= 0) {
      e.dead = true;
      this.grantXp(e.xp);
      p.gold += 1 + Math.floor(Math.random() * 4);
      this.drop(e.x, e.z, "gel", 1 + Math.floor(Math.random() * 2));
      if (Math.random() < 0.28) this.drop(e.x, e.z, "herb", 1);
      if (Math.random() < 0.16) this.drop(e.x, e.z, "ore", 1);
      e.mesh.scale.setScalar(0.01);
      setTimeout(() => {
        this.scene.remove(e.mesh);
        const rng = Math.random;
        let x, z;
        for (let t = 0; t < 30; t++) {
          x = (rng() - 0.5) * (WORLD - 10);
          z = (rng() - 0.5) * (WORLD - 10);
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
        emissiveIntensity: 0.25,
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
      if (e.hurtT <= 0 && e.body?.material) e.body.material.emissiveIntensity = 0.18;

      // jelly squash
      const sq = 0.7 + Math.sin(e.bob) * 0.1;
      e.mesh.scale.y = sq;
      e.mesh.scale.x = 1.05 - (sq - 0.7) * 0.4;
      e.mesh.scale.z = e.mesh.scale.x;
      e.mesh.position.y = Math.abs(Math.sin(e.bob)) * 0.05;
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
        m.fillStyle = t === 3 ? "#4a90a8" : t === 1 ? "#b89860" : t === 2 ? "#7a6038" : "#4a7a52";
        m.fillRect(x, y, 1, 1);
      }
    }
    m.fillStyle = "#1e5030";
    for (const tr of this.trees) {
      if (tr.hp <= 0) continue;
      m.fillRect(((tr.x / WORLD + 0.5) * W) | 0, ((tr.z / WORLD + 0.5) * H) | 0, 1, 1);
    }
    m.fillStyle = "#60f0b0";
    for (const e of this.enemies) {
      if (e.dead) continue;
      m.fillRect(((e.x / WORLD + 0.5) * W) | 0, ((e.z / WORLD + 0.5) * H) | 0, 2, 2);
    }
    const px = ((this.player.x / WORLD + 0.5) * W) | 0;
    const py = ((this.player.z / WORLD + 0.5) * H) | 0;
    m.fillStyle = "#fff";
    m.fillRect(px - 2, py - 2, 4, 4);
    m.fillStyle = "#f0c84a";
    m.fillRect(px - 1, py - 1, 2, 2);
  }

  render() {
    this.playerMesh.visible = !(this.player.invuln > 0 && Math.floor(this.t * 18) % 2 === 0);
    if (this.player.shield) {
      if (!this._shieldMesh) {
        this._shieldMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.9, 16, 12),
          new THREE.MeshBasicMaterial({
            color: 0x80c0ff,
            transparent: true,
            opacity: 0.16,
            wireframe: true,
          })
        );
        this.playerMesh.add(this._shieldMesh);
      }
      this._shieldMesh.visible = true;
    } else if (this._shieldMesh) this._shieldMesh.visible = false;

    this.renderer.render(this.scene, this.camera);
  }
}
