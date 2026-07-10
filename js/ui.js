import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";
import { QUESTS } from "./quests.js";
import { CLASSES } from "./classes.js";
import { RODS, activeRod } from "./fishing.js";

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
  bind(g) { this.game = g; this.renderSkillbar(); this.sync(); }

  renderSkillbar() {
    if (!this.game) return;
    const classId = this.game.player.cls || "warrior";
    const loadout = CLASSES[classId] || CLASSES.warrior;
    document.querySelectorAll("#skillbar .sk[data-i]").forEach((button) => {
      const skill = loadout.skills[Number(button.dataset.i)];
      const label = button.querySelector(".sk-name");
      if (label && skill) label.textContent = skill.name;
      if (skill) button.title = `${skill.name} — ${skill.desc}`;
      button.dataset.class = classId;
    });
    this._skillClass = classId;
  }

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
    if (this._skillClass !== p.cls) this.renderSkillbar();
    const clampP = v => Math.max(0, Math.min(100, v));
    const setW = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = clampP(pct) + "%"; };
    setW("hp-fill", p.hp / p.maxHp * 100); setW("stamina-fill", p.stamina / p.maxStamina * 100); setW("xp-fill", p.xp / xpFor(p.level) * 100);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("hp-text", Math.max(0, Math.ceil(p.hp))); set("stamina-text", Math.ceil(p.stamina));
    set("xp-text", "LV " + p.level); set("gold-text", p.gold); set("eq-text", ITEMS[p.equipped]?.name || "—");
    const maxCd = (CLASSES[p.cls] || CLASSES.warrior).skills.map((skill) => skill.cd);
    for (let i = 0; i < 4; i++) { const el = document.getElementById("cd" + i); if (el) { const cd = p.skillCd[i]; el.style.transform = cd > 0 ? `scaleY(${Math.min(1, cd / maxCd[i])})` : "scaleY(0)"; } }
    this.syncBoss(g.boss);
    this.syncFishing(g.fishing);
  }

  syncBoss(boss) {
    const hud = document.getElementById("boss-hud"); if (!hud) return;
    const visible = !!boss && !boss.dead;
    hud.classList.toggle("hidden", !visible);
    if (!visible) { hud.classList.remove("rage"); return; }
    const pct = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    hud.classList.toggle("rage", !!boss.rage);
    const fill = document.getElementById("boss-health-fill"); if (fill) fill.style.width = `${pct * 100}%`;
    const hp = document.getElementById("boss-health-text"); if (hp) hp.textContent = `${Math.ceil(boss.hp)} / ${boss.maxHp} HP`;
    const phase = document.getElementById("boss-phase"); if (phase) phase.textContent = boss.rage ? "PHASE II · RAGE" : "PHASE I · AWAKENED";
    const state = document.getElementById("boss-state"); if (state) state.textContent = boss.rage ? "Firestorm active" : pct < .7 ? "Oni guard is cracking" : "Break the oni guard";
    const distance = document.getElementById("boss-distance");
    if (distance && this.game?.player) distance.textContent = `${Math.round(Math.hypot(boss.x - this.game.player.x, boss.y - this.game.player.y) / 24)} tiles`;
  }

  syncFishing(fishing) {
    const hud = document.getElementById("fishing-hud"); if (!hud) return;
    hud.classList.toggle("hidden", !fishing);
    document.getElementById("hud")?.classList.toggle("fishing-active", !!fishing);
    if (!fishing) return;
    const progress = Math.max(0, Math.min(1, fishing.progress || 0));
    const tension = Math.max(0, Math.min(1, fishing.tension || 0));
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    const state = fishing.state === "bite" ? "BITE — HOOK IT!" : fishing.state === "hooked" ? "FISH ON THE LINE" : "LINE CAST";
    set("fishing-state", state);
    set("fishing-condition", fishing.context?.condition || "Reading the water");
    set("fishing-progress-text", `${Math.round(progress * 100)}%`);
    set("fishing-tension-text", tension > .82 ? "DANGER" : tension > .62 ? "HIGH" : tension > .27 ? "STABLE" : "SLACK");
    set("fishing-tip", fishing.tip || (fishing.state === "bite" ? "Tap F now to set the hook!" : fishing.state === "hooked" ? "Hold F to reel · release during a surge" : "Wait for the bobber to dive…"));
    const progressEl = document.getElementById("fishing-progress"); if (progressEl) progressEl.style.width = `${progress * 100}%`;
    const tensionEl = document.getElementById("fishing-tension"); if (tensionEl) tensionEl.style.width = `${tension * 100}%`;
  }

  renderInv() {
    const grid = document.getElementById("inv-grid"); if (!grid || !this.game) return;
    const p = this.game.player; grid.innerHTML = "";
    const keys = Object.keys(p.inv).filter(k => (p.inv[k] || 0) > 0);
    for (let i = 0; i < 20; i++) {
      const cell = document.createElement("div"); cell.className = "inv-cell";
      const id = keys[i];
      if (id) {
        const item = ITEMS[id] || { name: id, glyph: "?" };
        cell.innerHTML = `<span class="inv-glyph">${item.glyph || "?"}</span><span class="inv-name">${item.name}</span>`;
        if (p.inv[id] > 1) { const q = document.createElement("span"); q.className = "qty"; q.textContent = p.inv[id]; cell.appendChild(q); }
        if (ITEMS[id]?.weapon) { cell.classList.add("weapon"); if (p.equipped === id) cell.classList.add("equipped"); cell.addEventListener("click", () => this.game.equip(id)); }
      }
      grid.appendChild(cell);
    }
  }
  renderCraft() {
    const list = document.getElementById("craft-list"); if (!list || !this.game) return;
    const p = this.game.player; list.innerHTML = "";
    const current = this.game.WEAPONS[p.equipped];
    const rod = activeRod(p.inv);
    const summary = document.getElementById("forge-summary");
    if (summary) {
      summary.className = "forge-summary";
      summary.innerHTML = `<div><span>Traveler class</span><b>${CLASSES[p.cls]?.name || "Warrior"}</b></div><div><span>Equipped weapon</span><b>${ITEMS[p.equipped]?.name || "Fist"}</b></div><div><span>Active fishing rod</span><b>${rod.name}</b></div>`;
    }
    let group = "";
    for (const r of RECIPES) {
      if (r.group !== group) {
        group = r.group;
        const heading = document.createElement("h3"); heading.className = "craft-group-title"; heading.textContent = group; list.appendChild(heading);
      }
      const ok = canCraft(p.inv, r);
      const item = ITEMS[r.result];
      const recommended = r.classId === p.cls;
      const need = Object.entries(r.need).map(([k, n]) => { const have = p.inv[k] || 0; return `<span title="${ITEMS[k].source || "Explore the wilds"}" class="${have >= n ? "ok" : "need"}">${ITEMS[k].name} ${have}/${n}</span>`; }).join(" · ");
      const missing = Object.entries(r.need).find(([k, n]) => (p.inv[k] || 0) < n);
      const weapon = this.game.WEAPONS[r.result];
      const rodStats = RODS[r.result];
      let stats = "";
      if (weapon) {
        const delta = current ? weapon.dmg - current.dmg : 0;
        stats = `<p class="craft-stats"><span>DMG ${weapon.dmg}${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}</span><span>RNG ${weapon.range}</span><span>RATE ${(1 / weapon.speed).toFixed(1)}/s</span></p>`;
      } else if (rodStats) stats = `<p class="craft-stats"><span>CONTROL +${Math.round(rodStats.control * 100)}</span><span>LUCK +${Math.round(rodStats.luck * 100)}</span><span>REEL ×${rodStats.reel}</span></p>`;
      const className = r.classId === "all" ? "All classes" : CLASSES[r.classId]?.name || r.classId;
      const owned = (p.inv[r.result] || 0) > 0;
      const row = document.createElement("div"); row.className = `craft-row${recommended ? " recommended" : ""}`;
      row.innerHTML = `<div class="craft-rune">${item.glyph || "?"}</div><div class="craft-info"><h3>${item.name}<span class="craft-badges"><span class="craft-badge">T${r.tier}</span><span class="craft-badge class">${className}</span></span></h3><p>${r.desc}</p>${stats}<p>${need}</p>${missing ? `<p class="missing-source">Find ${ITEMS[missing[0]].name}: ${ITEMS[missing[0]].source || "explore and hunt"}</p>` : ""}</div><div class="craft-actions"><button class="craft-btn" ${ok ? "" : "disabled"}>Forge</button>${item.weapon ? `<button class="craft-equip" ${owned && p.equipped !== r.result ? "" : "disabled"}>${p.equipped === r.result ? "Equipped" : "Equip"}</button>` : owned ? `<button class="craft-equip" disabled>Owned ×${p.inv[r.result]}</button>` : ""}</div>`;
      row.querySelector(".craft-btn")?.addEventListener("click", () => this.game.craft(r.id));
      row.querySelector(".craft-equip")?.addEventListener("click", () => this.game.equip(r.result));
      list.appendChild(row);
    }
  }
}
