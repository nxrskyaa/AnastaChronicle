# Anasta Chronicle

Pixel top-down MMO-style browser adventure inspired by classic action-RPG forest wilds.

**Playable systems**
- Exploration (WASD) across a procedural forest map
- Combat: Attack (LMB), Shield (Shift), Evade (Space)
- Skills `1–4`: Power Strike · Herbal Remedy · Whirlwind · Second Wind
- Leveling + XP from slimes
- Resource gathering (timber, ore, herbs, slime gel)
- Weapon crafting (dagger / blade / axe / spear / bow)
- Inventory, chests, loot drops, minimap HUD

## Stack
- Vanilla HTML / CSS / Canvas 2D (no build step)
- Procedurally drawn **pixel-art** assets (PICO/SNES-flavored palette)
- Static deploy on **Vercel**

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| LMB | Attack / gather |
| Shift | Shield (drains stamina) |
| Space | Evade dash |
| F | Open chest / forage |
| C | Crafting forge |
| I | Inventory |
| 1–4 | Skills |
| Esc | Close panels |

## Local

```bash
# any static server
npx serve .
# or
python3 -m http.server 5173
```

Open `http://localhost:5173`

## Vercel

1. Import this repo in Vercel
2. Framework: **Other** (static)
3. Output directory: `.` (root)
4. Deploy

`vercel.json` is included for SPA-friendly routing + asset caching.

## Credits
- Game design & implementation: **nxrskyaa**
- Pixel assets generated for Anasta Chronicle
- Reference vibe: top-down action MMO forest combat (attack / shield / evade HUD)

## License
MIT
