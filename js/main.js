import { loadAll } from "./assets.js";
import { Game } from "./game.js";
import "./logic.js";   // attaches update/combat to Game.prototype
import "./render.js";  // attaches render to Game.prototype
import { UI } from "./ui.js";

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("boot-status");
const btn = document.getElementById("btn-start");

async function preload() {
  try {
    await loadAll((done, total) => { bootStatus.textContent = `Loading… ${done}/${total}`; });
    bootStatus.textContent = "Ready";
    btn.disabled = false;
  } catch (e) {
    bootStatus.textContent = "Load error: " + e.message;
    console.error(e);
  }
}

btn.addEventListener("click", () => {
  boot.classList.add("hidden");
  document.getElementById("game-wrap").classList.remove("hidden");
  try {
    const ui = new UI();
    const game = new Game(document.getElementById("game"), ui);
    ui.bind(game);
    window.__ANASTA__ = game;
    game.start();
  } catch (e) {
    console.error(e);
    alert("Game failed to start: " + e.message);
  }
});

preload();
