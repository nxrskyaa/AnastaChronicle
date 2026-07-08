import * as THREE from "../vendor/three.module.js";

const texLoader = new THREE.TextureLoader();
const texCache = {};

function loadTex(url, { repeat = 1, nearest = false } = {}) {
  const key = url + "|" + repeat + "|" + nearest;
  if (texCache[key]) return texCache[key];
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (nearest) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
  } else {
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  texCache[key] = t;
  return t;
}

function toon(color, map = null, opts = {}) {
  const m = new THREE.MeshToonMaterial({
    color,
    map,
    gradientMap: loadTex("assets/tex/toon.png", { nearest: true }),
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
  });
  if (opts.emissive) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 0.2;
  }
  return m;
}

function std(color, map = null, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    map,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
    flatShading: opts.flat ?? true,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

export function createPalette(isMobile) {
  const grassMap = loadTex("assets/tex/grass.png", { repeat: 10 });
  const pathMap = loadTex("assets/tex/path.png", { repeat: 6 });
  const barkMap = loadTex("assets/tex/bark.png", { repeat: 1 });
  const leafMap = loadTex("assets/tex/leaves.png", { repeat: 1 });
  const waterMap = loadTex("assets/tex/water.png", { repeat: 2 });
  const stoneMap = loadTex("assets/tex/stone.png", { repeat: 1 });

  return {
    isMobile,
    grassMap,
    pathMap,
    // ground materials
    grass: std(0xffffff, grassMap, { roughness: 0.95, flat: true }),
    path: std(0xffffff, pathMap, { roughness: 0.92, flat: true }),
    water: std(0x5aa0b8, waterMap, {
      roughness: 0.2,
      metalness: 0.35,
      transparent: true,
      opacity: 0.82,
      flat: true,
    }),
    // trees
    bark: toon(0xffffff, barkMap),
    barkDark: toon(0x8a7058, barkMap),
    leafA: toon(0x3d7a4a, leafMap),
    leafB: toon(0x2f6a3d, leafMap),
    leafC: toon(0x4a8a55, leafMap),
    leafDark: toon(0x245535, leafMap),
    // rocks
    stone: toon(0xb0b6be, stoneMap),
    stoneDark: toon(0x7a8088, stoneMap),
    // player — saturated game-hero palette
    skin: toon(0xf0c2a0),
    hair: toon(0x2c2430),
    tunic: toon(0x5c6b7a),
    tunicDark: toon(0x3e4a58),
    cloak: toon(0x4a5a6e),
    pants: toon(0x353545),
    boot: toon(0x2a2018),
    metal: toon(0xd8e0ea),
    metalDark: toon(0x8a949e),
    leather: toon(0x7a4a28),
    accent: toon(0xc45a4a),
    // slime jelly
    slime: toon(0x5ef0c0, null, {
      transparent: true,
      opacity: 0.9,
      emissive: 0x2a8060,
      emissiveIntensity: 0.25,
    }),
    slimeDark: toon(0x3ad0a0, null, {
      transparent: true,
      opacity: 0.92,
      emissive: 0x1a6048,
      emissiveIntensity: 0.2,
    }),
    eyeWhite: toon(0xffffff),
    eye: toon(0x1a2030),
    // props
    chest: toon(0xa07040),
    chestLid: toon(0xc09050),
    gold: toon(0xf0c840, null, { emissive: 0x806010, emissiveIntensity: 0.2 }),
    torchWood: toon(0x5a3a24),
    flame: new THREE.MeshBasicMaterial({ color: 0xff9030 }),
    flameCore: new THREE.MeshBasicMaterial({ color: 0xffe090 }),
  };
}

function shadow(m, on) {
  m.castShadow = on;
  m.receiveShadow = on;
  return m;
}

/** Hero — more readable silhouette from top-down */
export function createPlayerMesh(mat, cast = true) {
  const g = new THREE.Group();

  // shadow blob
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  g.add(blob);

  // legs
  const legG = new THREE.CapsuleGeometry(0.11, 0.32, 4, 8);
  const legL = shadow(new THREE.Mesh(legG, mat.pants), cast);
  legL.position.set(-0.14, 0.42, 0);
  const legR = shadow(new THREE.Mesh(legG, mat.pants), cast);
  legR.position.set(0.14, 0.42, 0);

  // boots
  const bootG = new THREE.BoxGeometry(0.18, 0.14, 0.28);
  const bootL = shadow(new THREE.Mesh(bootG, mat.boot), cast);
  bootL.position.set(-0.14, 0.09, 0.04);
  const bootR = shadow(new THREE.Mesh(bootG, mat.boot), cast);
  bootR.position.set(0.14, 0.09, 0.04);

  // hips / skirt plate
  const hips = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.22, 10), mat.tunicDark), cast);
  hips.position.y = 0.72;

  // torso
  const torso = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.42, 5, 10), mat.tunic), cast);
  torso.position.y = 1.05;

  // chest plate
  const plate = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.24), mat.metal), cast);
  plate.position.set(0, 1.08, 0.1);
  // red scarf / accent
  const scarf = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.2), mat.accent), cast);
  scarf.position.set(0, 1.28, 0.12);

  // belt + buckle
  const belt = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.09, 0.32), mat.leather), cast);
  belt.position.y = 0.8;
  const buckle = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), mat.gold), cast);
  buckle.position.set(0, 0.8, 0.18);

  // cloak
  const cloak = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.85, 0.14), mat.cloak), cast);
  cloak.position.set(0, 1.0, -0.22);
  cloak.rotation.x = 0.15;

  // shoulders
  const shL = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), mat.metalDark), cast);
  shL.position.set(-0.34, 1.28, 0);
  const shR = shL.clone();
  shR.position.x = 0.34;

  // arms
  const armG = new THREE.CapsuleGeometry(0.08, 0.32, 4, 8);
  const armL = shadow(new THREE.Mesh(armG, mat.tunicDark), cast);
  armL.position.set(-0.4, 1.02, 0.02);
  armL.rotation.z = 0.28;
  const armR = shadow(new THREE.Mesh(armG, mat.tunicDark), cast);
  armR.position.set(0.4, 1.02, 0.02);
  armR.rotation.z = -0.28;

  // hands
  const handL = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat.skin), cast);
  handL.position.set(-0.48, 0.74, 0.06);
  const handR = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat.skin), cast);
  handR.position.set(0.48, 0.74, 0.1);

  // head
  const head = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), mat.skin), cast);
  head.position.y = 1.58;
  // hair volume
  const hair = shadow(
    new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat.hair),
    cast
  );
  hair.position.set(0, 1.66, -0.02);
  // bangs
  const bang = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.12), mat.hair), cast);
  bang.position.set(0, 1.68, 0.14);

  // eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), mat.eye);
  eyeL.position.set(-0.08, 1.58, 0.18);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;

  // sword
  const weapon = new THREE.Group();
  const blade = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.95), mat.metal), cast);
  blade.position.z = 0.4;
  // blade tip
  const tip = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), mat.metal), cast);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 0.92;
  const guard = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.07), mat.metalDark), cast);
  const hilt = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.24, 8), mat.leather), cast);
  hilt.rotation.x = Math.PI / 2;
  hilt.position.z = -0.14;
  const pommel = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat.gold), cast);
  pommel.position.z = -0.28;
  weapon.add(blade, tip, guard, hilt, pommel);
  weapon.position.set(0.52, 0.9, 0.22);
  weapon.rotation.x = -0.2;

  g.add(
    blob, legL, legR, bootL, bootR, hips, torso, plate, scarf, belt, buckle, cloak,
    shL, shR, armL, armR, handL, handR, head, hair, bang, eyeL, eyeR, weapon
  );
  g.userData.weapon = weapon;
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.cloak = cloak;
  g.userData.blob = blob;
  return g;
}

/** Dense layered pine */
export function createPineTree(mat, rng, cast = true) {
  const g = new THREE.Group();
  const h = 2.8 + rng() * 2.8;
  const trunkH = h * 0.5;
  const r0 = 0.16 + rng() * 0.1;

  const trunk = shadow(
    new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.65, r0, trunkH, 8), rng() > 0.5 ? mat.bark : mat.barkDark),
    cast
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);

  // AO under tree
  const ao = new THREE.Mesh(
    new THREE.CircleGeometry(0.9 + rng() * 0.4, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
  );
  ao.rotation.x = -Math.PI / 2;
  ao.position.y = 0.03;
  g.add(ao);

  const layers = 4 + Math.floor(rng() * 2);
  const mats = [mat.leafDark, mat.leafA, mat.leafB, mat.leafC, mat.leafA];
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1 || 1);
    const rad = (1.35 - t * 0.75) * (0.9 + rng() * 0.25);
    const y = trunkH * 0.45 + i * (h * 0.16) + 0.35;
    // mix cone + icosa for organic mass
    const geo =
      i % 2 === 0
        ? new THREE.ConeGeometry(rad, rad * 1.25, 8)
        : new THREE.IcosahedronGeometry(rad * 0.85, 0);
    const leaf = shadow(new THREE.Mesh(geo, mats[i % mats.length]), cast);
    leaf.position.set((rng() - 0.5) * 0.15, y, (rng() - 0.5) * 0.15);
    leaf.rotation.y = rng() * Math.PI;
    leaf.scale.y = 0.9 + rng() * 0.25;
    g.add(leaf);
  }

  // top tip
  const tip = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 7), mat.leafC), cast);
  tip.position.y = trunkH * 0.45 + layers * (h * 0.16) + 0.2;
  g.add(tip);

  g.rotation.z = (rng() - 0.5) * 0.1;
  g.rotation.x = (rng() - 0.5) * 0.08;
  g.scale.setScalar(0.95 + rng() * 0.55);
  return g;
}

export function createSlimeMesh(mat, tier = 1, cast = true) {
  const g = new THREE.Group();
  const s = tier > 1 ? 1.35 : 1;
  const bodyMat = tier > 1 ? mat.slimeDark : mat.slime;

  // shadow
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.4 * s, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  g.add(blob);

  const body = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.45 * s, 16, 12), bodyMat), cast);
  body.scale.y = 0.72;
  body.position.y = 0.34 * s;

  // drip blobs
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const drip = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 8, 8), bodyMat), cast);
    drip.position.set(Math.cos(a) * 0.28 * s, 0.18 * s, Math.sin(a) * 0.28 * s);
    drip.scale.y = 1.3;
    g.add(drip);
  }

  const crown = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 12, 10), bodyMat), cast);
  crown.position.y = 0.58 * s;
  crown.scale.set(1.15, 0.65, 1.15);

  // big cute eyes
  const wL = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 10, 10), mat.eyeWhite);
  wL.position.set(-0.16 * s, 0.4 * s, 0.3 * s);
  const wR = wL.clone();
  wR.position.x = 0.16 * s;
  const pL = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 8, 8), mat.eye);
  pL.position.set(-0.16 * s, 0.4 * s, 0.38 * s);
  const pR = pL.clone();
  pR.position.x = 0.16 * s;

  // mouth
  const mouth = new THREE.Mesh(
    new THREE.SphereGeometry(0.06 * s, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x1a4038 })
  );
  mouth.position.set(0, 0.28 * s, 0.35 * s);
  mouth.scale.set(1.4, 0.5, 0.6);

  // shine
  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.1 * s, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
  );
  shine.position.set(-0.12 * s, 0.5 * s, 0.2 * s);

  g.add(body, crown, wL, wR, pL, pR, mouth, shine);
  g.userData.body = body;
  g.userData.crown = crown;
  return g;
}

export function createTorchMesh(mat, withLight, isMobile) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.2, 7), mat.torchWood);
  pole.position.y = 0.6;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.2, 7), mat.leather);
  wrap.position.y = 1.1;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 7), mat.flame);
  flame.position.y = 1.38;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat.flameCore);
  core.position.y = 1.28;
  g.add(pole, wrap, flame, core);
  let light = null;
  if (withLight) {
    light = new THREE.PointLight(0xff9a40, isMobile ? 0.7 : 1.15, isMobile ? 6 : 8, 2);
    light.position.y = 1.35;
    g.add(light);
  }
  g.userData.flame = flame;
  g.userData.core = core;
  g.userData.light = light;
  return g;
}

export function createRockMesh(mat, rng, cast = true) {
  const g = new THREE.Group();
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const m = shadow(
      new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.28 + rng() * 0.22, 0),
        rng() > 0.5 ? mat.stone : mat.stoneDark
      ),
      cast
    );
    m.position.set((rng() - 0.5) * 0.35, 0.16 + rng() * 0.1, (rng() - 0.5) * 0.35);
    m.rotation.set(rng() * 2, rng() * 2, rng());
    m.scale.set(0.85 + rng() * 0.5, 0.5 + rng() * 0.4, 0.85 + rng() * 0.5);
    g.add(m);
  }
  const ao = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
  );
  ao.rotation.x = -Math.PI / 2;
  ao.position.y = 0.02;
  g.add(ao);
  return g;
}

export function createChestMesh(mat, cast = true) {
  const g = new THREE.Group();
  const box = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.48, 0.58), mat.chest), cast);
  box.position.y = 0.24;
  const band = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.09, 0.62), mat.metalDark), cast);
  band.position.y = 0.3;
  const lid = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.62), mat.chestLid), cast);
  lid.position.y = 0.54;
  const lock = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), mat.gold), cast);
  lock.position.set(0, 0.4, 0.32);
  g.add(box, band, lid, lock);
  g.userData.lid = lid;
  return g;
}

export function createCampfire(mat, isMobile) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), mat.stone);
    rock.position.set(Math.cos(a) * 0.5, 0.09, Math.sin(a) * 0.5);
    rock.scale.y = 0.55;
    g.add(rock);
  }
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.75, 7), mat.bark);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.14;
    g.add(log);
  }
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.65, 8), mat.flame);
  fire.position.y = 0.5;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), mat.flameCore);
  core.position.y = 0.38;
  const light = new THREE.PointLight(0xff8020, isMobile ? 1.15 : 2.0, isMobile ? 9 : 13, 2);
  light.position.y = 0.9;
  g.add(fire, core, light);
  g.userData.fire = fire;
  g.userData.core = core;
  return g;
}

export function createHpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x1a1214, depthTest: false, transparent: true, opacity: 0.88 })
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.94, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x50d070, depthTest: false })
  );
  fill.position.z = 0.01;
  g.add(bg, fill);
  g.userData.fill = fill;
  g.renderOrder = 10;
  return g;
}

/** Grass tuft for detail */
export function createGrassTuft(mat, rng) {
  const g = new THREE.Group();
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.25 + rng() * 0.2, 4),
      rng() > 0.5 ? mat.leafA : mat.leafC
    );
    blade.position.set((rng() - 0.5) * 0.2, 0.12, (rng() - 0.5) * 0.2);
    blade.rotation.z = (rng() - 0.5) * 0.4;
    blade.rotation.x = (rng() - 0.5) * 0.3;
    g.add(blade);
  }
  return g;
}
