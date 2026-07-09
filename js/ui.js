import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";
import { QUESTS } from "./quests.js";

export class UI {
  constructor(audio) {
    this.game = null;
    this.audio = audio || null;
    this.panels = {
      inv: document.getElementById("panel-inv"),
      craft: document.getElementById("panel-craft"),
      quest: document.getElementById("panel-quest"),
      dialog: document.getElementById("panel-dialog"),
      settings: document.getElementById("panel-settings"),
      level: document.getElementById("panel-level"),
      pet: document.getElementById("panel-pet"),
      death: document.getElementById("death-screen"),
    };
    document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { this.audio?.sfx("ui"); this.close(b.dataset.close); }));
    document.getElementById("btn-level-ok")?.addEventListener("click", () => { this.panels.level.classList.add("hidden"); if (this.game) this.game.paused = false; });
    document.getElementById("btn-respawn")?.addEventListener("click", () => this.game?.respawn());
    document.getElementById("btn-inv-hot")?.addEventListener("click", () => this.toggle("inv"));
    document.getElementById("btn-craft-hot")?.addEventListener("click", () => this.toggle("craft"));
    document.getElementById("btn-quest-hot")?.addEventListener("click", () => this.toggle("quest"));
    this._petCb = null;
    document.getElementById("btn-pet-ok")?.addEventListener("click", () => { this.panels.pet.classList.add("hidden"); if (this.game) this.game.paused = false; if (this._petCb) this._petCb(); });
  }
  bind(g) { this.game = g; }

  toast(msg) {
    const el = document.getElementById("toast"); if (!el) return;
    el.textContent = msg; el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    clearTimeout(this._t); this._t = setTimeout(() => el.classList.remove("show"), 1700);
  }
  toggle(name) {
    const p = this.panels[name]; if (!p) return;
    this.audio?.sfx("ui");
    const open = p.classList.contains("hidden"); this.closeAll();
    if (open) { p.classList.remove("hidden"); if (name === "inv") this.renderInv(); if (name === "craft") this.renderCraft(); if (name === "quest") this.renderQuestLog(); if (this.game) this.game.paused = true; }
  }
  close(name) { this.panels[name]?.classList.add("hidden"); if (this.game && !this.anyOpen()) this.game.paused = false; }
  closeAll() { for (const k of ["inv", "craft", "quest", "dialog", "settings"]) this.panels[k]?.classList.add("hidden"); if (this.game && !this.anyOpen()) this.game.paused = false; }
  anyOpen() { return ["inv", "craft", "quest", "dialog", "settings", "level", "pet", "death"].some(k => this.panels[k] && !this.panels[k].classList.contains("hidden")); }

  showLevel(lv) { const el = document.getElementById("level-msg"); if (el) el.textContent = `Level ${lv}! Max HP, stamina and damage increased.`; this.panels.level?.classList.remove("hidden"); if (this.game) this.game.paused = true; }
  showDeath() { this.panels.death?.classList.remove("hidden"); }
  hideDeath() { this.panels.death?.classList.add("hidden"); }
  showPet(id, cb) {
    this._petCb = cb;
    this.audio?.sfx("pet");
    const im = document.getElementById("pet-img");
    if (im && this.game && this.game.monCache[id]) { im.src = this.game.monCache[id][0].toDataURL(); }
    const msg = document.getElementById("pet-msg"); if (msg) msg.textContent = `A wild ${id} appeared! It wants to join you.`;
    this.panels.pet?.classList.remove("hidden"); if (this.game) this.game.paused = true;
  }

  showDialog(npc, game) {
    this.closeAll();
    document.getElementById("dialog-name").textContent = npc.role ? `${npc.name} · ${npc.role}` : npc.name;
    document.getElementById("dialog-text").textContent = npc.line || "Well met, traveler.";
    const wrap = document.getElementById("dialog-quests"); wrap.innerHTML = "";
    const list = game.quests.forGiver(npc.name, game.player.inv);
    for (const it of list) {
      const row = document.createElement("div"); row.className = "quest-row";
      let btn = "";
      if (it.done) { row.classList.add("done"); btn = `<span class="q-status done">✓ Done</span>`; }
      else if (it.ready) btn = `<button class="q-btn ready" data-turnin="${it.q.id}">Turn In</button>`;
      else if (it.active) btn = `<span class="q-status">${it.progress}/${it.q.target}</span>`;
      else btn = `<button class="q-btn" data-accept="${it.q.id}">Accept</button>`;
      const rw = it.q.reward;
      const rwt = `${rw.gold ? rw.gold + "g " : ""}${rw.xp ? rw.xp + "xp " : ""}${rw.item ? (ITEMS[rw.item]?.name || rw.item) : ""}`;
      row.innerHTML = `<div class="q-info"><h4>${it.q.title}</h4><p>${it.q.desc}</p><p class="q-reward">Reward: ${rwt}</p></div>${btn}`;
      wrap.appendChild(row);
    }
    wrap.querySelectorAll("[data-accept]").forEach(b => b.addEventListener("click", () => {
      const q = QUESTS.find(x => x.id === b.dataset.accept);
      if (game.quests.accept(q)) { this.audio?.sfx("quest"); this.toast("Quest accepted: " + q.title); this.showDialog(npc, game); }
    }));
    wrap.querySelectorAll("[data-turnin]").forEach(b => b.addEventListener("click", () => {
      const q = QUESTS.find(x => x.id === b.dataset.turnin);
      const r = game.quests.complete(q, game.player);
      if (r) { this.audio?.sfx("quest"); this.toast(`Quest complete! +${r.gold || 0}g +${r.xp || 0}xp`); this.showDialog(npc, game); this.sync(); }
    }));
    this.panels.dialog?.classList.remove("hidden");
    if (this.game) this.game.paused = true;
  }

  renderQuestLog() {
    const wrap = document.getElementById("quest-list"); if (!wrap || !this.game) return;
    wrap.innerHTML = "";
    const q = this.game.quests;
    const active = Object.values(q.active);
    if (!active.length) { wrap.innerHTML = `<p style="color:var(--muted)">No active quests. Talk to NPCs at camp (look for <b style="color:#ffe070">!</b>).</p>`; return; }
    for (const a of active) {
      const it = a.quest;
      let prog = 0;
      if (it.type === "kill") prog = Math.min(it.target, q.killCount - a.startKills);
      else if (it.type === "chest") prog = Math.min(it.target, q.chestCount - a.startChests);
      else prog = Math.min(it.target, this.game.player.inv[it.item] || 0);
      const row = document.createElement("div"); row.className = "quest-row";
      row.innerHTML = `<div class="q-info"><h4>${it.title} <span style="color:var(--muted);font-weight:400">· ${it.giver}</span></h4><p>${it.desc}</p><div class="q-prog"><div class="q-prog-fill" style="width:${prog / it.target * 100}%"></div></div></div><span class="q-status">${prog}/${it.target}</span>`;
      wrap.appendChild(row);
    }
  }

  dmg(sx, sy, text, crit, heal) {
    const layer = document.getElementById("dmg-layer"); if (!layer) return;
    const el = document.createElement("div");
    el.className = "dmg-num" + (crit ? " crit" : "") + (heal ? " heal" : "");
    el.textContent = text; el.style.left = sx + "px"; el.style.top = sy + "px";
    layer.appendChild(el); setTimeout(() => el.remove(), 700);
  }
  setInteract(show, label) {
    document.getElementById("interact-prompt")?.classList.toggle("hidden", !show);
    const lb = document.getElementById("interact-label"); if (lb && label) lb.textContent = label;
  }

  sync() {
    const g = this.game; if (!g) return; const p = g.player;
    const clampP = v => Math.max(0, Math.min(100, v));
    const setW = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = clampP(pct) + "%"; };
    setW("hp-fill", p.hp / p.maxHp * 100); setW("stamina-fill", p.stamina / p.maxStamina * 100); setW("xp-fill", p.xp / xpFor(p.level) * 100);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("hp-text", Math.max(0, Math.ceil(p.hp))); set("stamina-text", Math.ceil(p.stamina));
    set("xp-text", "LV " + p.level); set("gold-text", p.gold); set("eq-text", ITEMS[p.equipped]?.name || "—");
    const maxCd = [4, 6, 7, 5];
    for (let i = 0; i < 4; i++) { const el = document.getElementById("cd" + i); if (el) { const cd = p.skillCd[i]; el.style.transform = cd > 0 ? `scaleY(${Math.min(1, cd / maxCd[i])})` : "scaleY(0)"; } }
  }

  renderInv() {
    const grid = document.getElementById("inv-grid"); if (!grid || !this.game) return;
    const p = this.game.player; grid.innerHTML = "";
    const keys = Object.keys(p.inv).filter(k => (p.inv[k] || 0) > 0);
    for (let i = 0; i < 20; i++) {
      const cell = document.createElement("div"); cell.className = "inv-cell";
      const id = keys[i];
      if (id) {
        cell.innerHTML = `<span class="inv-name">${ITEMS[id]?.name || id}</span>`;
        if (p.inv[id] > 1) { const q = document.createElement("span"); q.className = "qty"; q.textContent = p.inv[id]; cell.appendChild(q); }
        if (ITEMS[id]?.weapon) { cell.classList.add("weapon"); if (p.equipped === id) cell.classList.add("equipped"); cell.addEventListener("click", () => this.game.equip(id)); }
      }
      grid.appendChild(cell);
    }
  }
  renderCraft() {
    const list = document.getElementById("craft-list"); if (!list || !this.game) return;
    const p = this.game.player; list.innerHTML = "";
    for (const r of RECIPES) {
      const ok = canCraft(p.inv, r);
      const need = Object.entries(r.need).map(([k, n]) => { const have = p.inv[k] || 0; return `<span class="${have >= n ? "ok" : "need"}">${ITEMS[k].name} ${have}/${n}</span>`; }).join(" · ");
      const row = document.createElement("div"); row.className = "craft-row";
      row.innerHTML = `<div class="craft-info"><h3>${ITEMS[r.result].name}</h3><p>${r.desc}</p><p>${need}</p></div><button class="craft-btn" ${ok ? "" : "disabled"}>Forge</button>`;
      row.querySelector("button").addEventListener("click", () => this.game.craft(r.id));
      list.appendChild(row);
    }
  }
}
