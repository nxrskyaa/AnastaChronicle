import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";

export class UI {
  constructor() {
    this.game = null;
    this.panels = {
      inv: document.getElementById("panel-inv"),
      craft: document.getElementById("panel-craft"),
      level: document.getElementById("panel-level"),
      death: document.getElementById("death-screen"),
    };
    document.querySelectorAll("[data-close]").forEach((b) =>
      b.addEventListener("click", () => this.close(b.dataset.close))
    );
    document.getElementById("btn-level-ok")?.addEventListener("click", () => {
      this.panels.level.classList.add("hidden");
      if (this.game) this.game.paused = false;
    });
    document.getElementById("btn-respawn")?.addEventListener("click", () => this.game?.respawn());
    document.getElementById("btn-inv-hot")?.addEventListener("click", () => this.toggle("inv"));
    document.getElementById("btn-craft-hot")?.addEventListener("click", () => this.toggle("craft"));
  }

  bind(game) {
    this.game = game;
  }

  toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.remove("show"), 1500);
  }

  toggle(name) {
    const p = this.panels[name];
    if (!p) return;
    const open = p.classList.contains("hidden");
    this.closeAll();
    if (open) {
      p.classList.remove("hidden");
      if (name === "inv") this.renderInv();
      if (name === "craft") this.renderCraft();
      if (this.game) this.game.paused = true;
    }
  }

  close(name) {
    this.panels[name]?.classList.add("hidden");
    if (this.game && !this.anyOpen()) this.game.paused = false;
  }

  closeAll() {
    Object.values(this.panels).forEach((p) => p?.classList.add("hidden"));
    if (this.game) this.game.paused = false;
  }

  anyOpen() {
    return Object.values(this.panels).some((p) => p && !p.classList.contains("hidden"));
  }

  showLevel(level) {
    const el = document.getElementById("level-msg");
    if (el) el.textContent = `Level ${level}. HP, stamina, and damage increased.`;
    this.panels.level?.classList.remove("hidden");
    if (this.game) this.game.paused = true;
  }

  showDeath() {
    this.panels.death?.classList.remove("hidden");
  }
  hideDeath() {
    this.panels.death?.classList.add("hidden");
  }

  dmg(sx, sy, text, crit = false, heal = false) {
    const layer = document.getElementById("dmg-layer");
    if (!layer) return;
    const el = document.createElement("div");
    el.className = "dmg-num" + (crit ? " crit" : "") + (heal ? " heal" : "");
    el.textContent = text;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  setInteract(show) {
    document.getElementById("interact-prompt")?.classList.toggle("hidden", !show);
  }

  sync() {
    const g = this.game;
    if (!g) return;
    const p = g.player;

    const setW = (id, pct) => {
      const el = document.getElementById(id);
      if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    };
    setW("hp-fill", (p.hp / p.maxHp) * 100);
    setW("stamina-fill", (p.stamina / p.maxStamina) * 100);
    const need = xpFor(p.level);
    setW("xp-fill", (p.xp / need) * 100);

    const hpT = document.getElementById("hp-text");
    const stT = document.getElementById("stamina-text");
    const xpT = document.getElementById("xp-text");
    if (hpT) hpT.textContent = String(Math.ceil(p.hp));
    if (stT) stT.textContent = String(Math.ceil(p.stamina));
    if (xpT) xpT.textContent = `LV ${p.level}`;

    const gold = document.getElementById("gold-text");
    const eq = document.getElementById("eq-text");
    if (gold) gold.textContent = String(p.gold);
    if (eq) eq.textContent = ITEMS[p.equipped]?.name || "—";

    const maxCd = [4, 6, 7, 5];
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`cd${i}`);
      if (!el) continue;
      const cd = p.skillCd[i];
      el.style.transform = cd > 0 ? `scaleY(${Math.min(1, cd / maxCd[i])})` : "scaleY(0)";
    }
  }

  renderInv() {
    const grid = document.getElementById("inv-grid");
    if (!grid || !this.game) return;
    const p = this.game.player;
    grid.innerHTML = "";
    const keys = Object.keys(p.inv).filter((k) => (p.inv[k] || 0) > 0);
    for (let i = 0; i < 20; i++) {
      const cell = document.createElement("div");
      cell.className = "inv-cell";
      const id = keys[i];
      if (id) {
        const def = ITEMS[id];
        const im = document.createElement("img");
        im.src = `assets/px/items/${id}.png`;
        im.alt = def.name;
        cell.appendChild(im);
        if (p.inv[id] > 1) {
          const q = document.createElement("span");
          q.className = "qty";
          q.textContent = String(p.inv[id]);
          cell.appendChild(q);
        }
        cell.title = def.name;
        if (def.weapon && p.equipped === id) cell.classList.add("equipped");
        if (def.weapon) cell.addEventListener("click", () => this.game.equip(id));
      }
      grid.appendChild(cell);
    }
  }

  renderCraft() {
    const list = document.getElementById("craft-list");
    if (!list || !this.game) return;
    const p = this.game.player;
    list.innerHTML = "";
    for (const r of RECIPES) {
      const def = ITEMS[r.result];
      const ok = canCraft(p.inv, r);
      const need = Object.entries(r.need)
        .map(([k, n]) => {
          const have = p.inv[k] || 0;
          return `<span class="${have >= n ? "ok" : "need"}">${ITEMS[k].name} ${have}/${n}</span>`;
        })
        .join(" · ");
      const row = document.createElement("div");
      row.className = "craft-row";
      row.innerHTML = `
        <img src="assets/px/items/${r.result}.png" alt="" />
        <div><h3>${def.name}</h3><p>${r.desc || ""}</p><p>${need}</p></div>
        <button class="craft-btn" ${ok ? "" : "disabled"}>Craft</button>`;
      row.querySelector("button").addEventListener("click", () => this.game.craft(r.id));
      list.appendChild(row);
    }
  }
}
