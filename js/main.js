import { Game } from "./game.js";
import { UI } from "./ui.js";

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("boot-status");
const btnStart = document.getElementById("btn-start");
const wrap = document.getElementById("game-wrap");
const canvas = document.getElementById("game");

async function main() {
  bootStatus.textContent = "Loading Three.js…";
  try {
    // warm import
    await import("three");
    bootStatus.textContent = "Ready.";
    btnStart.disabled = false;
  } catch (e) {
    console.error(e);
    bootStatus.textContent = "Failed to load engine. Check network/CDN.";
    return;
  }

  const ui = new UI();
  btnStart.addEventListener("click", () => {
    try {
      boot.classList.add("hidden");
      wrap.classList.remove("hidden");
      // size canvas
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const game = new Game(canvas, ui);
      ui.bind(game);
      game.start();
      ui.toast("Welcome to Anasta Wilds");
    } catch (e) {
      console.error(e);
      boot.classList.remove("hidden");
      wrap.classList.add("hidden");
      bootStatus.textContent = "Failed: " + (e?.message || e);
      btnStart.disabled = false;
    }
  });
}

main();
