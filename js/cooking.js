// Pure cooking data and inventory helpers. Buff modifier values are additive
// bonuses (0.1 = +10%); timestamps used by the buff helpers are milliseconds.

export const COOKING_INGREDIENTS = Object.freeze({
  wood: { name: "Wood", shortName: "Wood", iconKey: "ingredient-wood", source: "Bamboo shoots and forest plants" },
  ore: { name: "Ore", shortName: "Ore", iconKey: "ingredient-ore", source: "Crystal nodes and armored monsters" },
  gel: { name: "Slime Gel", shortName: "Gel", iconKey: "ingredient-gel", source: "Glow vines and gel creatures" },
  herb: { name: "Herb", shortName: "Herb", iconKey: "ingredient-herb", source: "Herb bushes across the grasslands" },
  fish: { name: "Fish", shortName: "Fish", iconKey: "ingredient-fish", source: "Ponds and the eastern lake" },
  dragonscale: { name: "Dragon Scale", shortName: "Scale", iconKey: "ingredient-scale", source: "Infernyx, the world boss" },
});

const effects = (speed = 0, damage = 0, defense = 0, fishingLuck = 0) =>
  Object.freeze({ speed, damage, defense, fishingLuck });

export const COOKING_RECIPES = Object.freeze([
  {
    id: "hearth_skewer", name: "Hearth Fish Skewer", description: "Lake fish charred over bamboo and finished with bright meadow herbs.",
    iconKey: "food-skewer", ingredients: { fish: 1, wood: 1, herb: 1 }, result: { item: "food_hearth_skewer", qty: 1 },
    duration: 4, buff: { slot: "meal", duration: 45, hpRestore: 28, effects: effects(0, .04, 0, 0) },
    category: "Camp Meals", unlockLevel: 1, unlockHint: "Known from the first campfire.",
  },
  {
    id: "meadow_tea", name: "Meadow Glow Tea", description: "A clear herbal brew with a soft gel sheen and a clean, lively finish.",
    iconKey: "food-tea", ingredients: { herb: 2, gel: 1 }, result: { item: "food_meadow_tea", qty: 1 },
    duration: 3, buff: { slot: "drink", duration: 90, hpRestore: 12, effects: effects(.08, 0, 0, 0) },
    category: "Brews", unlockLevel: 1, unlockHint: "Known from the first campfire.",
  },
  {
    id: "forest_jelly", name: "Forestdrop Jelly", description: "Springy glow-gel sweets dusted with crushed aromatic leaves.",
    iconKey: "food-jelly", ingredients: { gel: 2, herb: 1 }, result: { item: "food_forest_jelly", qty: 2 },
    duration: 3, buff: { slot: "treat", duration: 105, hpRestore: 8, effects: effects(.11, 0, 0, 0) },
    category: "Trail Snacks", unlockLevel: 2, unlockHint: "Reach level 2 to learn this trail snack.",
  },
  {
    id: "smoked_lakefish", name: "Cedar-Smoked Lakefish", description: "A firm travel ration smoked low until its herbs turn crisp.",
    iconKey: "food-smoked-fish", ingredients: { fish: 2, wood: 2, herb: 1 }, result: { item: "food_smoked_lakefish", qty: 2 },
    duration: 6, buff: { slot: "meal", duration: 130, hpRestore: 18, effects: effects(0, .09, 0, 0) },
    category: "Camp Meals", unlockLevel: 3, unlockHint: "Reach level 3 to learn slow smoking.",
  },
  {
    id: "stonepot_stew", name: "Stonepot Herb Stew", description: "A restorative green stew seasoned with mineral salt from crystal ore.",
    iconKey: "food-stonepot", ingredients: { herb: 3, ore: 1, gel: 1 }, result: { item: "food_stonepot_stew", qty: 1 },
    duration: 7, buff: { slot: "meal", duration: 150, hpRestore: 38, effects: effects(0, 0, .11, 0) },
    category: "Camp Meals", unlockLevel: 4, unlockHint: "Reach level 4 to learn stonepot cooking.",
  },
  {
    id: "angler_chowder", name: "Moonpond Chowder", description: "Silky fish broth that sharpens the eye for uncommon ripples.",
    iconKey: "food-chowder", ingredients: { fish: 2, herb: 2, gel: 1 }, result: { item: "food_moonpond_chowder", qty: 1 },
    duration: 7, buff: { slot: "meal", duration: 180, hpRestore: 24, effects: effects(0, 0, .04, .16) },
    category: "Angler Fare", unlockLevel: 5, unlockHint: "Reach level 5 to learn angler fare.",
  },
  {
    id: "crystal_crisp", name: "Crystal-Salt Crisp", description: "A translucent savory wafer with a bright mineral crackle.",
    iconKey: "food-crystal-crisp", ingredients: { gel: 2, ore: 1, herb: 1 }, result: { item: "food_crystal_crisp", qty: 2 },
    duration: 5, buff: { slot: "treat", duration: 140, hpRestore: 10, effects: effects(0, .04, .08, 0) },
    category: "Trail Snacks", unlockLevel: 6, unlockHint: "Reach level 6 to learn crystal crisps.",
  },
  {
    id: "warden_broth", name: "Warden's Root Broth", description: "A deep herb broth fortified with glow gel for long forest patrols.",
    iconKey: "food-warden-broth", ingredients: { herb: 4, gel: 2, wood: 1 }, result: { item: "food_warden_broth", qty: 1 },
    duration: 8, buff: { slot: "meal", duration: 210, hpRestore: 46, effects: effects(.04, 0, .14, 0) },
    category: "Camp Meals", unlockLevel: 7, unlockHint: "Reach level 7 to learn the Warden's broth.",
  },
  {
    id: "swiftleaf_tonic", name: "Swiftleaf Tonic", description: "A cool green tonic brewed for quick feet and clean escapes.",
    iconKey: "food-swift-tonic", ingredients: { herb: 3, gel: 2 }, result: { item: "food_swiftleaf_tonic", qty: 1 },
    duration: 5, buff: { slot: "drink", duration: 170, hpRestore: 16, effects: effects(.15, 0, 0, 0) },
    category: "Brews", unlockLevel: 8, unlockHint: "Reach level 8 to learn swiftleaf brewing.",
  },
  {
    id: "hunter_hotpot", name: "Hunter's Ember Hotpot", description: "A smoky communal pot that warms the hands before a difficult hunt.",
    iconKey: "food-hotpot", ingredients: { fish: 3, herb: 3, wood: 2, ore: 1 }, result: { item: "food_hunter_hotpot", qty: 1 },
    duration: 10, buff: { slot: "meal", duration: 240, hpRestore: 54, effects: effects(0, .13, .08, 0) },
    category: "Feasts", unlockLevel: 10, unlockHint: "Reach level 10 to learn hunting feasts.",
  },
  {
    id: "starlake_soup", name: "Starlake Spirit Soup", description: "A luminous night-fishing soup said to make rare currents easier to read.",
    iconKey: "food-spirit-soup", ingredients: { fish: 3, gel: 3, herb: 3, ore: 1 }, result: { item: "food_starlake_soup", qty: 1 },
    duration: 11, buff: { slot: "meal", duration: 300, hpRestore: 48, effects: effects(.06, 0, .06, .28) },
    category: "Angler Fare", unlockLevel: 12, unlockHint: "Reach level 12 to learn spirit soup.",
  },
  {
    id: "dragonfire_platter", name: "Dragonfire Festival Platter", description: "A rare feast seared against a dragon scale, made to rally a whole boss party.",
    iconKey: "food-dragon-platter", ingredients: { fish: 4, herb: 5, wood: 2, gel: 2, dragonscale: 1 }, result: { item: "food_dragonfire_platter", qty: 2 },
    duration: 14, buff: { slot: "meal", duration: 360, hpRestore: 70, effects: effects(.08, .18, .14, .08) },
    category: "Feasts", unlockLevel: 15, unlockHint: "Reach level 15 to learn the Dragonfire platter.",
  },
]);

const RECIPE_BY_ID = new Map(COOKING_RECIPES.map((recipe) => [recipe.id, recipe]));

export const FOOD_ITEMS = Object.freeze(Object.fromEntries(COOKING_RECIPES.map((recipe) => [
  recipe.result.item,
  Object.freeze({
    id: recipe.result.item,
    name: recipe.name,
    description: recipe.description,
    iconKey: recipe.iconKey,
    category: recipe.category,
    buff: Object.freeze({
      id: recipe.result.item,
      name: recipe.name,
      iconKey: recipe.iconKey,
      ...recipe.buff,
    }),
  }),
])));

function inventoryCount(inventory, itemId) {
  const value = Number(inventory?.[itemId]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function resolveRecipe(recipeOrId) {
  const id = typeof recipeOrId === "string" ? recipeOrId : recipeOrId?.id;
  return typeof id === "string" ? RECIPE_BY_ID.get(id) || null : null;
}

export function displayIngredientName(itemId) {
  return COOKING_INGREDIENTS[itemId]?.name || FOOD_ITEMS[itemId]?.name || String(itemId || "Unknown ingredient");
}

export function formatIngredientList(ingredients = {}) {
  if (!ingredients || typeof ingredients !== "object") return [];
  return Object.entries(ingredients).map(([itemId, amount]) => `${displayIngredientName(itemId)} ×${Math.max(0, Number(amount) || 0)}`);
}

export function cookingCheck(inventory, recipeOrId) {
  const recipe = resolveRecipe(recipeOrId);
  if (!recipe) return { ok: false, code: "unknown_recipe", recipe: null, missing: [] };
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return { ok: false, code: "invalid_inventory", recipe, missing: [] };
  }
  const missing = Object.entries(recipe.ingredients).flatMap(([itemId, required]) => {
    const have = inventoryCount(inventory, itemId);
    return have >= required ? [] : [{ item: itemId, name: displayIngredientName(itemId), required, have, missing: required - have }];
  });
  return { ok: missing.length === 0, code: missing.length ? "missing_ingredients" : "ready", recipe, missing };
}

export function canCook(inventory, recipeOrId) {
  return cookingCheck(inventory, recipeOrId).ok;
}

export function cookRecipe(inventory, recipeOrId) {
  const check = cookingCheck(inventory, recipeOrId);
  if (!check.ok) return check;

  const recipe = check.recipe;
  for (const [itemId, required] of Object.entries(recipe.ingredients)) {
    inventory[itemId] = inventoryCount(inventory, itemId) - required;
  }
  const quantity = Math.max(1, Math.floor(Number(recipe.result.qty) || 1));
  inventory[recipe.result.item] = inventoryCount(inventory, recipe.result.item) + quantity;
  return {
    ok: true,
    code: "cooked",
    recipe,
    consumed: { ...recipe.ingredients },
    result: { item: recipe.result.item, qty: quantity, food: FOOD_ITEMS[recipe.result.item] },
  };
}

function explicitKnownIds(knowledge) {
  if (knowledge instanceof Set) return [...knowledge];
  if (Array.isArray(knowledge)) return knowledge;
  if (knowledge?.knownRecipeIds instanceof Set) return [...knowledge.knownRecipeIds];
  if (Array.isArray(knowledge?.knownRecipeIds)) return knowledge.knownRecipeIds;
  return null;
}

export function knownRecipeIds(knowledge = {}) {
  const explicit = explicitKnownIds(knowledge);
  if (explicit) return [...new Set(explicit)].filter((id) => RECIPE_BY_ID.has(id));
  const level = Math.max(1, Math.floor(Number(knowledge?.level) || 1));
  return COOKING_RECIPES.filter((recipe) => recipe.unlockLevel <= level).map((recipe) => recipe.id);
}

export function filterRecipes({ category = "all", query = "", knownOnly = false, knowledge = {} } = {}) {
  const needle = String(query).trim().toLowerCase();
  const known = knownOnly ? new Set(knownRecipeIds(knowledge)) : null;
  return COOKING_RECIPES.filter((recipe) => {
    if (category !== "all" && recipe.category !== category) return false;
    if (known && !known.has(recipe.id)) return false;
    return !needle || `${recipe.name} ${recipe.description} ${recipe.category}`.toLowerCase().includes(needle);
  });
}

function resolveFood(foodOrId) {
  if (typeof foodOrId === "string") return FOOD_ITEMS[foodOrId] || null;
  if (foodOrId?.id && FOOD_ITEMS[foodOrId.id]) return FOOD_ITEMS[foodOrId.id];
  if (foodOrId?.result?.item && FOOD_ITEMS[foodOrId.result.item]) return FOOD_ITEMS[foodOrId.result.item];
  return null;
}

export function normalizeActiveBuffs(activeBuffs = [], now = Date.now()) {
  if (!Array.isArray(activeBuffs)) return [];
  const bySlot = new Map();
  for (const raw of activeBuffs) {
    const food = resolveFood(raw?.id);
    const expiresAt = Number(raw?.expiresAt);
    if (!food || !Number.isFinite(expiresAt) || expiresAt <= now) continue;
    const startedAt = Number(raw?.startedAt);
    const normalized = {
      ...food.buff,
      effects: { ...food.buff.effects },
      startedAt: Number.isFinite(startedAt) ? startedAt : now,
      expiresAt,
    };
    const current = bySlot.get(normalized.slot);
    if (!current || current.expiresAt < expiresAt) bySlot.set(normalized.slot, normalized);
  }
  return [...bySlot.values()];
}

export function mergeActiveBuffs(activeBuffs = [], foodOrId, now = Date.now()) {
  const food = resolveFood(foodOrId);
  const current = normalizeActiveBuffs(activeBuffs, now);
  if (!food || food.buff.duration <= 0) return current;

  const entry = {
    ...food.buff,
    effects: { ...food.buff.effects },
    startedAt: now,
    expiresAt: now + food.buff.duration * 1000,
  };
  // One meal, drink, and treat may be active; consuming another refreshes that slot.
  return [...current.filter((buff) => buff.slot !== entry.slot), entry];
}

export function applyFoodBuff(actor, foodOrId, activeBuffs = [], now = Date.now()) {
  const food = resolveFood(foodOrId);
  if (!food) return { ok: false, code: "unknown_food", healed: 0, activeBuffs: Array.isArray(activeBuffs) ? [...activeBuffs] : [] };

  let healed = 0;
  if (actor && typeof actor === "object" && Number.isFinite(Number(actor.hp))) {
    const before = Math.max(0, Number(actor.hp));
    const maxHp = Math.max(before, Number(actor.maxHp ?? actor.maxhp ?? before) || before);
    actor.hp = Math.min(maxHp, before + Math.max(0, Number(food.buff.hpRestore) || 0));
    healed = actor.hp - before;
  }
  return { ok: true, code: "buff_applied", food, healed, activeBuffs: mergeActiveBuffs(activeBuffs, food, now) };
}

export function activeBuffTotals(activeBuffs = [], now = Date.now()) {
  const totals = { speed: 0, damage: 0, defense: 0, fishingLuck: 0 };
  for (const buff of normalizeActiveBuffs(activeBuffs, now)) {
    for (const key of Object.keys(totals)) totals[key] += Math.max(0, Number(buff.effects?.[key]) || 0);
  }
  return totals;
}

export function useFood(inventory, foodId, actor, activeBuffs = [], now = Date.now()) {
  const food = resolveFood(foodId);
  if (!food) return { ok: false, code: "unknown_food", healed: 0, activeBuffs: Array.isArray(activeBuffs) ? [...activeBuffs] : [] };
  if (!inventory || typeof inventory !== "object" || inventoryCount(inventory, food.id) < 1) {
    return { ok: false, code: "food_unavailable", food, healed: 0, activeBuffs: Array.isArray(activeBuffs) ? [...activeBuffs] : [] };
  }
  inventory[food.id] = inventoryCount(inventory, food.id) - 1;
  return applyFoodBuff(actor, food, activeBuffs, now);
}
