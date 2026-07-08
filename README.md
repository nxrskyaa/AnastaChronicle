# Anasta Chronicle

2.5D top-down action adventure in the Forest of Anasta.

Inspired by classic action-MMO forest combat: attack / shield / evade, action bar, minimap, slimes, crafting and leveling.

## Play

**Live:** https://anasta-chronicle.vercel.app

## Stack
- **Three.js** (CDN, no build)
- Procedural low-poly + flat-shaded “pixel 2.5D” world
- Vanilla HUD

## Systems
- WASD + click-to-move
- Combat: LMB attack · Shift shield · Space evade
- Skills 1–4
- XP / leveling
- Gather timber, ore, herbs, slime gel
- Weapon forge (blade, axe, spear, bow)
- Chests, loot drops, minimap

## Local
```bash
python3 -m http.server 5173
# open http://localhost:5173
```

## Vercel
Static deploy — `vercel.json` sets `framework: null`.

## Controls
| Input | Action |
|-------|--------|
| WASD / click | Move |
| LMB | Attack (on enemy) / move |
| Shift | Shield |
| Space | Evade |
| F | Chest / forage |
| C | Craft |
| I | Inventory |
| 1–4 | Skills |

## License
MIT · nxrskyaa
