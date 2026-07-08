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
  }

  bind(game) {
    this.game = game;
  }

  toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.remove("show"), 1600);
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
    document.getElementById("level-msg").textContent =
      `Level ${level}. Max HP, stamina and base damage increased.`;
    this.panels.level.classList.remove("hidden");
    if (this.game) this.game.paused = true;
  }

  showDeath() {
    this.panels.death.classList.remove("hidden");
  }
  hideDeath() {
    this.panels.death.classList.add("hidden");
  }

  dmg(sx, sy, text, crit = false, heal = false) {
    const layer = document.getElementById("dmg-layer");
    const el = document.createElement("div");
    el.className = "dmg-num" + (crit ? " crit" : "") + (heal ? " heal" : "");
    el.textContent = text;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 750);
  }

  setInteract(show) {
    document.getElementById("interact-prompt").classList.toggle("hidden", !show);
  }

  sync() {
    const g = this.game;
    if (!g) return;
    const p = g.player;
    document.getElementById("hp-fill").style.height = `${(p.hp / p.maxHp) * 100}%`;
    document.getElementById("stamina-fill").style.height = `${(p.stamina / p.maxStamina) * 100}%`;
    document.getElementById("hp-text").textContent = Math.ceil(p.hp);
    document.getElementById("stamina-text").textContent = Math.ceil(p.stamina);

    const hearts = document.getElementById("hearts");
    const maxH = 10;
    const filled = Math.ceil((p.hp / p.maxHp) * maxH);
    if (hearts.childElementCount !== maxH) {
      hearts.innerHTML = "";
      for (let i = 0; i < maxH; i++) {
        const d = document.createElement("div");
        d.className = "heart";
        hearts.appendChild(d);
      }
    }
    [...hearts.children].forEach((h, i) => h.classList.toggle("empty", i >= filled));

    const need = xpFor(p.level);
    document.getElementById("xp-fill").style.width = `${Math.min(100, (p.xp / need) * 100)}%`;
    document.getElementById("xp-text").textContent = `Lv ${p.level}  ·  ${p.xp}/${need}`;
    document.getElementById("gold-text").textContent = String(p.gold);
    document.getElementById("eq-text").textContent = ITEMS[p.equipped]?.name || "—";

    const maxCd = [4, 6, 7, 5];
    for (let i = 0; i < 4; i++) {
      const cd = p.skillCd[i];
      const el = document.getElementById(`cd${i}`);
      if (el) el.style.transform = cd > 0 ? `scaleY(${cd / maxCd[i]})` : "scaleY(0)";
    }
  }

  renderInv() {
    const grid = document.getElementById("inv-grid");
    const p = this.game.player;
    grid.innerHTML = "";
    const keys = Object.keys(p.inv).filter((k) => (p.inv[k] || 0) > 0);
    for (let i = 0; i < 20; i++) {
      const cell = document.createElement("div");
      cell.className = "inv-cell";
      const id = keys[i];
      if (id) {
        const def = ITEMS[id];
        cell.innerHTML = `<span>${def.icon}</span><span class="qty">${p.inv[id] > 1 ? p.inv[id] : ""}</span>`;
        cell.title = def.name;
        if (def.weapon && p.equipped === id) cell.classList.add("equipped");
        if (def.weapon) cell.addEventListener("click", () => this.game.equip(id));
      }
      grid.appendChild(cell);
    }
  }

  renderCraft() {
    const list = document.getElementById("craft-list");
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
        <div class="ico">${def.icon}</div>
        <div><h3>${def.name}</h3><p>${r.desc}</p><p>${need}</p></div>
        <button class="craft-btn" ${ok ? "" : "disabled"}>Craft</button>`;
      row.querySelector("button").addEventListener("click", () => this.game.craft(r.id));
      list.appendChild(row);
    }
  }
}
