import { loadAll } from "./assets.js";
import { Game } from "./game.js";
import { UI } from "./ui.js";

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("boot-status");
const btnStart = document.getElementById("btn-start");
const wrap = document.getElementById("game-wrap");
const canvas = document.getElementById("game");

async function main() {
  try {
    await loadAll((done, total, key) => {
      bootStatus.textContent = `Loading ${done}/${total}…`;
    });
    bootStatus.textContent = "Ready.";
    btnStart.disabled = false;

    const ui = new UI();
    let game = null;

    btnStart.addEventListener("click", () => {
      boot.classList.add("hidden");
      wrap.classList.remove("hidden");
      game = new Game(canvas, ui);
      ui.bind(game);
      ui.sync(game);
      ui.renderInv(game);
      ui.renderCraft(game);
      game.start();
      ui.toast("Welcome to the Forest of Anasta");
    });
  } catch (err) {
    console.error(err);
    bootStatus.textContent = "Failed to load assets. Check console.";
  }
}

main();
