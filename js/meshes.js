import * as THREE from "../vendor/three.module.js";

/** Shared materials — muted forest ARPG palette matching ref */
export function createPalette(isMobile) {
  const flat = (hex, opts = {}) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      flatShading: true,
      roughness: opts.roughness ?? 0.88,
      metalness: opts.metalness ?? 0.02,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
    });

  return {
    bark: flat(0x5c4030, { roughness: 1 }),
    barkDark: flat(0x3d2a1f, { roughness: 1 }),
    pine1: flat(0x2d5a3d, { roughness: 0.95 }),
    pine2: flat(0x3a6b48, { roughness: 0.95 }),
    pine3: flat(0x244a32, { roughness: 0.95 }),
    pineTip: flat(0x4a7a55, { roughness: 0.9 }),
    dirt: flat(0x8b6b45, { roughness: 1 }),
    stone: flat(0x6a7078, { roughness: 0.95 }),
    stoneDark: flat(0x4a5058, { roughness: 0.95 }),
    torchWood: flat(0x4a3424),
    flame: new THREE.MeshBasicMaterial({ color: 0xff9a40 }),
    flameCore: new THREE.MeshBasicMaterial({ color: 0xffe080 }),
    // player
    skin: flat(0xe8b898, { roughness: 0.7 }),
    hair: flat(0x2a2228, { roughness: 0.9 }),
    tunic: flat(0x5a6470, { roughness: 0.75, metalness: 0.15 }),
    tunicDark: flat(0x3a4450, { roughness: 0.8, metalness: 0.1 }),
    cloak: flat(0x4a5568, { roughness: 0.85 }),
    pants: flat(0x3a3a48, { roughness: 0.9 }),
    boot: flat(0x2a2018, { roughness: 0.95 }),
    metal: flat(0xc8d0dc, { roughness: 0.35, metalness: 0.65 }),
    metalDark: flat(0x8a929c, { roughness: 0.4, metalness: 0.55 }),
    leather: flat(0x6b4423, { roughness: 0.9 }),
    // slime
    slime: flat(0x5ee0b8, {
      roughness: 0.35,
      metalness: 0.05,
      emissive: 0x2a8060,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.92,
    }),
    slimeDark: flat(0x3ab890, {
      roughness: 0.4,
      emissive: 0x1a6048,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.95,
    }),
    slimeEye: flat(0x1a2030, { roughness: 0.5 }),
    slimeEyeWhite: flat(0xf0f8ff, { roughness: 0.4 }),
    chest: flat(0x8a6238),
    chestLid: flat(0xb87840),
    gold: flat(0xe8c040, { metalness: 0.5, roughness: 0.4, emissive: 0x806010, emissiveIntensity: 0.15 }),
    herb: flat(0x50c060),
    gelDrop: flat(0x60f0b0, { emissive: 0x208050, emissiveIntensity: 0.25 }),
    isMobile,
  };
}

function addShadow(mesh, enabled) {
  mesh.castShadow = enabled;
  mesh.receiveShadow = enabled;
  return mesh;
}

/** Stylized adventurer — cloak, tunic, boots, sword (ref-like) */
export function createPlayerMesh(mat, castShadow = true) {
  const g = new THREE.Group();
  g.name = "player";

  // legs
  const legGeo = new THREE.CapsuleGeometry(0.1, 0.28, 3, 6);
  const legL = addShadow(new THREE.Mesh(legGeo, mat.pants), castShadow);
  legL.position.set(-0.12, 0.38, 0);
  const legR = addShadow(new THREE.Mesh(legGeo, mat.pants), castShadow);
  legR.position.set(0.12, 0.38, 0);
  // boots
  const bootGeo = new THREE.BoxGeometry(0.16, 0.12, 0.24);
  const bootL = addShadow(new THREE.Mesh(bootGeo, mat.boot), castShadow);
  bootL.position.set(-0.12, 0.08, 0.02);
  const bootR = addShadow(new THREE.Mesh(bootGeo, mat.boot), castShadow);
  bootR.position.set(0.12, 0.08, 0.02);

  // torso / tunic
  const torso = addShadow(
    new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.38, 4, 8), mat.tunic),
    castShadow
  );
  torso.position.y = 0.95;

  // chest plate accent
  const plate = addShadow(
    new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.22), mat.metal),
    castShadow
  );
  plate.position.set(0, 1.0, 0.08);

  // belt
  const belt = addShadow(
    new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.28), mat.leather),
    castShadow
  );
  belt.position.y = 0.72;

  // cloak (back)
  const cloak = addShadow(
    new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.12), mat.cloak),
    castShadow
  );
  cloak.position.set(0, 0.95, -0.18);
  cloak.rotation.x = 0.12;

  // arms
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.28, 3, 6);
  const armL = addShadow(new THREE.Mesh(armGeo, mat.tunicDark), castShadow);
  armL.position.set(-0.36, 0.98, 0);
  armL.rotation.z = 0.25;
  const armR = addShadow(new THREE.Mesh(armGeo, mat.tunicDark), castShadow);
  armR.position.set(0.36, 0.98, 0);
  armR.rotation.z = -0.25;

  // hands
  const handL = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mat.skin), castShadow);
  handL.position.set(-0.42, 0.72, 0.05);
  const handR = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mat.skin), castShadow);
  handR.position.set(0.42, 0.72, 0.08);

  // head
  const head = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), mat.skin), castShadow);
  head.position.y = 1.48;
  // hair / hood
  const hair = addShadow(
    new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), mat.hair),
    castShadow
  );
  hair.position.set(0, 1.55, -0.02);
  // face eyes (simple)
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), mat.slimeEye);
  eyeL.position.set(-0.07, 1.5, 0.16);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.07;

  // sword in right hand
  const weapon = new THREE.Group();
  const blade = addShadow(
    new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.85), mat.metal),
    castShadow
  );
  blade.position.z = 0.35;
  const guard = addShadow(
    new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), mat.metalDark),
    castShadow
  );
  const hilt = addShadow(
    new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 6), mat.leather),
    castShadow
  );
  hilt.rotation.x = Math.PI / 2;
  hilt.position.z = -0.12;
  const pommel = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), mat.metalDark), castShadow);
  pommel.position.z = -0.24;
  weapon.add(blade, guard, hilt, pommel);
  weapon.position.set(0.48, 0.85, 0.2);
  weapon.rotation.x = -0.15;
  weapon.rotation.y = 0.1;

  g.add(
    legL, legR, bootL, bootR,
    torso, plate, belt, cloak,
    armL, armR, handL, handR,
    head, hair, eyeL, eyeR, weapon
  );

  // store refs for anim
  g.userData.weapon = weapon;
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.cloak = cloak;

  return g;
}

/** Tall pine tree — multi-layer canopy like reference */
export function createPineTree(mat, rng, castShadow = true) {
  const g = new THREE.Group();
  const h = 2.4 + rng() * 2.2;
  const trunkH = h * 0.55;
  const trunkR = 0.14 + rng() * 0.08;

  const trunk = addShadow(
    new THREE.Mesh(
      new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 7),
      rng() > 0.5 ? mat.bark : mat.barkDark
    ),
    castShadow
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);

  // stacked cones / spheres for canopy
  const layers = 3 + Math.floor(rng() * 2);
  const pineMats = [mat.pine1, mat.pine2, mat.pine3, mat.pineTip];
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1 || 1);
    const rad = (1.1 - t * 0.55) * (0.85 + rng() * 0.25);
    const y = trunkH * 0.55 + i * (h * 0.18) + 0.3;
    const geo =
      rng() > 0.35
        ? new THREE.ConeGeometry(rad, rad * 1.15, 7)
        : new THREE.DodecahedronGeometry(rad * 0.85, 0);
    const leaf = addShadow(new THREE.Mesh(geo, pineMats[i % pineMats.length]), castShadow);
    leaf.position.y = y;
    leaf.rotation.y = rng() * Math.PI;
    leaf.scale.y = 0.85 + rng() * 0.25;
    g.add(leaf);
  }

  // slight lean
  g.rotation.z = (rng() - 0.5) * 0.08;
  g.rotation.x = (rng() - 0.5) * 0.06;
  const s = 0.9 + rng() * 0.45;
  g.scale.setScalar(s);
  return g;
}

/** Soft jelly slime with eyes */
export function createSlimeMesh(mat, tier = 1, castShadow = true) {
  const g = new THREE.Group();
  const scale = tier > 1 ? 1.3 : 1;
  const bodyMat = tier > 1 ? mat.slimeDark : mat.slime;

  const body = addShadow(
    new THREE.Mesh(new THREE.SphereGeometry(0.42 * scale, 12, 10), bodyMat),
    castShadow
  );
  body.scale.y = 0.72;
  body.position.y = 0.32 * scale;

  // translucent crown blob
  const crown = addShadow(
    new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 10, 8), bodyMat),
    castShadow
  );
  crown.position.y = 0.55 * scale;
  crown.scale.set(1.1, 0.7, 1.1);

  // eyes
  const eyeWhiteL = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 8, 8), mat.slimeEyeWhite);
  eyeWhiteL.position.set(-0.14 * scale, 0.38 * scale, 0.28 * scale);
  const eyeWhiteR = eyeWhiteL.clone();
  eyeWhiteR.position.x = 0.14 * scale;
  const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.045 * scale, 6, 6), mat.slimeEye);
  pupilL.position.set(-0.14 * scale, 0.38 * scale, 0.35 * scale);
  const pupilR = pupilL.clone();
  pupilR.position.x = 0.14 * scale;

  // cheek highlight
  const cheek = new THREE.Mesh(
    new THREE.SphereGeometry(0.08 * scale, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xa0ffe0, transparent: true, opacity: 0.35 })
  );
  cheek.position.set(0, 0.22 * scale, 0.3 * scale);

  g.add(body, crown, eyeWhiteL, eyeWhiteR, pupilL, pupilR, cheek);
  g.userData.body = body;
  g.userData.crown = crown;
  return g;
}

export function createTorchMesh(mat, withLight, isMobile) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 1.15, 6),
    mat.torchWood
  );
  pole.position.y = 0.55;
  const wrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 0.18, 6),
    mat.leather
  );
  wrap.position.y = 1.05;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), mat.flame);
  flame.position.y = 1.3;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mat.flameCore);
  core.position.y = 1.22;
  g.add(pole, wrap, flame, core);

  let light = null;
  if (withLight) {
    light = new THREE.PointLight(0xff9a40, isMobile ? 0.65 : 1.0, isMobile ? 5.5 : 7.5, 2);
    light.position.y = 1.3;
    g.add(light);
  }
  g.userData.flame = flame;
  g.userData.core = core;
  g.userData.light = light;
  return g;
}

export function createRockMesh(mat, rng, castShadow = true) {
  const g = new THREE.Group();
  const n = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const m = addShadow(
      new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.25 + rng() * 0.2, 0),
        rng() > 0.5 ? mat.stone : mat.stoneDark
      ),
      castShadow
    );
    m.position.set((rng() - 0.5) * 0.3, 0.15 + rng() * 0.1, (rng() - 0.5) * 0.3);
    m.rotation.set(rng(), rng(), rng());
    m.scale.set(0.8 + rng() * 0.5, 0.55 + rng() * 0.35, 0.8 + rng() * 0.5);
    g.add(m);
  }
  return g;
}

export function createChestMesh(mat, castShadow = true) {
  const g = new THREE.Group();
  const box = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.55), mat.chest), castShadow);
  box.position.y = 0.22;
  const band = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.58), mat.metalDark), castShadow);
  band.position.y = 0.28;
  const lid = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.58), mat.chestLid), castShadow);
  lid.position.y = 0.5;
  const lock = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), mat.gold), castShadow);
  lock.position.set(0, 0.38, 0.28);
  g.add(box, band, lid, lock);
  g.userData.lid = lid;
  return g;
}

export function createCampfire(mat, isMobile) {
  const g = new THREE.Group();
  // ring stones
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.14, 0),
      mat.stone
    );
    rock.position.set(Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45);
    rock.scale.y = 0.6;
    g.add(rock);
  }
  // logs
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.08, 0.7, 6),
      mat.bark
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.12;
    g.add(log);
  }
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 7), mat.flame);
  fire.position.y = 0.45;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), mat.flameCore);
  core.position.y = 0.35;
  const light = new THREE.PointLight(0xff8020, isMobile ? 1.0 : 1.8, isMobile ? 8 : 12, 2);
  light.position.y = 0.8;
  g.add(fire, core, light);
  g.userData.fire = fire;
  g.userData.core = core;
  return g;
}

export function createHpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.11),
    new THREE.MeshBasicMaterial({ color: 0x1a1214, depthTest: false, transparent: true, opacity: 0.85 })
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.07),
    new THREE.MeshBasicMaterial({ color: 0xe05058, depthTest: false })
  );
  fill.position.z = 0.01;
  // green→red will be scaled
  g.add(bg, fill);
  g.userData.fill = fill;
  g.renderOrder = 10;
  return g;
}

/** Soft ground texture canvas */
export function makeGroundTexture() {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  // base soft green
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const n = (Math.sin(x * 0.2) + Math.cos(y * 0.17) + Math.sin((x + y) * 0.1)) / 3;
      const v = 0.5 + n * 0.5;
      const r = Math.floor(55 + v * 30);
      const gr = Math.floor(90 + v * 40);
      const b = Math.floor(58 + v * 22);
      g.fillStyle = `rgb(${r},${gr},${b})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  // patch noise
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 2 + Math.random() * 6;
    g.fillStyle = `rgba(${40 + Math.random() * 40},${70 + Math.random() * 50},${40},0.25)`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makePathTexture() {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const n = ((x * 7 + y * 13) % 9) / 9;
      const r = Math.floor(140 + n * 40);
      const gr = Math.floor(110 + n * 30);
      const b = Math.floor(70 + n * 20);
      g.fillStyle = `rgb(${r},${gr},${b})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
