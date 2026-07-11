import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";
import { QUESTS } from "./quests.js";
import { CLASSES } from "./classes.js";
import { FISH, RODS, activeRod } from "./fishing.js";
import { getFishSprite } from "./fishart.js";
import { img } from "./assets.js";
import { MON_IDS, MON_ELEMENT } from "./monsters.js";

const PET_COLORS = {
  grass: ["#baf39a", "#55b878"], fire: ["#ffd070", "#e45f3d"], water: ["#a4efff", "#4aa6d4"],
  rock: ["#ead9ae", "#987757"], electric: ["#fff49a", "#e5bd38"], bug: ["#eac2fa", "#a96fc2"],
  ice: ["#e8ffff", "#71cae2"], dark: ["#d1b4ff", "#6c4f9f"],
};
const petName = (id) => String(id || "companion").replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export class UI {
  constructor(audio) {
    this.game = null;
    this.audio = audio || null;
    this.panels = {
      inv: document.getElementById("panel-inv"),
      menu: document.getElementById("panel-menu"),
      chat: document.getElementById("panel-chat"),
      collection: document.getElementById("panel-collection"),
      craft: document.getElementById("panel-craft"),
      quest: document.getElementById("panel-quest"),
      companions: document.getElementById("panel-companions"),
      dialog: document.getElementById("panel-dialog"),
      settings: document.getElementById("panel-settings"),
      level: document.getElementById("panel-level"),
      pet: document.getElementById("panel-pet"),
      death: document.getElementById("death-screen"),
    };
    this.chatHistory = [];
    this.chatUnread = 0;
    this.online = false;
    this.onlineCount = 1;
    this.duelActive = false;
    this._chatSender = null;
    this._duelSender = null;
    document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { this.audio?.sfx("ui"); this.close(b.dataset.close); }));
    document.getElementById("btn-level-ok")?.addEventListener("click", () => { this.panels.level.classList.add("hidden"); if (this.game && !this.hasBlockingOpen()) this.game.paused = false; });
    document.getElementById("btn-respawn")?.addEventListener("click", () => this.game?.respawn());
    document.getElementById("btn-inv-hot")?.addEventListener("click", () => this.toggle("inv"));
    document.getElementById("btn-craft-hot")?.addEventListener("click", () => this.toggle("craft"));
    document.getElementById("btn-quest-hot")?.addEventListener("click", () => this.toggle("quest"));
    document.getElementById("btn-realm-menu")?.addEventListener("click", () => this.toggle("menu"));
    document.getElementById("chat-dock")?.addEventListener("click", () => this.openChat());
    document.getElementById("pet-chip")?.addEventListener("click", () => this.toggle("companions"));
    document.getElementById("btn-cycle-pet")?.addEventListener("click", () => this.cyclePet());
    document.querySelectorAll("[data-open-panel]").forEach((button) => button.addEventListener("click", () => this.toggle(button.dataset.openPanel)));
    document.getElementById("duel-toggle")?.addEventListener("click", () => this.requestDuel(!this.duelActive));
    const chatInput = document.getElementById("chat-input");
    chatInput?.addEventListener("input", () => { const count = document.getElementById("chat-count"); if (count) count.textContent = `${chatInput.value.length}/160`; });
    document.getElementById("chat-form")?.addEventListener("submit", (event) => { event.preventDefault(); this.submitChat(); });
    document.addEventListener("keydown", (event) => {
      if (event.code !== "KeyP" || event.repeat || !this.game || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || "")) return;
      const sanctuaryOpen = !this.panels.companions?.classList.contains("hidden");
      if (this.anyOpen() && !sanctuaryOpen) return;
      event.preventDefault(); this.cyclePet();
    });
    document.addEventListener("keydown", (event) => {
      const tag = event.target?.tagName || "";
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag);
      if (event.code === "Escape" && this.anyOpen()) {
        if (typing) event.target.blur?.();
        this.closeAll();
        event.preventDefault();
        return;
      }
      if (typing) return;
      if (event.code === "Enter" && !event.repeat) {
        if (this.panels.level && !this.panels.level.classList.contains("hidden")) return;
        event.preventDefault(); this.openChat(true);
      }
      if (event.code === "KeyJ" && !event.repeat) { event.preventDefault(); this.toggle("collection"); }
    });
    this._petCb = null;
    document.getElementById("btn-pet-ok")?.addEventListener("click", () => {
      this.panels.pet.classList.add("hidden"); if (this.game) this.game.paused = false;
      const callback = this._petCb; this._petCb = null; if (callback) callback();
    });
  }
  bind(g) { this.game = g; this.renderSkillbar(); this.sync(); this.syncPet(true); }

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
      button.dataset.skill = skill?.id || "";
    });
    const className = loadout.name || "Warrior";
    const classPaths = { warrior: "VANGUARD", mage: "ARCANIST", archer: "RANGER" };
    const crest = className.charAt(0).toUpperCase();
    for (const id of ["status-class-crest", "menu-class-crest"]) { const el = document.getElementById(id); if (el) el.textContent = crest; }
    const statusClass = document.getElementById("status-class-name"); if (statusClass) statusClass.textContent = classPaths[classId] || className.toUpperCase();
    const menuPath = document.getElementById("menu-class-path"); if (menuPath) menuPath.textContent = `${classPaths[classId] || className.toUpperCase()} PATH`;
    document.getElementById("status-card")?.style.setProperty("--class-accent", loadout.color || "#5ec18e");
    this._skillClass = classId;
  }

  setChatSender(sender) { this._chatSender = typeof sender === "function" ? sender : null; }
  setDuelSender(sender) { this._duelSender = typeof sender === "function" ? sender : null; }

  setOnlineState(online, count = this.onlineCount) {
    this.online = !!online;
    this.onlineCount = Math.max(1, Number(count) || 1);
    const state = this.online ? `${this.onlineCount} traveler${this.onlineCount === 1 ? "" : "s"} online` : "Offline realm";
    for (const id of ["menu-online-state", "menu-chat-state", "chat-presence-text"]) { const el = document.getElementById(id); if (el) el.textContent = state; }
    document.getElementById("chat-presence-text")?.parentElement?.classList.toggle("online", this.online);
    const dock = document.getElementById("chat-dock"); if (dock) dock.dataset.online = this.online ? "true" : "false";
    if (!this.online) this.updateDuel(false);
  }

  updateDuel(active) {
    this.duelActive = !!active;
    const button = document.getElementById("duel-toggle");
    button?.setAttribute("aria-checked", String(this.duelActive));
    const label = document.getElementById("duel-toggle-label"); if (label) label.textContent = this.duelActive ? "DUEL ARMED" : "SAFE MODE";
    document.getElementById("hud")?.classList.toggle("duel-armed", this.duelActive);
  }

  requestDuel(active) {
    if (!this.online || !this._duelSender) { this.toast("Realm connection required for Duel Mode."); return; }
    if (!this._duelSender(!!active)) { this.toast("Duel request could not reach the realm."); return; }
    this.toast(active ? "Duel request armed. Damage needs mutual consent." : "Returning to Safe Mode...");
  }

  openChat(focus = false) {
    if (this.panels.chat?.classList.contains("hidden")) this.toggle("chat");
    this.game?.resetInputState?.();
    if (this.game) this.game.inputLocked = true;
    this.chatUnread = 0; this.syncUnread();
    setTimeout(() => document.getElementById("chat-input")?.focus(), focus ? 0 : 20);
  }

  submitChat() {
    const input = document.getElementById("chat-input"); if (!input) return;
    const text = input.value.replace(/\s+/g, " ").trim().slice(0, 160);
    if (!text) return;
    if (!this.online || !this._chatSender || !this._chatSender(text)) { this.toast("Realm chat is offline. Reconnecting..."); return; }
    input.value = "";
    const count = document.getElementById("chat-count"); if (count) count.textContent = "0/160";
  }

  receiveChat(message, self = false) {
    if (!message?.text) return;
    const normalized = {
      id: message.id || "realm", name: String(message.name || "Traveler").slice(0, 24),
      text: String(message.text).slice(0, 200), time: message.at || message.ts || Date.now(), self: !!self,
    };
    this.chatHistory.push(normalized);
    if (this.chatHistory.length > 80) this.chatHistory.shift();
    const preview = document.getElementById("chat-dock-preview"); if (preview) preview.textContent = `${normalized.name}: ${normalized.text}`;
    if (this.panels.chat?.classList.contains("hidden")) { this.chatUnread = Math.min(99, this.chatUnread + 1); this.syncUnread(); }
    else this.appendChatMessage(normalized);
  }

  receiveSystemChat(text) {
    const message = { system: true, text: String(text || "").slice(0, 200), time: Date.now() };
    this.chatHistory.push(message);
    if (!this.panels.chat?.classList.contains("hidden")) this.appendChatMessage(message);
  }

  syncUnread() {
    const badge = document.getElementById("chat-unread"); if (!badge) return;
    badge.textContent = this.chatUnread > 9 ? "9+" : String(this.chatUnread);
    badge.classList.toggle("hidden", this.chatUnread <= 0);
  }

  appendChatMessage(message) {
    const wrap = document.getElementById("chat-messages"); if (!wrap) return;
    wrap.querySelector(".chat-empty")?.remove();
    const row = document.createElement("div");
    if (message.system) {
      row.className = "chat-message system";
      const paragraph = document.createElement("p"); paragraph.textContent = message.text; row.appendChild(paragraph);
    } else {
      row.className = `chat-message${message.self ? " self" : ""}`;
      const avatar = document.createElement("div"); avatar.className = "chat-avatar";
      const initial = document.createElement("span"); initial.textContent = message.name.charAt(0).toUpperCase() || "?"; avatar.appendChild(initial);
      const bubble = document.createElement("div"); bubble.className = "chat-bubble";
      const meta = document.createElement("div"); meta.className = "chat-meta";
      const name = document.createElement("b"); name.textContent = message.self ? `${message.name} · YOU` : message.name;
      const time = document.createElement("time"); time.textContent = new Date(message.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const paragraph = document.createElement("p"); paragraph.textContent = message.text;
      meta.append(name, time); bubble.append(meta, paragraph); row.append(avatar, bubble);
    }
    wrap.appendChild(row);
    while (wrap.children.length > 80) wrap.firstElementChild?.remove();
    wrap.scrollTop = wrap.scrollHeight;
  }

  renderChat() {
    const wrap = document.getElementById("chat-messages"); if (!wrap) return;
    wrap.innerHTML = "";
    if (!this.chatHistory.length) {
      const empty = document.createElement("div"); empty.className = "chat-empty";
      empty.innerHTML = "<i></i><strong>The trail is quiet.</strong><p>Messages from other travelers will appear here.</p>";
      wrap.appendChild(empty);
    } else for (const message of this.chatHistory) this.appendChatMessage(message);
    this.chatUnread = 0; this.syncUnread();
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
    if (open) {
      p.classList.remove("hidden");
      if (name === "inv") this.renderInv();
      if (name === "craft") this.renderCraft();
      if (name === "quest") this.renderQuestLog();
      if (name === "companions") this.renderCompanions();
      if (name === "menu") this.renderMenu();
      if (name === "chat") this.renderChat();
      if (name === "collection") this.renderCollection();
      if (this.game && name === "chat") { this.game.resetInputState?.(); this.game.inputLocked = true; setTimeout(() => document.getElementById("chat-input")?.focus(), 0); }
      if (this.game && name !== "chat") { this.game.resetInputState?.(); this.game.paused = true; }
      if (name !== "chat") setTimeout(() => p.querySelector(".panel-close,button,input")?.focus(), 0);
    }
  }
  close(name) { this.panels[name]?.classList.add("hidden"); if (this.game && name === "chat") this.game.inputLocked = false; if (this.game && !this.hasBlockingOpen()) this.game.paused = false; }
  closeAll() { for (const k of ["menu", "chat", "collection", "inv", "craft", "quest", "companions", "dialog", "settings"]) this.panels[k]?.classList.add("hidden"); if (this.game) this.game.inputLocked = false; if (this.game && !this.hasBlockingOpen()) this.game.paused = false; }
  anyOpen() { return ["menu", "chat", "collection", "inv", "craft", "quest", "companions", "dialog", "settings", "level", "pet", "death"].some(k => this.panels[k] && !this.panels[k].classList.contains("hidden")); }
  hasBlockingOpen() { return ["menu", "collection", "inv", "craft", "quest", "companions", "dialog", "settings", "level", "pet", "death"].some(k => this.panels[k] && !this.panels[k].classList.contains("hidden")); }

  currentRegion() {
    const p = this.game?.player; if (!p) return "Verdant Wilds";
    const x = p.x / 24, y = p.y / 24;
    if (y < 25) return "Frostfield";
    if (x > 72 && y < 50) return "Azure Coast";
    if (x > 74 && y > 68) return "Umbral Forest";
    if (y < 45 && x > 38 && x < 66) return "North Shrine";
    if (x > 60 && x < 74 && y > 39 && y < 62) return "Reed Pond";
    if (Math.hypot(x - 55, y - 55) < 13) return "Hearth Camp";
    return x < 55 ? "West Road" : "Verdant Wilds";
  }

  renderMenu() {
    if (!this.game) return;
    const p = this.game.player;
    const discovered = FISH.filter(fish => (this.game.fishingStats?.records?.[fish.id]?.count || 0) > 0).length;
    const ownedPets = Array.isArray(this.game.pets) ? this.game.pets.length : 0;
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("menu-player-name", document.getElementById("hud-name")?.textContent || "Traveler");
    set("menu-level", `Level ${p.level}`);
    set("menu-location", this.currentRegion());
    set("menu-clock", document.getElementById("clock")?.textContent || "Day 06:00");
    set("menu-fish-progress", `${discovered} / ${FISH.length} discovered`);
    set("menu-pet-progress", `${ownedPets} / ${MON_IDS.length} bonded`);
    this.setOnlineState(this.online, this.onlineCount);
    this.updateDuel(this.duelActive);
  }

  renderCollection() {
    const grid = document.getElementById("fish-collection-grid"); if (!grid || !this.game) return;
    const stats = this.game.fishingStats || { total: 0, best: 0, records: {} };
    const records = stats.records || {};
    const discovered = FISH.filter(fish => (records[fish.id]?.count || 0) > 0).length;
    const percent = Math.round(discovered / FISH.length * 100);
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("collection-percent", `${percent}%`);
    set("collection-count", `${discovered} / ${FISH.length}`);
    set("collection-catches", stats.total || 0);
    set("collection-best", stats.best ? `${Number(stats.best).toFixed(1)} cm` : "--");
    set("collection-total", discovered ? `${FISH.length - discovered} species remain hidden across pond, lake, weather and moonlight.` : "Cast your first line to begin the archive.");
    set("menu-fish-progress", `${discovered} / ${FISH.length} discovered`);
    const token = FISH.map(fish => `${fish.id}:${records[fish.id]?.count || 0}:${records[fish.id]?.best || 0}`).join("|");
    if (this._collectionToken === token && grid.children.length === FISH.length) return;
    this._collectionToken = token;
    grid.innerHTML = "";
    for (const fish of FISH) {
      const record = records[fish.id] || { count: 0, best: 0 };
      const owned = record.count > 0;
      const card = document.createElement("article");
      card.className = `fish-card${owned ? "" : " locked"}`;
      card.dataset.rarity = fish.rarity;
      const art = document.createElement("div"); art.className = "fish-card-art";
      const canvas = document.createElement("canvas"); canvas.width = 120; canvas.height = 72;
      const ctx = canvas.getContext("2d"); if (ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(getFishSprite(fish), 4, 7, 112, 58); }
      art.appendChild(canvas);
      if (!owned) { const lock = document.createElement("i"); lock.className = "fish-lock"; art.appendChild(lock); }
      const rarity = document.createElement("span"); rarity.textContent = fish.rarity;
      const name = document.createElement("strong"); name.textContent = owned ? fish.name : "Undiscovered";
      const details = document.createElement("dl");
      const caught = document.createElement("div"), caughtLabel = document.createElement("dt"), caughtValue = document.createElement("dd");
      caughtLabel.textContent = "Caught"; caughtValue.textContent = owned ? String(record.count) : "--"; caught.append(caughtLabel, caughtValue);
      const best = document.createElement("div"), bestLabel = document.createElement("dt"), bestValue = document.createElement("dd");
      bestLabel.textContent = "Best"; bestValue.textContent = owned ? `${Number(record.best).toFixed(1)} cm` : "--"; best.append(bestLabel, bestValue);
      details.append(caught, best);
      const habitat = document.createElement("small");
      const condition = [fish.habitats.map(x => x[0].toUpperCase() + x.slice(1)).join(" / "), fish.time, fish.weather].filter(Boolean).join(" · ");
      habitat.textContent = owned ? condition : "Clue hidden until discovered";
      card.append(art, rarity, name, details, habitat); grid.appendChild(card);
    }
  }

  showLevel(lv) {
    this.closeAll();
    const el = document.getElementById("level-msg"); if (el) el.textContent = `Level ${lv} reached. Your body steadies as the Chronicle records new strength.`;
    const number = document.getElementById("level-number"); if (number) number.textContent = lv;
    if (this.game) {
      this.game.shake = 0;
      this.game.hitStop = 0;
      this.game.resetInputState?.();
      this.game.paused = true;
    }
    this.panels.level?.classList.remove("hidden");
  }
  showDeath() { this.closeAll(); this.panels.death?.classList.remove("hidden"); if (this.game) { this.game.inputLocked = false; this.game.paused = true; } }
  hideDeath() { this.panels.death?.classList.add("hidden"); }
  showPet(id, cb) {
    this._petCb = cb;
    this.audio?.sfx("pet");
    const im = document.getElementById("pet-img");
    if (im && this.game && this.game.monCache[id]) { im.src = this.game.monCache[id][0].toDataURL(); im.alt = `${petName(id)} companion`; }
    const msg = document.getElementById("pet-msg"); if (msg) msg.textContent = `A wild ${petName(id)} appeared! It wants to join you.`;
    this.panels.pet?.classList.remove("hidden"); if (this.game) this.game.paused = true;
  }

  drawPet(canvas, id, frame = 0) {
    if (!canvas || !this.game?.monCache?.[id]) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
    const sprite = this.game.monCache[id][frame % this.game.monCache[id].length];
    const size = Math.min(canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,.24)";
    ctx.beginPath(); ctx.ellipse(canvas.width / 2, canvas.height * .77, size * .27, size * .075, 0, 0, 7); ctx.fill();
    ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, Math.round((canvas.width - size) / 2), Math.round((canvas.height - size) / 2) - 3, size, size);
  }

  cyclePet() {
    if (!this.game) return;
    const id = this.game.cyclePet();
    if (!id) {
      this.toast("No bonded companion yet — explore supply caches.");
      if (this.panels.companions?.classList.contains("hidden")) this.toggle("companions");
      return;
    }
    this.audio?.sfx("ui");
    this.toast(`${petName(id)} answered your call.`);
  }

  syncPet(force = false) {
    const g = this.game; if (!g) return;
    const owned = Array.isArray(g.pets) ? g.pets.filter(id => MON_IDS.includes(id)) : [];
    const active = g.activePetId || g.pet?.id || null;
    const token = `${owned.join(",")}|${active || ""}`;
    const chip = document.getElementById("pet-chip");
    chip?.classList.remove("hidden");
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("pet-chip-name", active ? petName(active) : "Sanctuary");
    set("pet-chip-count", `${owned.length}/${MON_IDS.length}`);
    set("companion-owned-count", `${owned.length} / ${MON_IDS.length} BONDED`);
    const fill = document.getElementById("companion-progress-fill"); if (fill) fill.style.width = `${owned.length / MON_IDS.length * 100}%`;
    const canvas = document.getElementById("companion-active-art");
    const ctx = canvas?.getContext("2d"); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    const orb = document.getElementById("companion-element-orb");
    if (active) {
      const element = MON_ELEMENT[active] || "arcane";
      const colors = PET_COLORS[element] || ["#b9a6e8", "#68539f"];
      set("companion-active-element", `${element.toUpperCase()} BOND · ACTIVE`);
      set("companion-active-name", petName(active));
      set("companion-active-desc", `${petName(active)} follows your trail. Switch bonds freely; every companion you discover remains in this sanctuary.`);
      this.drawPet(canvas, active, Math.floor((g.t || 0) * 4));
      if (orb) { orb.style.borderColor = colors[0]; orb.style.boxShadow = `0 0 22px ${colors[1]}55, inset 0 0 16px ${colors[0]}22`; }
      if (chip) chip.style.setProperty("--pet-color", colors[0]);
    } else {
      set("companion-active-element", "NO ACTIVE BOND");
      set("companion-active-name", "Find your first companion");
      set("companion-active-desc", "Rare supply caches may reveal wild spirits. Bonded companions remain in your sanctuary and can be summoned at any time.");
      if (ctx) {
        ctx.fillStyle = "rgba(93,190,145,.2)"; ctx.fillRect(45, 24, 6, 48); ctx.fillRect(24, 45, 48, 6);
        ctx.strokeStyle = "rgba(128,220,176,.5)"; ctx.strokeRect(31, 31, 34, 34);
      }
    }
    if (force || this._petToken !== token) {
      this._petToken = token;
      if (!this.panels.companions?.classList.contains("hidden")) this.renderCompanions();
    }
  }

  renderCompanions() {
    const grid = document.getElementById("companion-grid"); if (!grid || !this.game) return;
    const owned = new Set(Array.isArray(this.game.pets) ? this.game.pets : []);
    const active = this.game.activePetId || this.game.pet?.id;
    grid.innerHTML = "";
    for (const id of MON_IDS) {
      const isOwned = owned.has(id), isActive = id === active;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `companion-card ${isOwned ? "owned" : "locked"}${isActive ? " active" : ""}`;
      button.disabled = !isOwned || isActive;
      if (isActive) button.setAttribute("aria-current", "true");
      button.setAttribute("aria-label", isOwned ? `${isActive ? "Active companion" : "Summon"} ${petName(id)}` : "Undiscovered companion");
      const art = document.createElement("canvas"); art.width = 72; art.height = 72; button.appendChild(art);
      const name = document.createElement("strong"); name.textContent = isOwned ? petName(id) : "Unknown"; button.appendChild(name);
      const element = document.createElement("small"); element.textContent = isOwned ? MON_ELEMENT[id] || "spirit" : "not bonded"; button.appendChild(element);
      this.drawPet(art, id, 0);
      if (!isOwned) art.style.filter = "brightness(0)";
      if (isOwned) button.addEventListener("click", () => {
        if (isActive) return;
        if (this.game.setActivePet(id)) this.toast(`${petName(id)} summoned.`);
      });
      grid.appendChild(button);
    }
    this.syncPet(false);
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
    this.syncCatch(g.catchReveal);
    if (!this.panels.menu?.classList.contains("hidden")) this.renderMenu();
    if (!this.panels.collection?.classList.contains("hidden")) this.renderCollection();
  }

  syncBoss(boss) {
    const hud = document.getElementById("boss-hud"); if (!hud) return;
    const visible = !!boss && !boss.dead;
    hud.classList.toggle("hidden", !visible);
    if (!visible) { hud.classList.remove("rage", "warning"); return; }
    const pct = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    const warning = (boss.breathWindup || 0) > 0;
    hud.classList.toggle("rage", !!boss.rage);
    hud.classList.toggle("warning", warning);
    const fill = document.getElementById("boss-health-fill"); if (fill) fill.style.width = `${pct * 100}%`;
    const hp = document.getElementById("boss-health-text"); if (hp) hp.textContent = `${Math.ceil(boss.hp)} / ${boss.maxHp} HP`;
    const contribution = document.getElementById("boss-contribution"); if (contribution) contribution.textContent = `${Math.round(boss.contribution || 0)} DMG`;
    const phase = document.getElementById("boss-phase"); if (phase) phase.textContent = boss.rage ? "PHASE II · RAGE" : "PHASE I · AWAKENED";
    const state = document.getElementById("boss-state");
    if (state) {
      if (warning) state.textContent = `BREATH WIND-UP · ${Math.max(0, boss.breathWindup).toFixed(1)}s`;
      else if (boss.state === "melee") state.textContent = "Oni swipe range";
      else if (boss.state === "chase") state.textContent = "Closing distance";
      else state.textContent = boss.rage ? "Firestorm active" : pct < .7 ? "Oni guard is cracking" : "Break the oni guard";
    }
    const distance = document.getElementById("boss-distance");
    if (distance && this.game?.player) distance.textContent = `${Math.round(Math.hypot(boss.x - this.game.player.x, boss.y - this.game.player.y) / 24)} tiles`;
  }

  syncFishing(fishing) {
    const hud = document.getElementById("fishing-hud"); if (!hud) return;
    hud.classList.toggle("hidden", !fishing);
    document.getElementById("hud")?.classList.toggle("fishing-active", !!fishing);
    const action = document.getElementById("btn-interact");
    if (action) {
      action.classList.toggle("fishing-action", !!fishing);
      action.textContent = !fishing ? "F" : fishing.state === "bite" ? "HOOK" : fishing.state === "hooked" ? "REEL" : "CANCEL";
      action.setAttribute("aria-label", !fishing ? "Interact" : fishing.state === "hooked" ? "Hold to reel, release during a surge" : fishing.state === "bite" ? "Set fishing hook" : "Cancel fishing cast");
    }
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

  syncCatch(reveal) {
    const card = document.getElementById("catch-card"); if (!card) return;
    card.classList.toggle("hidden", !reveal);
    if (!reveal) { this._catchToken = ""; return; }
    const fish = reveal.fish;
    const token = `${fish.id}:${fish.rarity}:${fish.size}`;
    card.dataset.rarity = fish.rarity || "common";
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("catch-rarity", fish.rarity === "legendary" ? "LEGENDARY CATCH" : fish.rarity === "rare" ? "RARE CATCH" : fish.rarity === "uncommon" ? "UNCOMMON CATCH" : "CATCH LANDED");
    set("catch-name", fish.name);
    set("catch-size", `${fish.size.toFixed(1)} cm`);
    set("catch-reward", `+${reveal.reward}g${reveal.bonus ? " · precision" : ""}`);
    if (this._catchToken !== token) {
      this._catchToken = token;
      const canvas = document.getElementById("catch-fish-art");
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(reveal.sprite || getFishSprite(fish), 0, 0, canvas.width, canvas.height);
      }
      card.classList.remove("landed"); void card.offsetWidth; card.classList.add("landed");
    }
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
        if (id === "fish") {
          cell.classList.add("fish-entry");
          const records = this.game.fishingStats?.records || {};
          const featured = [...FISH].reverse().find(fish => (records[fish.id]?.count || 0) > 0) || FISH[0];
          const canvas = document.createElement("canvas"); canvas.className = "inv-fish-art"; canvas.width = 72; canvas.height = 44;
          const ctx = canvas.getContext("2d"); if (ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(getFishSprite(featured), 0, 0, 72, 44); }
          const label = document.createElement("span"); label.className = "inv-name"; label.textContent = "Fish Archive";
          cell.append(canvas, label);
          cell.title = "Open the Fish Chronicle";
          cell.addEventListener("click", () => this.toggle("collection"));
        } else if (img(`item/${id}`)) {
          const canvas = document.createElement("canvas"); canvas.className = "inv-material-art"; canvas.width = 40; canvas.height = 40;
          const ctx = canvas.getContext("2d"); if (ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(img(`item/${id}`), 0, 0, 40, 40); }
          const label = document.createElement("span"); label.className = "inv-name"; label.textContent = item.name;
          cell.append(canvas, label);
        } else if (ITEMS[id]?.weapon) {
          const canvas = document.createElement("canvas"); canvas.className = "inv-weapon-art"; canvas.width = 40; canvas.height = 48;
          const frame = this.game.weaponFrames?.(id)?.walk?.down;
          const ctx = canvas.getContext("2d"); if (ctx && frame) { ctx.imageSmoothingEnabled = false; ctx.drawImage(frame, 0, 0, frame.width, frame.height, 0, 0, 40, 48); }
          const label = document.createElement("span"); label.className = "inv-name"; label.textContent = item.name;
          cell.append(canvas, label);
        } else {
          cell.innerHTML = `<span class="inv-glyph">${item.glyph || "?"}</span><span class="inv-name">${item.name}</span>`;
        }
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
