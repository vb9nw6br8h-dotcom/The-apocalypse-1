# Zombie Survival: Outbreak

A co-op 3D zombie survival game with persistent progression.

## Features
- Large 160x160 survival world
- Day/night cycle with stronger nighttime zombies
- Multiple guns with different damage, magazine, fire rate, and range
- Loot chests with randomized resources
- Crafting for medkits, ammo, and weapons
- Base building: walls, floors, turrets, campfires, workbenches
- Pets: dog, wolf, robot
- Vehicles: buggy and truck
- Character outfits
- Persistent character inventory/progression and persistent room base/world state
- Mobile touch controls and PWA install support

## Run
```bash
npm install
npm start
```
Open http://localhost:3000 on desktop or phone. For internet co-op, deploy the Node server on a host that supports WebSockets and use its HTTPS URL.


## Instant Start
When this folder is hosted with the included Node server, the game automatically connects to the shared `OUTBRK` room and starts without showing a setup screen. To use a private/custom room, open the site with `?room=ABC123`.
