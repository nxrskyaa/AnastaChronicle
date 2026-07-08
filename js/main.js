import { Game } from "./game.js";
import { UI } from "./ui.js";

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("boot-status");
const btnStart = document.getElementById("btn-start");
const wrap = document.getElementById("game-wrap");
const canvas = document.getElementById("game");

function showFatal(msg) {
  console.error(msg);
  boot.classList.remove("hidden");
  wrap.classList.add("hidden");
  bootStatus.innerHTML = `<span style="color:#ff8a90">ERROR:</span> ${msg}`;
  btnStart.disabled = false;
  btnStart.textContent = "Retry";
}

async function main() {
  bootStatus.textContent = "Loading engine…";
  try {
    await import("../vendor/three.module.js");
    bootStatus.textContent = "Ready — tap Enter";
    btnStart.disabled = false;
  } catch (e) {
    showFatal("Engine load failed: " + (e?.message || e));
    return;
  }

  const ui = new UI();
  btnStart.addEventListener("click", () => {
    try {
      boot.classList.add("hidden");
      wrap.classList.remove("hidden");
      // Let Three set drawing buffer size
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      const game = new Game(canvas, ui);
      window.__ANASTA__ = game;
      ui.bind(game);
      game.start();
      window.focus();
      ui.toast("Stick/WASD move · ATK fight");
    } catch (e) {
      showFatal(e?.message || String(e));
    }
  });
}

window.addEventListener("error", (ev) => {
  showFatal(ev.message || "Unknown error");
});
window.addEventListener("unhandledrejection", (ev) => {
  showFatal(ev.reason?.message || String(ev.reason || "Promise error"));
});

main();
