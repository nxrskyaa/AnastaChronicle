import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";

export class UI {
  constructor() {
    this.game = null;
    this.panels = {
      inv: document.getElementById("panel-inv"),
      craft: document.getElementById("panel-craft"),
      level: document.getElementById("panel-level"),
      pet: document.getElementById("panel-pet"),
      death: document.getElementById("death-screen"),
    };
    document.querySelectorAll("[data-close]").forEach((b) =>
      b.addEventListener("click", () => this.close(b.dataset.close)));
    document.getElementById("btn-level-ok")?.addEventListener("click", () => { this.panels.level.classList.add("hidden"); if (this.game) this.game.paused = false; });
    document.getElementById("btn-respawn")?.addEventListener("click", () => this.game?.respawn());
    document.getElementById("btn-inv-hot")?.addEventListener("click", () => this.toggle("inv"));
    document.getElementById("btn-craft-hot")?.addEventListener("click", () => this.toggle("craft"));
    this._petCb = null;
    document.getElementById("btn-pet-ok")?.addEventListener("click", () => { this.panels.pet.classList.add("hidden"); if (this.game) this.game.paused = false; if (this._petCb) this._petCb(); });
  }
  bind(g) { this.game = g; }

  toast(msg) {
    const el = document.getElementById("toast"); if (!el) return;
    el.textContent = msg; el.classList.add("show");
    clearTimeout(this._t); this._t = setTimeout(() => el.classList.remove("show"), 1600);
  }
  toggle(name) {
    const p = this.panels[name]; if (!p) return;
    const open = p.classList.contains("hidden"); this.closeAll();
    if (open) { p.classList.remove("hidden"); if (name==="inv") this.renderInv(); if (name==="craft") this.renderCraft(); if (this.game) this.game.paused = true; }
  }
  close(name) { this.panels[name]?.classList.add("hidden"); if (this.game && !this.anyOpen()) this.game.paused = false; }
  closeAll() { for (const k of ["inv","craft"]) this.panels[k]?.classList.add("hidden"); if (this.game && !this.anyOpen()) this.game.paused = false; }
  anyOpen() { return ["inv","craft","level","pet","death"].some(k => this.panels[k] && !this.panels[k].classList.contains("hidden")); }

  showLevel(lv) { const el=document.getElementById("level-msg"); if(el) el.textContent=`Level ${lv}! Max HP, stamina and damage increased.`; this.panels.level?.classList.remove("hidden"); if(this.game) this.game.paused=true; }
  showDeath() { this.panels.death?.classList.remove("hidden"); }
  hideDeath() { this.panels.death?.classList.add("hidden"); }
  showPet(id, cb) {
    this._petCb = cb;
    const im = document.getElementById("pet-img"); if (im) im.src = `assets/tux/pet/${id}.png`;
    const msg = document.getElementById("pet-msg"); if (msg) msg.textContent = `A wild ${id} popped out of the chest! It wants to join you.`;
    this.panels.pet?.classList.remove("hidden"); if (this.game) this.game.paused = true;
  }

  dmg(sx, sy, text, crit, heal) {
    const layer = document.getElementById("dmg-layer"); if (!layer) return;
    const el = document.createElement("div");
    el.className = "dmg-num" + (crit?" crit":"") + (heal?" heal":"");
    el.textContent = text; el.style.left = sx+"px"; el.style.top = sy+"px";
    layer.appendChild(el); setTimeout(() => el.remove(), 700);
  }
  setInteract(show, label) {
    const el = document.getElementById("interact-prompt");
    el?.classList.toggle("hidden", !show);
    const lb = document.getElementById("interact-label"); if (lb && label) lb.textContent = label;
  }

  sync() {
    const g = this.game; if (!g) return; const p = g.player;
    const setW = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = clamp(pct)+"%"; };
    function clamp(v){return Math.max(0,Math.min(100,v));}
    setW("hp-fill", p.hp/p.maxHp*100);
    setW("stamina-fill", p.stamina/p.maxStamina*100);
    setW("xp-fill", p.xp/xpFor(p.level)*100);
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set("hp-text", Math.max(0, Math.ceil(p.hp))); set("stamina-text", Math.ceil(p.stamina));
    set("xp-text", "LV "+p.level); set("gold-text", p.gold);
    set("eq-text", ITEMS[p.equipped]?.name || "—");
    const maxCd=[4,6,7,5];
    for(let i=0;i<4;i++){const el=document.getElementById("cd"+i); if(el){const cd=p.skillCd[i]; el.style.transform=cd>0?`scaleY(${Math.min(1,cd/maxCd[i])})`:"scaleY(0)";}}
  }

  renderInv() {
    const grid = document.getElementById("inv-grid"); if (!grid || !this.game) return;
    const p = this.game.player; grid.innerHTML = "";
    const keys = Object.keys(p.inv).filter(k => (p.inv[k]||0) > 0);
    for (let i = 0; i < 20; i++) {
      const cell = document.createElement("div"); cell.className = "inv-cell";
      const id = keys[i];
      if (id) {
        cell.innerHTML = `<span class="inv-name">${ITEMS[id]?.name||id}</span>`;
        if (p.inv[id] > 1) { const q=document.createElement("span"); q.className="qty"; q.textContent=p.inv[id]; cell.appendChild(q); }
        if (ITEMS[id]?.weapon) { cell.classList.add("weapon"); if (p.equipped===id) cell.classList.add("equipped"); cell.addEventListener("click", () => this.game.equip(id)); }
      }
      grid.appendChild(cell);
    }
  }
  renderCraft() {
    const list = document.getElementById("craft-list"); if (!list || !this.game) return;
    const p = this.game.player; list.innerHTML = "";
    for (const r of RECIPES) {
      const ok = canCraft(p.inv, r);
      const need = Object.entries(r.need).map(([k,n]) => { const have=p.inv[k]||0; return `<span class="${have>=n?"ok":"need"}">${ITEMS[k].name} ${have}/${n}</span>`; }).join(" · ");
      const row = document.createElement("div"); row.className = "craft-row";
      row.innerHTML = `<div class="craft-info"><h3>${ITEMS[r.result].name}</h3><p>${r.desc}</p><p>${need}</p></div><button class="craft-btn" ${ok?"":"disabled"}>Forge</button>`;
      row.querySelector("button").addEventListener("click", () => this.game.craft(r.id));
      list.appendChild(row);
    }
  }
}
