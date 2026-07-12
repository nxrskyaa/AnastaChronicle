// Pure market data and transactional inventory helpers. This module deliberately
// has no DOM or Game dependency, so the same checks can be reused by desktop,
// mobile, and any future authoritative server implementation.

export const SHOP_CATEGORIES = Object.freeze([
  Object.freeze({ id: "all", name: "All wares" }),
  Object.freeze({ id: "supplies", name: "Field supplies" }),
  Object.freeze({ id: "provisions", name: "Cooked provisions" }),
  Object.freeze({ id: "fishing", name: "Fishing gear" }),
  Object.freeze({ id: "equipment", name: "Equipment" }),
  Object.freeze({ id: "relics", name: "Rare relics" }),
]);

function listing(data) {
  const tags = [...(data.tags || [])];
  const visualKind = data.visualKind
    || (tags.includes("weapon") ? "weapon"
      : tags.includes("food") ? "food"
        : tags.includes("rod") ? "rod"
          : data.id === "fish" ? "fish" : "item");
  return Object.freeze({
    buyPrice: null,
    sellPrice: 0,
    unlockLevel: 1,
    featuredEligible: false,
    glyph: "?",
    visualKind,
    ...data,
    tags: Object.freeze(tags),
  });
}

// Buy prices intentionally stay well above the value of gathered ingredients;
// the shop is a convenience/gold sink while gathering, crafting, and cooking
// remain the strongest progression routes. Crafted and rare gear is sell-only.
export const SHOP_CATALOG = Object.freeze([
  listing({ id: "wood", name: "Bamboo Wood", description: "Dry, flexible timber for forging and camp recipes.", category: "supplies", iconKey: "item/wood", buyPrice: 8, sellPrice: 3, featuredEligible: true, tags: ["material", "crafting"] }),
  listing({ id: "herb", name: "Meadow Herb", description: "Fresh aromatic leaves used by cooks and alchemists.", category: "supplies", iconKey: "item/herb", buyPrice: 10, sellPrice: 4, featuredEligible: true, tags: ["material", "cooking"] }),
  listing({ id: "gel", name: "Slime Gel", description: "Luminous binding gel gathered from forest creatures.", category: "supplies", iconKey: "item/gel", buyPrice: 14, sellPrice: 5, unlockLevel: 2, featuredEligible: true, tags: ["material", "crafting", "cooking"] }),
  listing({ id: "fish", name: "Fresh Lake Fish", description: "A mixed catch ready for a hearth recipe.", category: "supplies", iconKey: "item/fish", buyPrice: 18, sellPrice: 2, unlockLevel: 2, featuredEligible: true, tags: ["material", "fishing", "cooking"] }),
  listing({ id: "ore", name: "Crystal Ore", description: "Refined camp stock for players short on one last ingot.", category: "supplies", iconKey: "item/ore", buyPrice: 22, sellPrice: 8, unlockLevel: 3, featuredEligible: true, tags: ["material", "forging"] }),
  listing({ id: "dragonscale", name: "Dragon Scale", description: "A warm trophy shed by Infernyx. Merchants cannot source it.", category: "relics", iconKey: "item/dragonscale", sellPrice: 180, unlockLevel: 12, tags: ["boss", "rare", "material"] }),

  listing({ id: "food_hearth_skewer", name: "Hearth Fish Skewer", description: "A dependable field meal with a small attack boost.", category: "provisions", iconKey: "item/food_hearth_skewer", buyPrice: 46, sellPrice: 12, featuredEligible: true, tags: ["food", "meal"] }),
  listing({ id: "food_meadow_tea", name: "Meadow Glow Tea", description: "A bright drink for a short burst of movement speed.", category: "provisions", iconKey: "item/food_meadow_tea", buyPrice: 38, sellPrice: 10, featuredEligible: true, tags: ["food", "drink"] }),
  listing({ id: "food_forest_jelly", name: "Forestdrop Jelly", description: "A springy travel treat made from herbs and glow gel.", category: "provisions", iconKey: "item/food_forest_jelly", buyPrice: 52, sellPrice: 13, unlockLevel: 2, featuredEligible: true, tags: ["food", "treat"] }),
  listing({ id: "food_smoked_lakefish", name: "Cedar-Smoked Lakefish", description: "Long-lasting rations for an extended hunt.", category: "provisions", iconKey: "item/food_smoked_lakefish", buyPrice: 72, sellPrice: 18, unlockLevel: 3, featuredEligible: true, tags: ["food", "meal"] }),
  listing({ id: "food_stonepot_stew", name: "Stonepot Herb Stew", description: "Restorative stew with a defensive finish.", category: "provisions", iconKey: "item/food_stonepot_stew", buyPrice: 96, sellPrice: 24, unlockLevel: 4, tags: ["food", "meal"] }),
  listing({ id: "food_moonpond_chowder", name: "Moonpond Chowder", description: "Angler fare that improves fishing luck.", category: "provisions", iconKey: "item/food_moonpond_chowder", buyPrice: 118, sellPrice: 29, unlockLevel: 5, tags: ["food", "meal", "fishing"] }),
  listing({ id: "food_crystal_crisp", name: "Crystal-Salt Crisp", description: "A savory trail snack with a mineral crackle.", category: "provisions", iconKey: "item/food_crystal_crisp", sellPrice: 24, unlockLevel: 6, tags: ["food", "treat"] }),
  listing({ id: "food_warden_broth", name: "Warden's Root Broth", description: "A patrol meal that restores health and hardens defenses.", category: "provisions", iconKey: "item/food_warden_broth", sellPrice: 34, unlockLevel: 7, tags: ["food", "meal"] }),
  listing({ id: "food_swiftleaf_tonic", name: "Swiftleaf Tonic", description: "A brisk herbal drink prepared for quick escapes.", category: "provisions", iconKey: "item/food_swiftleaf_tonic", sellPrice: 31, unlockLevel: 8, tags: ["food", "drink"] }),
  listing({ id: "food_hunter_hotpot", name: "Hunter's Ember Hotpot", description: "A hearty communal meal for difficult hunts.", category: "provisions", iconKey: "item/food_hunter_hotpot", sellPrice: 48, unlockLevel: 10, tags: ["food", "meal"] }),
  listing({ id: "food_starlake_soup", name: "Starlake Spirit Soup", description: "Luminous soup prized by moonlit anglers.", category: "provisions", iconKey: "item/food_starlake_soup", sellPrice: 64, unlockLevel: 12, tags: ["food", "meal", "fishing"] }),
  listing({ id: "food_dragonfire_platter", name: "Dragonfire Festival Platter", description: "A rare boss-party feast seared against a dragon scale.", category: "relics", iconKey: "item/food_dragonfire_platter", sellPrice: 150, unlockLevel: 15, tags: ["food", "meal", "boss", "rare"] }),

  listing({ id: "basicrod", name: "Willow Rod", description: "Reliable replacement gear for a new angler.", category: "fishing", iconKey: "item/basicrod", buyPrice: 85, sellPrice: 20, featuredEligible: true, tags: ["rod", "fishing"] }),
  listing({ id: "ironrod", name: "Ironwood Rod", description: "A crafted rod with stronger reel speed and control.", category: "fishing", iconKey: "item/ironrod", sellPrice: 60, unlockLevel: 5, tags: ["rod", "fishing", "crafted"] }),
  listing({ id: "spiritrod", name: "Spiritglass Rod", description: "A masterwork rod attuned to rare currents.", category: "relics", iconKey: "item/spiritrod", sellPrice: 140, unlockLevel: 12, tags: ["rod", "fishing", "rare", "crafted"] }),

  listing({ id: "sword", name: "Sword", description: "Balanced forged blade for warrior adventurers.", category: "equipment", iconKey: "item/sword", sellPrice: 30, tags: ["weapon", "warrior", "crafted"] }),
  listing({ id: "axe", name: "Axe", description: "Heavy forged cleaver built for burst damage.", category: "equipment", iconKey: "item/axe", sellPrice: 40, tags: ["weapon", "warrior", "crafted"] }),
  listing({ id: "spear", name: "Spear", description: "Long-reaching forged weapon for safer engagements.", category: "equipment", iconKey: "item/spear", sellPrice: 38, tags: ["weapon", "warrior", "crafted"] }),
  listing({ id: "dagger", name: "Dagger", description: "Light all-class weapon for rapid strikes.", category: "equipment", iconKey: "item/dagger", sellPrice: 24, tags: ["weapon", "crafted"] }),
  listing({ id: "bow", name: "Bow", description: "A crafted ranged weapon for archers.", category: "equipment", iconKey: "item/bow", sellPrice: 45, unlockLevel: 3, tags: ["weapon", "archer", "crafted"] }),
  listing({ id: "staff", name: "Staff", description: "A crafted fire catalyst for mages.", category: "equipment", iconKey: "item/staff", sellPrice: 52, unlockLevel: 3, tags: ["weapon", "mage", "crafted"] }),
  listing({ id: "dragonblade", name: "Dragon Blade", description: "A legendary melee weapon tempered in dragonfire.", category: "relics", iconKey: "item/dragonblade", sellPrice: 250, unlockLevel: 12, tags: ["weapon", "warrior", "boss", "rare"] }),
  listing({ id: "dragonbow", name: "Dragon Bow", description: "A legendary bow reinforced by a dragon scale.", category: "relics", iconKey: "item/dragonbow", sellPrice: 250, unlockLevel: 12, tags: ["weapon", "archer", "boss", "rare"] }),
  listing({ id: "dragonstaff", name: "Dragon Staff", description: "A legendary catalyst that channels dragonfire.", category: "relics", iconKey: "item/dragonstaff", sellPrice: 250, unlockLevel: 12, tags: ["weapon", "mage", "boss", "rare"] }),
]);

const LISTING_BY_ID = new Map(SHOP_CATALOG.map((entry) => [entry.id, entry]));
const FEATURED_IDS = SHOP_CATALOG.filter((entry) => entry.featuredEligible && entry.buyPrice).map((entry) => entry.id);

export function inventoryCount(inventory, itemId) {
  const value = Number(inventory?.[itemId]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function getShopListing(itemOrId) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  return typeof id === "string" ? LISTING_BY_ID.get(id) || null : null;
}

export function marketDayKey(timestamp = Date.now()) {
  const value = Number(timestamp);
  return Number.isFinite(value) ? Math.floor(value / 86400000) : 0;
}

function hashKey(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash;
}

export function dailyFeaturedId(dayKey = 0) {
  return FEATURED_IDS.length ? FEATURED_IDS[hashKey(dayKey) % FEATURED_IDS.length] : null;
}

export function shopUnitPrice(itemOrId, side = "buy", dayKey = 0) {
  const entry = getShopListing(itemOrId);
  if (!entry) return null;
  if (side === "sell") return entry.sellPrice > 0 ? entry.sellPrice : null;
  if (side !== "buy" || !entry.buyPrice) return null;
  return entry.id === dailyFeaturedId(dayKey) ? Math.max(1, Math.round(entry.buyPrice * .85)) : entry.buyPrice;
}

function quantityCheck(quantity) {
  const value = Number(quantity);
  return Number.isSafeInteger(value) && value >= 1 && value <= 99
    ? { ok: true, quantity: value }
    : { ok: false, code: "invalid_quantity", quantity: 0 };
}

function inventoryCheck(inventory) {
  return !!inventory && typeof inventory === "object" && !Array.isArray(inventory);
}

function protectedSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

export function buyCheck(inventory, gold, itemOrId, quantity = 1, options = {}) {
  const context = options && typeof options === "object" ? options : {};
  const entry = getShopListing(itemOrId);
  if (!entry) return { ok: false, code: "unknown_item", listing: null };
  if (!inventoryCheck(inventory)) return { ok: false, code: "invalid_inventory", listing: entry };
  const quantityResult = quantityCheck(quantity);
  if (!quantityResult.ok) return { ...quantityResult, listing: entry };
  const wallet = Number(gold);
  if (!Number.isSafeInteger(wallet) || wallet < 0) return { ok: false, code: "invalid_gold", listing: entry };
  const level = Math.max(1, Math.floor(Number(context.level) || 1));
  if (level < entry.unlockLevel) return { ok: false, code: "level_locked", listing: entry, requiredLevel: entry.unlockLevel };
  const unitPrice = shopUnitPrice(entry, "buy", context.dayKey ?? 0);
  if (!unitPrice) return { ok: false, code: "not_for_sale", listing: entry };
  const total = unitPrice * quantityResult.quantity;
  if (wallet < total) return { ok: false, code: "insufficient_gold", listing: entry, quantity: quantityResult.quantity, unitPrice, total, gold: Math.floor(wallet), shortfall: total - wallet };
  return { ok: true, code: "ready", listing: entry, itemId: entry.id, quantity: quantityResult.quantity, unitPrice, total, gold: Math.floor(wallet), remainingGold: Math.floor(wallet - total) };
}

export function buyItem(inventory, gold, itemOrId, quantity = 1, options = {}) {
  const check = buyCheck(inventory, gold, itemOrId, quantity, options);
  if (!check.ok) return check;
  inventory[check.itemId] = inventoryCount(inventory, check.itemId) + check.quantity;
  return { ...check, code: "purchased", inventory, gold: check.remainingGold };
}

export function sellCheck(inventory, itemOrId, quantity = 1, options = {}) {
  const context = options && typeof options === "object" ? options : {};
  const entry = getShopListing(itemOrId);
  if (!entry) return { ok: false, code: "unknown_item", listing: null };
  if (!inventoryCheck(inventory)) return { ok: false, code: "invalid_inventory", listing: entry };
  const quantityResult = quantityCheck(quantity);
  if (!quantityResult.ok) return { ...quantityResult, listing: entry };
  if (protectedSet(context.protectedItems).has(entry.id)) return { ok: false, code: "protected_item", listing: entry };
  const unitPrice = shopUnitPrice(entry, "sell", context.dayKey ?? 0);
  if (!unitPrice) return { ok: false, code: "merchant_refuses", listing: entry };
  const have = inventoryCount(inventory, entry.id);
  if (have < quantityResult.quantity) return { ok: false, code: "insufficient_items", listing: entry, quantity: quantityResult.quantity, have, missing: quantityResult.quantity - have };
  const total = unitPrice * quantityResult.quantity;
  return { ok: true, code: "ready", listing: entry, itemId: entry.id, quantity: quantityResult.quantity, unitPrice, total, have, remaining: have - quantityResult.quantity };
}

export function sellItem(inventory, gold, itemOrId, quantity = 1, options = {}) {
  const wallet = Number(gold);
  if (!Number.isSafeInteger(wallet) || wallet < 0) return { ok: false, code: "invalid_gold", listing: getShopListing(itemOrId) };
  const check = sellCheck(inventory, itemOrId, quantity, options);
  if (!check.ok) return check;
  inventory[check.itemId] = check.remaining;
  return { ...check, code: "sold", inventory, gold: Math.floor(wallet + check.total) };
}

export function shopView({ mode = "buy", category = "all", query = "", level = 1, inventory = {}, dayKey = 0, includeLocked = true } = {}) {
  const needle = String(query).trim().toLowerCase();
  const featuredId = dailyFeaturedId(dayKey);
  return SHOP_CATALOG.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (mode === "buy" && !entry.buyPrice) return false;
    if (mode === "sell" && inventoryCount(inventory, entry.id) < 1) return false;
    if (!includeLocked && level < entry.unlockLevel) return false;
    const searchable = `${entry.name} ${entry.description} ${entry.category} ${entry.tags.join(" ")}`.toLowerCase();
    return !needle || searchable.includes(needle);
  }).map((entry) => Object.freeze({
    ...entry,
    owned: inventoryCount(inventory, entry.id),
    locked: level < entry.unlockLevel,
    featured: mode === "buy" && entry.id === featuredId,
    unitPrice: shopUnitPrice(entry, mode === "sell" ? "sell" : "buy", dayKey),
  }));
}
