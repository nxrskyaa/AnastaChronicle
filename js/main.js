import { Game } from "./game.js";
import { UI } from "./ui.js";

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("boot-status");
const btnStart = document.getElementById("btn-start");
const wrap = document.getElementById("game-wrap");
const canvas = document.getElementById("game");

async function main() {
  bootStatus.textContent = "Loading engine…";
  try {
    await import("three");
    bootStatus.textContent = "Ready — tap Enter";
    btnStart.disabled = false;
  } catch (e) {
    console.error(e);
    bootStatus.textContent = "Engine load failed: " + (e?.message || e);
    return;
  }

  const ui = new UI();
  btnStart.addEventListener("click", () => {
    try {
      boot.classList.add("hidden");
      wrap.classList.remove("hidden");
      canvas.width = window.innerWidth * (window.devicePixelRatio > 1.5 ? 1.25 : 1);
      canvas.height = window.innerHeight * (window.devicePixelRatio > 1.5 ? 1.25 : 1);
      // better: let renderer set size
      const game = new Game(canvas, ui);
      ui.bind(game);
      game.start();
      // focus so keyboard works immediately
      window.focus();
      canvas.focus?.();
      ui.toast("Use stick / WASD to move · ATK to fight");
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
