import { ITEMS, RECIPES, canCraft } from "./crafting.js";
import { img } from "./assets.js";

export class UI {
  constructor() {
    this.toastT = 0;
    this.panels = {
      inv: document.getElementById("panel-inv"),
      craft: document.getElementById("panel-craft"),
      level: document.getElementById("panel-level"),
      death: document.getElementById("death-screen"),
    };
    document.querySelectorAll("[data-close]").forEach((b) => {
      b.addEventListener("click", () => this.close(b.dataset.close));
    });
    document.getElementById("btn-level-ok")?.addEventListener("click", () => {
      this.panels.level.classList.add("hidden");
      if (this.game) this.game.paused = false;
    });
    document.getElementById("btn-respawn")?.addEventListener("click", () => {
      this.game?.respawn();
    });
  }

  bind(game) {
    this.game = game;
  }

  toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove("show"), 1600);
  }

  toggle(name) {
    const p = this.panels[name];
    if (!p) return;
    const open = p.classList.contains("hidden");
    this.closeAll();
    if (open) {
      p.classList.remove("hidden");
      if (name === "inv") this.renderInv(this.game);
      if (name === "craft") this.renderCraft(this.game);
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

  showLevelUp(level) {
    const p = this.panels.level;
    document.getElementById("level-msg").textContent =
      `You reached Level ${level}. Max HP & stamina increased. Base damage up.`;
    p.classList.remove("hidden");
    if (this.game) this.game.paused = true;
  }

  showDeath() {
    this.panels.death.classList.remove("hidden");
  }

  hideDeath() {
    this.panels.death.classList.add("hidden");
  }

  spawnDmg(game, worldX, worldY, text, crit, heal) {
    const layer = document.getElementById("dmg-layer");
    if (!layer) return;
    const el = document.createElement("div");
    el.className = "dmg-num" + (crit ? " crit" : "") + (heal ? " heal" : "");
    el.textContent = text;
    // convert world -> hud space
    const SCALE = 3;
    const sx = (worldX - game.cam.x) * SCALE;
    const sy = (worldY - game.cam.y) * SCALE;
    const canvas = game.canvas;
    const wrap = document.getElementById("hud");
    const ratioX = wrap.clientWidth / canvas.width;
    const ratioY = wrap.clientHeight / canvas.height;
    el.style.left = `${sx * ratioX}px`;
    el.style.top = `${sy * ratioY}px`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  sync(game) {
    const p = game.player;
    // HP orb
    const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
    const stPct = Math.max(0, p.stamina / p.maxStamina) * 100;
    document.getElementById("hp-fill").style.height = `${hpPct}%`;
    document.getElementById("stamina-fill").style.height = `${stPct}%`;
    document.getElementById("hp-text").textContent = Math.ceil(p.hp);
    document.getElementById("stamina-text").textContent = Math.ceil(p.stamina);

    // hearts (10 pips max display scaled)
    const hearts = document.getElementById("hearts");
    const maxHearts = 10;
    const filled = Math.ceil((p.hp / p.maxHp) * maxHearts);
    if (hearts.childElementCount !== maxHearts) {
      hearts.innerHTML = "";
      for (let i = 0; i < maxHearts; i++) {
        const im = document.createElement("img");
        im.alt = "";
        hearts.appendChild(im);
      }
    }
    [...hearts.children].forEach((im, i) => {
      im.src = i < filled ? "assets/ui/heart.png" : "assets/ui/heart_empty.png";
    });

    // xp
    const need = (level) => Math.floor(40 + level * 35 + level * level * 8);
    const xpNeed = need(p.level);
    const xpPct = Math.min(100, (p.xp / xpNeed) * 100);
    document.getElementById("xp-fill").style.width = `${xpPct}%`;
    document.getElementById("xp-text").textContent = `Lv ${p.level}  ·  ${p.xp}/${xpNeed}`;

    document.getElementById("gold-text").textContent = String(p.gold);

    // action bar icons
    const skills = [
      "items/sword",
      "items/herb",
      "items/axe",
      "ui/orb_stamina",
    ];
    for (let i = 0; i < 4; i++) {
      const icon = document.getElementById(`slot${i + 1}-icon`);
      const cdEl = document.getElementById(`slot${i + 1}-cd`);
      if (icon) icon.src = `assets/${skills[i]}.png`;
      if (cdEl) {
        const cd = p.skillCd[i];
        const max = [4, 6, 7, 5][i];
        cdEl.style.transform = cd > 0 ? `scaleY(${cd / max})` : "scaleY(0)";
      }
    }

    // equipped weapon on slot1 flash
    const eq = ITEMS[p.equipped];
    if (eq) {
      const s1 = document.getElementById("slot1-icon");
      // keep skill icons; equipped shown in inventory
    }
  }

  renderInv(game) {
    const grid = document.getElementById("inv-grid");
    if (!grid || !game) return;
    grid.innerHTML = "";
    const p = game.player;
    const keys = Object.keys(p.inv).filter((k) => (p.inv[k] || 0) > 0);
    // pad to 20 cells
    for (let i = 0; i < 20; i++) {
      const cell = document.createElement("div");
      cell.className = "inv-cell";
      const id = keys[i];
      if (id) {
        const def = ITEMS[id] || { name: id, icon: "items/wood" };
        const im = document.createElement("img");
        im.src = `assets/${def.icon}.png`;
        im.alt = def.name;
        cell.appendChild(im);
        const qty = document.createElement("span");
        qty.className = "qty";
        qty.textContent = p.inv[id] > 1 ? String(p.inv[id]) : "";
        cell.appendChild(qty);
        cell.title = def.name + (def.weapon ? " (click to equip)" : "");
        if (def.weapon && p.equipped === id) cell.classList.add("equipped");
        if (def.weapon) {
          cell.addEventListener("click", () => game.equip(id));
        }
      }
      grid.appendChild(cell);
    }
  }

  renderCraft(game) {
    const list = document.getElementById("craft-list");
    if (!list || !game) return;
    list.innerHTML = "";
    for (const r of RECIPES) {
      const row = document.createElement("div");
      row.className = "craft-row";
      const def = ITEMS[r.result];
      const ok = canCraft(game.player.inv, r);
      const needStr = Object.entries(r.need)
        .map(([k, n]) => {
          const have = game.player.inv[k] || 0;
          const cls = have >= n ? "ok" : "need";
          return `<span class="${cls}">${ITEMS[k]?.name || k} ${have}/${n}</span>`;
        })
        .join(" · ");
      row.innerHTML = `
        <img src="assets/${def.icon}.png" alt="" />
        <div>
          <h3>${def.name}</h3>
          <p>${r.desc}</p>
          <p>${needStr}</p>
        </div>
        <button class="craft-btn" ${ok ? "" : "disabled"} data-craft="${r.id}">Craft</button>
      `;
      row.querySelector("button").addEventListener("click", () => game.doCraft(r.id));
      list.appendChild(row);
    }
  }
}
