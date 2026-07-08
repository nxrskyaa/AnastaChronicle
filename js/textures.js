import * as THREE from "../vendor/three.module.js";

const URLS = {
  grass: "assets/tex/grass.png",
  path: "assets/tex/path.png",
  bark: "assets/tex/bark.png",
  leaves: "assets/tex/leaves.png",
  water: "assets/tex/water.png",
  stone: "assets/tex/stone.png",
  toon: "assets/tex/toon.png",
};

/**
 * Preload every texture before Game boots so materials never render map-less.
 */
export function preloadTextures() {
  const loader = new THREE.TextureLoader();
  const entries = Object.entries(URLS);
  return Promise.all(
    entries.map(
      ([key, url]) =>
        new Promise((resolve, reject) => {
          loader.load(
            url,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
              if (key === "toon") {
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
              } else {
                tex.magFilter = THREE.LinearFilter;
                tex.minFilter = THREE.LinearMipmapLinearFilter;
                tex.anisotropy = 4;
              }
              resolve([key, tex]);
            },
            undefined,
            (err) => reject(new Error("Failed texture " + url + ": " + err))
          );
        })
    )
  ).then((pairs) => Object.fromEntries(pairs));
}

export function configureRepeats(tex) {
  if (tex.grass) tex.grass.repeat.set(6, 6);
  if (tex.path) tex.path.repeat.set(4, 4);
  if (tex.bark) tex.bark.repeat.set(1, 2);
  if (tex.leaves) tex.leaves.repeat.set(1, 1);
  if (tex.water) tex.water.repeat.set(3, 3);
  if (tex.stone) tex.stone.repeat.set(1, 1);
  return tex;
}
