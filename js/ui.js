import { ITEMS, RECIPES, canCraft, xpFor } from "./crafting.js";
import { QUESTS } from "./quests.js";
import { CLASSES } from "./classes.js";
import { FISH, RODS, activeRod } from "./fishing.js";
import { getFishSprite } from "./fishart.js";
import { img } from "./assets.js";
import { MON_IDS, MON_ELEMENT, MON_META, STARTER_MOUNT_ID } from "./monsters.js";
import { marketDayKey, shopView } from "./shop.js";
import { AFK_FISHING_OPTIONS, afkFishingStatus } from "./afkfishing.js";
import {
  COOKING_RECIPES, FOOD_ITEMS, canCook, knownRecipeIds,
  displayIngredientName, activeBuffTotals, normalizeActiveBuffs,
} from "./cooking.js";

const PET_COLORS = {
  grass: ["#baf39a", "#55b878"], fire: ["#ffd070", "#e45f3d"], water: ["#a4efff", "#4aa6d4"],
  rock: ["#ead9ae", "#987757"], electric: ["#fff49a", "#e5bd38"], bug: ["#eac2fa", "#a96fc2"],
  ice: ["#e8ffff", "#71cae2"], dark: ["#d1b4ff", "#6c4f9f"],
  wind: ["#dcf6df", "#67bda1"], light: ["#fff0a5", "#d69b45"],
};
const petName = (id) => MON_META[id]?.name || String(id || "companion").replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export class UI {
  constructor(audio) {
    this.game = null;
    this.audio = audio || null;
    this.panels = {
      inv: document.getElementById("panel-inv"),
      shop: document.getElementById("panel-shop"),
      afk: document.getElementById("panel-afk"),
      fishingMode: document.getElementById("panel-fishing-mode"),
      menu: document.getElementById("panel-menu"),
      chat: document.getElementById("panel-chat"),
      collection: document.getElementById("panel-collection"),
      craft: document.getElementById("panel-craft"),
      cooking: document.getElementById("panel-cooking"),
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
    this.duelSupported = false;
    this._chatSender = null;
    this._duelSender = null;
    this._shopMode = "buy";
    this._afkSelection = AFK_FISHING_OPTIONS[0]?.minutes || 2;
    this._levelHideTimer = null;
    document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { this.audio?.sfx("ui"); this.close(b.dataset.close); }));
    document.getElementById("btn-level-ok")?.addEventListener("click", () => this.dismissLevel());
    document.getElementById("btn-respawn")?.addEventListener("click", () => this.game?.respawn());
    document.getElementById("btn-inv-hot")?.addEventListener("click", () => this.toggle("inv"));
    document.getElementById("btn-craft-hot")?.addEventListener("click", () => this.toggle("craft"));
    document.getElementById("btn-quest-hot")?.addEventListener("click", () => this.toggle("quest"));
    document.getElementById("btn-realm-menu")?.addEventListener("click", () => this.toggle("menu"));
    document.getElementById("chat-dock")?.addEventListener("click", () => this.openChat());
    document.getElementById("pet-chip")?.addEventListener("click", () => this.toggle("companions"));
    document.getElementById("btn-cycle-pet")?.addEventListener("click", () => this.cyclePet());
    document.getElementById("btn-mount-toggle")?.addEventListener("click", () => this.toggleMount());
    document.getElementById("mount-chip")?.addEventListener("click", () => this.toggleMount());
    document.getElementById("auto-battle-toggle")?.addEventListener("click", () => this.toggleAutoBattle());
    document.getElementById("auto-battle-chip")?.addEventListener("click", () => this.toggleAutoBattle(false));
    document.getElementById("fishing-mode-manual")?.addEventListener("click", () => this.chooseFishingMode("manual"));
    document.getElementById("fishing-mode-auto")?.addEventListener("click", () => this.chooseFishingMode("auto"));
    document.getElementById("btn-save-progress")?.addEventListener("click", () => {
      if (!this.game?.requestSave) { this.toast("Save system is still preparing."); return; }
      this.game.requestSave();
      this.markSaved();
      this.toast("Progress saved · level and inventory are safe.");
    });
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
      if (event.code === "KeyK" && !event.repeat) { event.preventDefault(); this.toggle("cooking"); }
      if (event.code === "KeyB" && !event.repeat) { event.preventDefault(); this.toggle("shop"); }
      if (event.code === "KeyH" && !event.repeat) { event.preventDefault(); this.toggleAutoBattle(); }
      if (event.code === "KeyM" && !event.repeat) {
        const sanctuaryOpen = !this.panels.companions?.classList.contains("hidden");
        if (this.anyOpen() && !sanctuaryOpen) return;
        event.preventDefault(); this.toggleMount();
      }
    });
    this._petCb = null;
    document.getElementById("btn-pet-ok")?.addEventListener("click", () => {
      this.panels.pet.classList.add("hidden"); if (this.game) this.game.paused = false;
      const callback = this._petCb; this._petCb = null; if (callback) callback();
    });
  }
  bind(g) { this.game = g; this.renderSkillbar(); this.sync(); this.syncPet(true); this.syncMount(true); this.syncFoodBuffs(true); this.syncAutoBattle(true); }

  markSaved(when = Date.now()) {
    const label = document.getElementById("save-progress-state");
    if (label) {
      const date = new Date(when);
      label.textContent = `SAVED ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
  }

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
    const crest = className.charAt(0).toUpperCase();
    const classMeta = CLASSES[classId] || CLASSES.warrior;
    for (const id of ["status-class-crest", "menu-class-crest"]) { const el = document.getElementById(id); if (el) el.textContent = classMeta.crest || crest; }
    const statusClass = document.getElementById("status-class-name"); if (statusClass) statusClass.textContent = (classMeta.path || className).toUpperCase();
    const menuPath = document.getElementById("menu-class-path"); if (menuPath) menuPath.textContent = `${(classMeta.path || className).toUpperCase()} PATH`;
    for (const id of ["status-card", "panel-menu"]) document.getElementById(id)?.style.setProperty("--class-accent", loadout.color || "#5ec18e");
    this._skillClass = classId;
  }

  setChatSender(sender) { this._chatSender = typeof sender === "function" ? sender : null; }
  setDuelSender(sender) { this._duelSender = typeof sender === "function" ? sender : null; }
  setDuelSupported(supported) {
    this.duelSupported = !!supported;
    const button = document.getElementById("duel-toggle");
    button?.classList.toggle("unavailable", this.online && !this.duelSupported);
    button?.setAttribute("aria-disabled", String(this.online && !this.duelSupported));
    if (button) button.title = this.online && !this.duelSupported ? "Duel service is updating" : "Mutual opt-in player duel";
    if (!this.duelSupported) this.duelActive = false;
    this.updateDuel(this.duelActive);
  }

  setOnlineState(online, count = this.onlineCount) {
    this.online = !!online;
    this.onlineCount = Math.max(1, Number(count) || 1);
    const state = this.online ? `${this.onlineCount} traveler${this.onlineCount === 1 ? "" : "s"} online` : "Offline realm";
    for (const id of ["menu-online-state", "menu-chat-state", "chat-presence-text"]) { const el = document.getElementById(id); if (el) el.textContent = state; }
    document.getElementById("chat-presence-text")?.parentElement?.classList.toggle("online", this.online);
    const dock = document.getElementById("chat-dock"); if (dock) dock.dataset.online = this.online ? "true" : "false";
    if (!this.online) this.updateDuel(false);
    this.setDuelSupported(this.duelSupported);
  }

  updateDuel(active) {
    this.duelActive = !!active;
    const button = document.getElementById("duel-toggle");
    button?.setAttribute("aria-checked", String(this.duelActive));
    const label = document.getElementById("duel-toggle-label");
    if (label) label.textContent = this.duelActive ? "DUEL ARMED" : this.online && !this.duelSupported ? "SERVICE UPDATING" : "SAFE MODE";
    document.getElementById("hud")?.classList.toggle("duel-armed", this.duelActive);
  }

  requestDuel(active) {
    if (!this.online || !this._duelSender) { this.toast("Realm connection required for Duel Mode."); return; }
    if (!this.duelSupported) { this.toast("Duel service is updating. Safe Mode remains active."); return; }
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
    if (this.game?._autoBattleCasting) return;
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
      if (name === "shop") this.renderShop();
      if (name === "afk") this.renderAfkFishing();
      if (name === "craft") this.renderCraft();
      if (name === "cooking") this.renderCooking();
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
  close(name) { this.panels[name]?.classList.add("hidden"); if (name === "afk") clearInterval(this._afkClock); if (name === "fishingMode") this._fishingSpot = null; if (this.game && name === "chat") this.game.inputLocked = false; if (this.game && !this.hasBlockingOpen()) this.game.paused = false; }
  closeAll() { for (const k of ["menu", "chat", "collection", "inv", "shop", "afk", "fishingMode", "craft", "cooking", "quest", "companions", "dialog", "settings"]) this.panels[k]?.classList.add("hidden"); clearInterval(this._afkClock); if (this.game) this.game.inputLocked = false; if (this.game && !this.hasBlockingOpen()) this.game.paused = false; }
  anyOpen() { return ["menu", "chat", "collection", "inv", "shop", "afk", "fishingMode", "craft", "cooking", "quest", "companions", "dialog", "settings", "level", "pet", "death"].some(k => this.panels[k] && !this.panels[k].classList.contains("hidden")); }
  hasBlockingOpen() { return ["menu", "collection", "inv", "shop", "afk", "fishingMode", "craft", "cooking", "quest", "companions", "dialog", "settings", "level", "pet", "death"].some(k => this.panels[k] && !this.panels[k].classList.contains("hidden")); }

  toggleAutoBattle(force) {
    if (!this.game) return false;
    const enabled = this.game.setAutoBattle(typeof force === "boolean" ? force : !this.game.autoBattle);
    this.syncAutoBattle(true);
    if (!this.panels.menu?.classList.contains("hidden")) this.renderMenu();
    return enabled;
  }

  syncAutoBattle(force = false) {
    if (!this.game) return;
    const enabled = !!this.game.autoBattle;
    const raw = enabled ? (this.game.autoBattleState || "SCANNING NEARBY") : "OFF";
    const label = raw.startsWith("HUNTING:") ? `HUNTING ${petName(raw.slice(8)).toUpperCase()}` : raw;
    const token = `${enabled}:${label}`;
    if (!force && token === this._autoBattleToken) return;
    this._autoBattleToken = token;
    const toggle = document.getElementById("auto-battle-toggle");
    if (toggle) {
      toggle.setAttribute("aria-checked", String(enabled));
      toggle.classList.toggle("active", enabled);
    }
    const menuState = document.getElementById("menu-battle-state");
    if (menuState) menuState.textContent = enabled ? `ON · ${label.toLowerCase()}` : "OFF · hunts nearby monsters";
    const chip = document.getElementById("auto-battle-chip");
    chip?.classList.toggle("hidden", !enabled);
    if (chip) chip.setAttribute("aria-label", enabled ? `Disable AFK Auto Battle. ${label}` : "Enable AFK Auto Battle");
    const status = document.getElementById("auto-battle-status");
    if (status) status.textContent = label;
  }

  showFishingMode(spot) {
    if (!this.game || !spot || !this.panels.fishingMode) return;
    this._fishingSpot = spot;
    this.closeAll();
    this.game.resetInputState?.();
    this.game.paused = true;
    const rod = activeRod(this.game.player.inv);
    const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    set("fishing-mode-rod", rod.name);
    set("fishing-mode-auto-copy", "Stay at this spot while the rod automatically casts, hooks, reels, and repeats the normal catch flow.");
    set("fishing-mode-auto-state", "START AUTO");
    this.panels.fishingMode.classList.remove("hidden");
    setTimeout(() => document.getElementById("fishing-mode-manual")?.focus(), 0);
  }

  chooseFishingMode(mode) {
    if (!this.game || !this._fishingSpot) return;
    const spot = this._fishingSpot;
    this._fishingSpot = null;
    this.panels.fishingMode?.classList.add("hidden");
    if (mode === "manual") {
      if (!this.hasBlockingOpen()) this.game.paused = false;
      this.game.startFishing(spot, { auto: false });
      return;
    }
    if (this.game.autoBattle) this.game.setAutoBattle(false);
    if (!this.hasBlockingOpen()) this.game.paused = false;
    this.game.startFishing(spot, { auto: true });
  }

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
    const knownMeals = knownRecipeIds({ level: p.level }).length;
    const servings = Object.keys(FOOD_ITEMS).reduce((sum, id) => sum + Math.max(0, p.inv[id] || 0), 0);
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("menu-player-name", document.getElementById("hud-name")?.textContent || "Traveler");
    set("menu-level", `Level ${p.level}`);
    set("menu-location", this.currentRegion());
    set("menu-clock", document.getElementById("clock")?.textContent || "Day 06:00");
    set("menu-fish-progress", `${discovered} / ${FISH.length} discovered`);
    this.syncAutoBattle(true);
    set("menu-pet-progress", `${ownedPets} / ${MON_IDS.length} bonded`);
    set("menu-cooking-state", `${knownMeals}/${COOKING_RECIPES.length} recipes · ${servings} packed`);
    this.setOnlineState(this.online, this.onlineCount);
    this.updateDuel(this.duelActive);
  }

  formatDuration(milliseconds) {
    const seconds = Math.max(0, Math.ceil((Number(milliseconds) || 0) / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  drawMarketItem(canvas, listing) {
    const ctx = canvas?.getContext("2d"); if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    if (listing.visualKind === "fish") {
      const records = this.game?.fishingStats?.records || {};
      const featured = [...FISH].reverse().find((fish) => (records[fish.id]?.count || 0) > 0) || FISH[0];
      ctx.drawImage(getFishSprite(featured), 2, 8, 60, 42);
      return;
    }
    if (listing.visualKind === "weapon") {
      const frame = this.game?.weaponFrames?.(listing.id)?.walk?.down;
      if (frame) ctx.drawImage(frame, 0, 0, frame.width, frame.height, 8, 2, 48, 58);
      return;
    }
    const sprite = img(listing.iconKey || `item/${listing.id}`);
    if (sprite) ctx.drawImage(sprite, 5, 5, 54, 54);
  }

  renderShop() {
    const list = document.getElementById("shop-list"); if (!list || !this.game) return;
    const player = this.game.player;
    const mode = this._shopMode === "sell" ? "sell" : "buy";
    const dayKey = marketDayKey();
    const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    set("shop-gold", player.gold);
    document.querySelectorAll("[data-shop-tab]").forEach((button) => {
      const active = button.dataset.shopTab === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.onclick = () => { this._shopMode = button.dataset.shopTab; this.audio?.sfx("ui"); this.renderShop(); };
    });
    list.innerHTML = "";
    const wares = shopView({ mode, level: player.level, inventory: player.inv, dayKey });
    if (!wares.length) {
      const empty = document.createElement("div"); empty.className = "shop-empty";
      empty.innerHTML = `<i></i><strong>Your sell pouch is empty.</strong><p>Gather wood, herbs, ore, gel, fish, or cook spare meals first.</p>`;
      list.appendChild(empty); return;
    }
    for (const ware of wares) {
      const protectedItem = mode === "sell" && (ware.id === player.equipped || ware.tags.includes("rod") || ware.tags.includes("boss") || ware.tags.includes("rare"));
      const uniqueOwned = mode === "buy" && ware.tags.includes("rod") && ware.owned > 0;
      const row = document.createElement("article");
      row.className = `shop-row${ware.featured ? " featured" : ""}${ware.locked ? " locked" : ""}${protectedItem ? " protected" : ""}`;
      const art = document.createElement("div"); art.className = "shop-item-art";
      const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64; this.drawMarketItem(canvas, ware); art.appendChild(canvas);
      const copy = document.createElement("div"); copy.className = "shop-item-copy";
      const kicker = document.createElement("span"); kicker.textContent = ware.featured ? "DAILY FEATURE · 15% OFF" : `${ware.category.toUpperCase()} · OWNED ${ware.owned}`;
      const title = document.createElement("h3"); title.textContent = ware.name;
      const description = document.createElement("p"); description.textContent = ware.description;
      copy.append(kicker, title, description);
      const trade = document.createElement("div"); trade.className = "shop-trade";
      const price = document.createElement("b"); price.innerHTML = `<i></i>${ware.unitPrice || 0}<small> G / EA</small>`; trade.appendChild(price);
      if (ware.locked) {
        const lock = document.createElement("span"); lock.className = "shop-lock"; lock.textContent = `UNLOCK LV ${ware.unlockLevel}`; trade.appendChild(lock);
      } else if (protectedItem || uniqueOwned) {
        const lock = document.createElement("span"); lock.className = "shop-lock protected"; lock.textContent = uniqueOwned ? "ALREADY OWNED" : "PROTECTED"; trade.appendChild(lock);
      } else {
        for (const quantity of [1, 5]) {
          const button = document.createElement("button"); button.type = "button"; button.className = quantity === 1 ? "trade-one" : "trade-five";
          button.textContent = `${mode === "buy" ? "BUY" : "SELL"} ×${quantity}`;
          button.disabled = mode === "buy" ? player.gold < ware.unitPrice * quantity : ware.owned < quantity;
          button.addEventListener("click", () => this.game.tradeAtMarket(mode, ware.id, quantity));
          trade.appendChild(button);
        }
      }
      row.append(art, copy, trade); list.appendChild(row);
    }
  }

  renderAfkFishing() {
    if (!this.game) return;
    clearInterval(this._afkClock);
    const status = afkFishingStatus(this.game.afkFishingJob, Date.now());
    if (!status.valid) this.game.afkFishingJob = null;
    const state = status.valid ? status.state : "idle";
    const rod = activeRod(this.game.player.inv);
    const luck = rod.luck + Math.max(0, Number(this.game.foodBuffTotals?.fishingLuck) || 0);
    const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    const progress = document.getElementById("afk-progress-fill"); if (progress) progress.style.width = `${Math.round(status.progress * 100)}%`;
    set("afk-rod", rod.name);
    set("afk-efficiency", luck > .25 ? `Rare current +${Math.round(luck * 100)}%` : luck > 0 ? `Luck +${Math.round(luck * 100)}%` : "Safe waters");
    if (state === "running") {
      set("afk-eyebrow", "AUTO CAST IN PROGRESS"); set("afk-state", "The rod is fishing automatically.");
      set("afk-description", "Keep exploring or close this tab. Your auto line continues from this water spot and is stored in the active save.");
      set("afk-time", this.formatDuration(status.remainingMs));
    } else if (state === "ready") {
      set("afk-eyebrow", "CATCH READY"); set("afk-state", "Your keepnet is full.");
      set("afk-description", "Claim now to move every fish into the Chronicle, update fishing quests, and receive the dock's reduced gold payout.");
      set("afk-time", "CLAIM");
      if (this._afkReadyToken !== status.job.id) { this._afkReadyToken = status.job.id; this.audio?.sfx("coin"); this.toast("Auto Fishing catch ready · return to a fishing spot"); }
    } else {
      set("afk-eyebrow", this.game.lastAfkFishingClaim ? "AUTO CAST COMPLETE" : "AUTO LINE READY");
      set("afk-state", this.game.lastAfkFishingClaim ? "Catch secured in your pack." : "Choose an auto-cast duration.");
      set("afk-description", this.game.lastAfkFishingClaim ? "Your collection, quest progress, fish inventory, and gold were updated together." : "Choose a duration and the rod will fish automatically from the selected water spot.");
      set("afk-time", "READY");
    }

    const durations = document.getElementById("afk-duration-list");
    if (durations) {
      durations.innerHTML = "";
      for (const option of AFK_FISHING_OPTIONS) {
        const selected = option.minutes === this._afkSelection;
        const button = document.createElement("button"); button.type = "button";
        button.className = `afk-duration${selected ? " selected" : ""}`; button.disabled = state === "running" || state === "ready";
        // The option labels describe the rod's automatic cast rhythm.
        button.setAttribute("data-auto-cast", option.id);
        button.setAttribute("aria-pressed", String(selected));
        button.innerHTML = `<i><span></span></i><div><small>${option.label.toUpperCase()}</small><strong>${option.minutes} MIN</strong><p>About ${option.baseCatches}${rod.luck ? "+" : ""} catches · offline-safe</p></div><em>${selected ? "SELECTED" : "CHOOSE"}</em>`;
        button.addEventListener("click", () => { this._afkSelection = option.minutes; this.audio?.sfx("ui"); this.renderAfkFishing(); });
        durations.appendChild(button);
      }
    }

    const summary = document.getElementById("afk-reward-summary");
    const last = this.game.lastAfkFishingClaim;
    if (summary) {
      summary.classList.toggle("hidden", !last);
      summary.innerHTML = "";
      if (last) {
        const heading = document.createElement("div"); heading.className = "afk-reward-head";
        heading.innerHTML = `<span>LAST KEEP</span><strong>${last.fishCount} FISH · +${last.gold} GOLD</strong>`; summary.appendChild(heading);
        const species = document.createElement("div"); species.className = "afk-species";
        for (const caught of last.summary || []) {
          const fish = FISH.find((entry) => entry.id === caught.id); if (!fish) continue;
          const card = document.createElement("article"); card.dataset.rarity = fish.rarity;
          const canvas = document.createElement("canvas"); canvas.width = 62; canvas.height = 38; const ctx = canvas.getContext("2d");
          if (ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(getFishSprite(fish), 1, 2, 60, 34); }
          const label = document.createElement("div"); label.innerHTML = `<b>${fish.name}</b><span>×${caught.count} · best ${caught.bestSize.toFixed(1)} cm</span>`;
          card.append(canvas, label); species.appendChild(card);
        }
        summary.appendChild(species);
      }
    }

    const primary = document.getElementById("afk-primary");
    if (primary) {
      primary.disabled = state === "running" || state === "claimed";
      primary.textContent = state === "ready" ? "CLAIM CATCH" : state === "running" ? `AUTO CAST RUNNING · ${this.formatDuration(status.remainingMs)}` : `START AUTO CAST · ${this._afkSelection} MIN`;
      primary.onclick = () => state === "ready" ? this.game.claimAfkFishing() : this.game.startAfkFishing(this._afkSelection);
    }
    const cancel = document.getElementById("afk-cancel");
    if (cancel) { cancel.classList.toggle("hidden", state !== "running"); cancel.onclick = () => this.game.cancelAfkFishing(); }
    if (state === "running" && !this.panels.afk?.classList.contains("hidden")) this._afkClock = setInterval(() => this.renderAfkFishing(), 1000);
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
    }
    this.panels.level?.classList.remove("hidden");
    clearTimeout(this._levelHideTimer);
    this._levelHideTimer = setTimeout(() => this.dismissLevel(), 1900);
  }
  dismissLevel() {
    clearTimeout(this._levelHideTimer);
    this._levelHideTimer = null;
    this.panels.level?.classList.add("hidden");
  }
  showDeath() {
    this.closeAll();
    const panel = this.panels.death;
    panel?.classList.remove("hidden");
    setTimeout(() => document.getElementById("btn-respawn")?.focus(), 0);
    if (this.game) { this.game.shake = 0; this.game.hitStop = 0; this.game.resetInputState?.(); this.game.inputLocked = true; this.game.paused = true; }
  }
  hideDeath() { this.panels.death?.classList.add("hidden"); this.panels.death?.classList.remove("death-enter"); }
  showPet(id, cb) {
    this._petCb = cb;
    this.audio?.sfx("pet");
    const im = document.getElementById("pet-img");
    if (im && this.game && this.game.monCache[id]) { im.src = this.game.monCache[id][0].toDataURL(); im.alt = `${petName(id)} companion`; }
    const msg = document.getElementById("pet-msg");
    if (msg) msg.textContent = MON_META[id]?.mountable
      ? `${petName(id)} bonded with you! This companion is a mount—press M or tap RIDE after adopting.`
      : `A wild ${petName(id)} appeared! It wants to join you.`;
    this.panels.pet?.classList.remove("hidden"); if (this.game) this.game.paused = true;
  }

  drawPet(canvas, id, frame = 0) {
    if (!canvas || !this.game?.monCache?.[id]) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
    const sprite = this.game.monCache[id][frame % this.game.monCache[id].length];
    const size = Math.min(canvas.width, canvas.height);
    const artSize = Math.round(size * Math.max(.72, Math.min(.98, MON_META[id]?.petScale || .84)));
    ctx.fillStyle = "rgba(0,0,0,.24)";
    ctx.beginPath(); ctx.ellipse(canvas.width / 2, canvas.height * .77, size * .27, size * .075, 0, 0, 7); ctx.fill();
    ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, Math.round((canvas.width - artSize) / 2), Math.round((canvas.height - artSize) / 2) - 2, artSize, artSize);
  }

  cyclePet() {
    if (!this.game) return;
    const id = this.game.cyclePet();
    if (!id) {
      this.toast("Claim the golden cache south of camp for Puffalo, then follow yellow cache markers.");
      if (this.panels.companions?.classList.contains("hidden")) this.toggle("companions");
      return;
    }
    this.audio?.sfx("ui");
    this.toast(`${petName(id)} answered your call.`);
  }

  toggleMount() {
    const game = this.game; if (!game) return;
    if (game.mounted) {
      const name = petName(game.mountId);
      game.toggleMount();
      this.toast(`${name} slowed to a walk beside you.`);
      this.syncMount(true);
      return;
    }
    const mounts = game.mountablePets?.() || [];
    const active = game.activePetId || game.pet?.id;
    const id = MON_META[active]?.mountable ? active : mounts.includes(game.mountId) ? game.mountId : mounts[0];
    if (!id) {
      this.toast("Starter mount: claim Puffalo from the golden cache just south of camp.");
      if (this.panels.companions?.classList.contains("hidden")) this.toggle("companions");
      return;
    }
    if (game.setMount(id, true)) {
      this.toast(`${petName(id)} mount · travel speed +${Math.round(((MON_META[id]?.mountSpeed || 1) - 1) * 100)}%`);
      this.syncMount(true);
    }
  }

  syncMount(force = false) {
    const game = this.game; if (!game) return;
    const mounts = game.mountablePets?.() || [];
    const active = game.activePetId || game.pet?.id;
    const selected = mounts.includes(game.mountId) ? game.mountId : MON_META[active]?.mountable ? active : mounts[0] || null;
    const token = `${mounts.join(",")}|${selected || ""}|${game.mounted ? 1 : 0}|${active || ""}`;
    if (!force && token === this._mountToken) return;
    this._mountToken = token;
    const chip = document.getElementById("mount-chip");
    chip?.classList.remove("hidden");
    chip?.classList.toggle("active", !!game.mounted);
    chip?.classList.toggle("locked", mounts.length === 0);
    chip?.setAttribute("aria-pressed", String(!!game.mounted));
    chip?.setAttribute("aria-label", game.mounted ? `Dismount ${petName(game.mountId)}` : selected ? `Ride ${petName(selected)}` : "Claim starter mount Puffalo from the golden cache south of camp");
    const chipLabel = document.getElementById("mount-chip-label");
    if (chipLabel) chipLabel.textContent = game.mounted ? "DISMOUNT" : selected ? `RIDE ${petName(selected)}` : "CLAIM PUFFALO";
    const button = document.getElementById("btn-mount-toggle");
    button?.classList.remove("hidden");
    button?.classList.toggle("locked", mounts.length === 0);
    button?.classList.toggle("active", !!game.mounted);
    const buttonLabel = button?.querySelector("span");
    if (buttonLabel) buttonLabel.textContent = !selected
      ? "CLAIM PUFFALO · CAMP CACHE"
      : game.mounted ? `DISMOUNT ${petName(game.mountId)}` : `RIDE ${petName(selected)} · +${Math.round(((MON_META[selected]?.mountSpeed || 1) - 1) * 100)}%`;
    document.getElementById("hud")?.classList.toggle("mounted", !!game.mounted);
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
      const meta = MON_META[active];
      const colors = PET_COLORS[element] || ["#b9a6e8", "#68539f"];
      set("companion-active-element", `${element.toUpperCase()} BOND · ${(meta?.role || "trail companion").toUpperCase()}`);
      set("companion-active-name", petName(active));
      set("companion-active-desc", meta?.description || `${petName(active)} follows your trail. Switch bonds freely; every companion you discover remains in this sanctuary.`);
      this.drawPet(canvas, active, Math.floor((g.t || 0) * 4));
      if (orb) { orb.style.borderColor = colors[0]; orb.style.boxShadow = `0 0 22px ${colors[1]}55, inset 0 0 16px ${colors[0]}22`; }
      if (chip) chip.style.setProperty("--pet-color", colors[0]);
    } else {
      set("companion-active-element", "NO ACTIVE BOND");
      set("companion-active-name", "Find your first companion");
      set("companion-active-desc", "Open the golden Companion Cache just south of Hearth Camp for guaranteed Puffalo. Then explore yellow cache markers for more wild bonds.");
      if (ctx) {
        ctx.fillStyle = "rgba(93,190,145,.2)"; ctx.fillRect(45, 24, 6, 48); ctx.fillRect(24, 45, 48, 6);
        ctx.strokeStyle = "rgba(128,220,176,.5)"; ctx.strokeRect(31, 31, 34, 34);
      }
    }
    if (force || this._petToken !== token) {
      this._petToken = token;
      if (!this.panels.companions?.classList.contains("hidden")) this.renderCompanions();
    }
    this.syncMount(force);
  }

  renderCompanions() {
    const grid = document.getElementById("companion-grid"); if (!grid || !this.game) return;
    const owned = new Set(Array.isArray(this.game.pets) ? this.game.pets : []);
    const active = this.game.activePetId || this.game.pet?.id;
    grid.innerHTML = "";
    for (const id of MON_IDS) {
      const isOwned = owned.has(id), isActive = id === active, isStarterHint = id === STARTER_MOUNT_ID && !isOwned;
      const meta = MON_META[id];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `companion-card ${isOwned ? "owned" : "locked"}${isActive ? " active" : ""}${isStarterHint ? " starter-hint" : ""}`;
      button.disabled = !isOwned || isActive;
      if (isActive) button.setAttribute("aria-current", "true");
      button.setAttribute("aria-label", isOwned
        ? `${isActive ? "Active companion" : "Summon"} ${petName(id)}`
        : isStarterHint ? "Puffalo starter mount—claim the golden cache south of camp" : "Undiscovered companion");
      const art = document.createElement("canvas"); art.width = 72; art.height = 72; button.appendChild(art);
      const name = document.createElement("strong"); name.textContent = isOwned || isStarterHint ? petName(id) : "Unknown"; button.appendChild(name);
      const element = document.createElement("small"); element.textContent = isOwned ? `${MON_ELEMENT[id] || "spirit"} · ${meta?.role || "companion"}` : isStarterHint ? "golden camp cache" : `${meta?.habitat || "unknown"} habitat`; button.appendChild(element);
      if (meta?.mountable) { const badge = document.createElement("i"); badge.className = "mount-badge"; badge.textContent = isStarterHint ? "STARTER" : "MOUNT"; button.appendChild(badge); }
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
    const service = npc.name === "Merchant"
      ? { panel: "shop", kicker: "TRAIL MARKET", title: "Buy supplies or sell spare loot", copy: "Instant trade using the gold and inventory in this save.", action: "OPEN MARKET" }
      : npc.name === "Warden"
        ? { autoBattle: true, panel: "battle", kicker: "AFK AUTO BATTLE", title: "Let your class hunt nearby monsters", copy: "Toggle real-time auto combat. Your traveler selects targets, closes distance, attacks, and uses class skills.", action: "TOGGLE AFK BATTLE" }
        : null;
    if (service) {
      const row = document.createElement("section"); row.className = "npc-service-card";
      row.innerHTML = `<i class="${service.panel}"></i><div><span>${service.kicker}</span><strong>${service.title}</strong><p>${service.copy}</p></div><button type="button">${service.action}</button>`;
      row.querySelector("button")?.addEventListener("click", () => {
        if (service.autoBattle) { this.close("dialog"); this.toggleAutoBattle(); }
        else this.toggle(service.panel);
      });
      wrap.prepend(row);
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
      else if (it.type === "fish") prog = Math.min(it.target, q.fishCount - a.startFish);
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
    this.syncAutoBattle();
    this.syncMount(false);
    this.syncFoodBuffs(false);
    if (!this.panels.menu?.classList.contains("hidden")) this.renderMenu();
    if (!this.panels.collection?.classList.contains("hidden")) this.renderCollection();
  }

  syncBoss(boss) {
    const hud = document.getElementById("boss-hud"); if (!hud) return;
    const visible = !!boss && !boss.dead;
    hud.classList.toggle("hidden", !visible);
    document.getElementById("hud")?.classList.toggle("boss-active", visible);
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
      action.textContent = !fishing ? "F" : fishing.auto ? "STOP" : fishing.state === "bite" ? "HOOK" : fishing.state === "hooked" ? "REEL" : "CANCEL";
      action.setAttribute("aria-label", !fishing ? "Interact" : fishing.auto ? "Stop Auto Fishing" : fishing.state === "hooked" ? "Hold to reel, release during a surge" : fishing.state === "bite" ? "Set fishing hook" : "Cancel fishing cast");
    }
    if (!fishing) return;
    const progress = Math.max(0, Math.min(1, fishing.progress || 0));
    const tension = Math.max(0, Math.min(1, fishing.tension || 0));
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    const state = fishing.auto ? (fishing.state === "hooked" ? "AUTO REELING" : fishing.state === "bite" ? "AUTO HOOK" : "AUTO CAST") : fishing.state === "bite" ? "BITE — HOOK IT!" : fishing.state === "hooked" ? "FISH ON THE LINE" : "LINE CAST";
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

  syncFoodBuffs(force = false) {
    const game = this.game; if (!game) return;
    const now = Date.now();
    if (!force && now - (this._foodBuffSyncAt || 0) < 250) return;
    this._foodBuffSyncAt = now;
    game.activeFoodBuffs = normalizeActiveBuffs(game.activeFoodBuffs, now);
    game.foodBuffTotals = activeBuffTotals(game.activeFoodBuffs, now);
    const token = game.activeFoodBuffs.map((buff) => `${buff.id}:${buff.expiresAt}`).join("|");
    const hud = document.getElementById("food-buff-hud");
    const strip = document.getElementById("cooking-buff-strip");
    const effectText = (buff) => Object.entries(buff.effects || {}).filter(([, value]) => value > 0).map(([key, value]) => `${key === "fishingLuck" ? "angler luck" : key} +${Math.round(value * 100)}%`).join(" · ");
    if (force || token !== this._foodBuffToken) {
      this._foodBuffToken = token;
      if (hud) {
        hud.innerHTML = "";
        for (const buff of game.activeFoodBuffs) {
          const chip = document.createElement("span");
          chip.dataset.buffExpires = String(buff.expiresAt || 0);
          chip.title = `${buff.name}: ${effectText(buff)}`;
          const icon = document.createElement("i");
          const slot = document.createElement("b"); slot.textContent = buff.slot.toUpperCase();
          const time = document.createElement("em");
          chip.append(icon, slot, time);
          hud.appendChild(chip);
        }
      }
      if (strip) {
        strip.innerHTML = "";
        if (!game.activeFoodBuffs.length) {
          const empty = document.createElement("p"); empty.textContent = "No food effects active. Eat a packed serving to prepare for the trail."; strip.appendChild(empty);
        } else for (const buff of game.activeFoodBuffs) {
          const card = document.createElement("article");
          const slot = document.createElement("span"); slot.textContent = buff.slot.toUpperCase();
          const name = document.createElement("strong"); name.textContent = buff.name;
          const effects = document.createElement("p"); effects.textContent = effectText(buff) || "Restorative meal";
          const time = document.createElement("time"); time.dataset.buffExpires = String(buff.expiresAt || 0);
          card.append(slot, name, effects, time);
          strip.appendChild(card);
        }
      }
    }
    for (const node of document.querySelectorAll("[data-buff-expires]")) {
      const left = Math.max(0, Math.ceil((Number(node.dataset.buffExpires) - now) / 1000));
      const value = left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : `${left}s`;
      if (node.tagName === "SPAN") { const target = node.querySelector("em"); if (target) target.textContent = value; }
      else node.textContent = value;
    }
    hud?.classList.toggle("hidden", game.activeFoodBuffs.length === 0);
    const activeCount = document.getElementById("cooking-active-count");
    if (activeCount) activeCount.textContent = game.activeFoodBuffs.length ? `${game.activeFoodBuffs.length} effect${game.activeFoodBuffs.length === 1 ? "" : "s"}` : "No meal";
  }

  renderCooking() {
    const list = document.getElementById("cooking-list"); if (!list || !this.game) return;
    const game = this.game, p = game.player;
    const known = new Set(knownRecipeIds({ level: p.level }));
    const knownCount = document.getElementById("cooking-known-count");
    if (knownCount) knownCount.textContent = `${known.size} / ${COOKING_RECIPES.length}`;
    list.innerHTML = "";
    const categoryOrder = [...new Set(COOKING_RECIPES.map((recipe) => recipe.category))];
    const sortedRecipes = [...COOKING_RECIPES].sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
    let group = "";
    for (const recipe of sortedRecipes) {
      if (recipe.category !== group) {
        group = recipe.category;
        const heading = document.createElement("h3"); heading.className = "cooking-group-title"; heading.textContent = group; list.appendChild(heading);
      }
      const unlocked = known.has(recipe.id);
      const ready = unlocked && canCook(p.inv, recipe);
      const owned = Math.max(0, p.inv[recipe.result.item] || 0);
      const row = document.createElement("article");
      row.className = `cooking-recipe${unlocked ? "" : " locked"}${ready ? " ready" : ""}`;
      const art = document.createElement("div"); art.className = "cooking-recipe-art";
      const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64;
      const foodSprite = img(`item/${recipe.result.item}`);
      const artCtx = canvas.getContext("2d");
      if (artCtx && foodSprite) { artCtx.imageSmoothingEnabled = false; artCtx.drawImage(foodSprite, 4, 4, 56, 56); }
      art.appendChild(canvas);
      const copy = document.createElement("div"); copy.className = "cooking-recipe-copy";
      const title = document.createElement("h4"); title.textContent = recipe.name;
      const desc = document.createElement("p"); desc.textContent = recipe.description;
      const ingredients = document.createElement("div"); ingredients.className = "cooking-ingredients";
      for (const [id, amount] of Object.entries(recipe.ingredients)) {
        const have = Math.max(0, p.inv[id] || 0);
        const chip = document.createElement("span"); chip.className = have >= amount ? "ok" : "missing";
        chip.textContent = `${displayIngredientName(id)} ${have}/${amount}`;
        ingredients.appendChild(chip);
      }
      const stats = document.createElement("div"); stats.className = "cooking-effects";
      const prep = document.createElement("span"); prep.textContent = `PREP ${recipe.duration}s`; stats.appendChild(prep);
      if (recipe.buff.hpRestore) { const heal = document.createElement("span"); heal.textContent = `HP +${recipe.buff.hpRestore}`; stats.appendChild(heal); }
      for (const [key, value] of Object.entries(recipe.buff.effects || {})) if (value > 0) {
        const effect = document.createElement("span"); effect.textContent = `${key === "fishingLuck" ? "LUCK" : key.toUpperCase()} +${Math.round(value * 100)}%`; stats.appendChild(effect);
      }
      if (!unlocked) { const hint = document.createElement("small"); hint.textContent = recipe.unlockHint; copy.append(title, desc, hint, ingredients, stats); }
      else copy.append(title, desc, ingredients, stats);
      const actions = document.createElement("div"); actions.className = "cooking-actions";
      const cook = document.createElement("button"); cook.type = "button"; cook.className = "cook-button"; cook.disabled = !ready;
      cook.textContent = unlocked ? (ready ? `COOK ×${recipe.result.qty}` : "NEED INGREDIENTS") : `LOCKED · LV ${recipe.unlockLevel}`;
      if (unlocked) cook.addEventListener("click", () => game.cookFood(recipe.id));
      actions.appendChild(cook);
      if (owned > 0) {
        const eat = document.createElement("button"); eat.type = "button"; eat.className = "eat-button"; eat.textContent = `EAT · ${owned} PACKED`;
        eat.addEventListener("click", () => game.eatFood(recipe.result.item)); actions.appendChild(eat);
      }
      row.append(art, copy, actions); list.appendChild(row);
    }
    this.syncFoodBuffs(true);
    clearInterval(this._cookingClock);
    this._cookingClock = setInterval(() => {
      if (this.panels.cooking?.classList.contains("hidden")) { clearInterval(this._cookingClock); return; }
      this.syncFoodBuffs(false);
    }, 1000);
  }

  renderInv() {
    const grid = document.getElementById("inv-grid"); if (!grid || !this.game) return;
    const p = this.game.player; grid.innerHTML = "";
    const keys = Object.keys(p.inv).filter(k => (p.inv[k] || 0) > 0);
    const slotCount = Math.max(20, Math.ceil(keys.length / 5) * 5);
    for (let i = 0; i < slotCount; i++) {
      const cell = document.createElement("div"); cell.className = "inv-cell";
      const id = keys[i];
      if (id) {
        const item = ITEMS[id] || FOOD_ITEMS[id] || { name: id, glyph: "?" };
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
        } else if (FOOD_ITEMS[id]) {
          cell.classList.add("food-entry");
          const canvas = document.createElement("canvas"); canvas.className = "inv-food-art"; canvas.width = 44; canvas.height = 44;
          const ctx = canvas.getContext("2d"), foodSprite = img(`item/${id}`);
          if (ctx && foodSprite) { ctx.imageSmoothingEnabled = false; ctx.drawImage(foodSprite, 0, 0, 44, 44); }
          const label = document.createElement("span"); label.className = "inv-name"; label.textContent = item.name;
          cell.append(canvas, label); cell.title = `${item.description} · Tap to eat`;
          cell.addEventListener("click", () => this.game.eatFood(id));
        } else if (img(`item/${id}`)) {
          const canvas = document.createElement("canvas"); canvas.className = "inv-material-art"; canvas.width = 40; canvas.height = 40;
          const ctx = canvas.getContext("2d"); if (ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(img(`item/${id}`), 0, 0, 40, 40); }
          const label = document.createElement("span"); label.className = "inv-name"; label.textContent = item.name;
          cell.append(canvas, label);
        } else if (ITEMS[id]?.weapon) {
          cell.classList.add("weapon-card");
          if (item.rare) cell.classList.add("rare-weapon");
          const art = document.createElement("div"); art.className = "inv-weapon-frame";
          const canvas = document.createElement("canvas"); canvas.className = "inv-weapon-art"; canvas.width = 64; canvas.height = 64;
          const frame = this.game.weaponFrames?.(id)?.walk?.down;
          const ctx = canvas.getContext("2d"); if (ctx && frame) { ctx.imageSmoothingEnabled = false; ctx.drawImage(frame, 0, 0, frame.width, frame.height, 0, 0, 64, 64); }
          art.appendChild(canvas);
          const label = document.createElement("span"); label.className = "inv-name"; label.textContent = item.name;
          const stats = document.createElement("small"); stats.className = "inv-weapon-stat";
          const weapon = this.game.WEAPONS?.[id];
          stats.textContent = weapon ? `DMG ${weapon.dmg} \u00b7 ${weapon.range}R` : "FIELD RELIC";
          cell.append(art, label, stats);
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
