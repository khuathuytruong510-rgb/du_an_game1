# Chiến Giới — Auto Battle prototype

Web game prototype built with Vue 3, Pinia, Vite, and the Phaser 4 version declared by this project.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## Accounts and PostgreSQL sync

The account API requires PostgreSQL. Create a database (for example, `chien_gioi`), copy `.env.example` to `.env`, and set `DATABASE_URL` to a PostgreSQL connection string with permission to create tables. The API process loads this `.env` file when it starts. For example:

```text
DATABASE_URL=postgres://postgres:your-password@127.0.0.1:5432/chien_gioi
```

In one terminal, start the API:

```sh
npm run dev:api
```

The API applies the SQL migration on startup and listens on `127.0.0.1:3001` by default. In another terminal, run `npm run dev`. Vite proxies `/api` requests to the API. Set `API_PORT` and `FRONTEND_ORIGINS` in `.env` if your local setup uses different values.

Run the API checks with:

```sh
npm run build:api
npm run test:api
```

Accounts use salted scrypt password hashes and HttpOnly session cookies. Registering can transfer the current local save; signing in restores the account save, and subsequent saves sync to the server. Logging out leaves the local save intact.

The API validates character data, but combat, drops, quest rewards, purchases, and progression are still calculated in the browser. Weapon enhancement is calculated server-side with a cryptographic random roll and a PostgreSQL row lock/transaction. However, the existing whole-character save endpoint still accepts valid gold and inventory values from the client, so this limited enhancement endpoint does not make the overall game server-authoritative or prevent a modified client from forging progress.

## Optional Laragon PHP/MySQL forge demo

Run `game_db.sql` in HeidiSQL to create and seed the optional MySQL demo database. The sample account is `player1` with 10,000 gold; its development-only password is `local-demo-change-me` and must not be used in production. `upgrade.php` is a standalone MySQL version of the forge endpoint; it is not wired into the Vue game's existing PostgreSQL API. A trusted PHP login flow must establish the session and set `$_SESSION['user_id']`. The JSON `user_id` is checked against that session and is never used as the authorization source.

Configure `GAME_DB_USER` and `GAME_DB_PASSWORD` in the PHP/Apache process environment. Optional settings are `GAME_DB_HOST`, `GAME_DB_PORT`, `GAME_DB_NAME`, and `GAME_ALLOWED_ORIGIN` (for example, `http://localhost:5173` when calling from the Vite dev server). The endpoint requires POST JSON with integer `user_id` and `inventory_id`, uses an InnoDB transaction and row locks, and uses PHP's cryptographic `random_int()` rather than `rand()`. Do not expose it to the game UI until its login session and allowed origin are configured.

## Authoritative game protocol

`src/shared/gameProtocol.ts` defines the version 1 message contract for the real-time game connection. Every message carries a protocol version; unsupported versions and malformed commands are rejected by the shared decoders. Client commands express intent only (movement input, target, action, item, or NPC); clients must never submit damage, character positions, rewards, or resulting monster health as trusted values.

The API now accepts authenticated WebSocket connections at `/api/game`, validates the configured Origin and HttpOnly session cookie, requires a protocol-versioned zone join, limits message size/rate, and revalidates the session on every message. The training-ground simulation owns connected players' movement, monster state, attack range/cooldowns, damage, death/respawn, basic drops-free EXP and gold rewards, and potion use. Snapshots are sent at 10 Hz; client commands never supply position, damage, or reward values.

This is an authenticated-session-only vertical slice. Simulation state is currently in memory and is discarded on disconnect/server restart; loot drops, quest updates, forging interactions, and durable combat progression are not connected to it. The existing account save endpoint still accepts valid client character data, so overall progression remains forgeable and disconnected-client saves can overwrite progress. Offline guests retain local combat. The local Vite `/api` proxy forwards WebSocket upgrades; start PostgreSQL and `npm run dev:api` before connecting. The game socket uses the HttpOnly session cookie and never accepts session tokens in the URL or message body.

## Prototype controls

- Turn Auto Battle on or off with the button at the bottom of the screen.
- When Auto is off, move with WASD or the arrow keys.
- When Auto is off, click the ground to walk to that horizontal position; clicking a monster still selects it. Keyboard or touch movement cancels the click destination.
- Click the **Thợ rèn** NPC in the game world to open the forge overlay without leaving the map.
- On screens up to 700 px wide, use the on-screen directional pad to move and the adjacent battle buttons to attack, cast skills, use potions, or toggle Auto; hold two directions to move diagonally.
- Click a monster to select it; use **ĐÁNH MỤC TIÊU** when it is in range. Manual attacks share the 850 ms attack cooldown with Auto Battle.
- Use the previous/next target buttons in the battle panel to cycle through living monsters without clicking their sprites.
- The selected monster is highlighted with a ring; the ring turns green when it is within attack range.
- The battle panel shows the selected monster's distance and whether it is within attack range; manual attack and skill buttons stay disabled until it is.
- Use **Áp sát mục tiêu** to move toward a distant selected monster and stop at attack range without attacking automatically. Cancel the approach with **Dừng áp sát**, movement input, or by selecting another target.
- Manual attack and skill buttons display their remaining cooldown; the skill button also indicates when MP is insufficient.
- Auto selects nearby monsters, moves into attack range, attacks, and uses a skill when enough MP is available.
- When Auto is off, select a nearby monster and use **KỸ NĂNG · 15 MP** for a double-damage attack; the skill has a 4-second cooldown.
- MP regenerates by 1 point per second while below the level-based maximum; press **Q** to use the selected-target skill while Auto is off.
- Nearby monsters attack back. If HP reaches zero, Auto Battle turns off and the character respawns at the starting point after 3 seconds with half HP.
- The battle panel shows the selected monster's current HP and updates as it takes damage.
- Active quest progress is visible during combat; completed quests can still be claimed from the inventory screen.
- Attacks have a 10% critical-hit chance; a critical deals double damage and displays a distinct combat message.
- Weapons increase attack power; armor reduces incoming damage by its defense value (at least 1 damage is always taken).
- Defeated monsters grant EXP and type-based random gold (Slimes: 2–5, young wolves: 5–9, Goblins: 8–14), may drop equipment, and respawn after a short delay.
- Leveling up restores HP and MP to their new maximum, grants 10 gold, and displays a level-up effect above the character.
- Monsters can drop healing potions; use one from the inventory or press **E** during combat to restore up to 50 HP (not usable while defeated or already at full HP).
- Auto Battle automatically uses a healing potion when HP reaches or falls below the configured threshold (25%, 35%, or 50%), with a 2-second use cooldown. Choose the threshold in Settings.
- Collect spirit shards, equip or unequip gear, and claim completed quests in the inventory screen. Unequipping requires a free inventory slot.
- Sell items individually or sell an entire stack for gold (materials: 2 each, potions: 3 each, gear: 5 plus twice its stat bonus).
- Buy healing potions individually or in batches of five for 20 gold each; purchases stack with existing potions and require an available slot otherwise.
- Buy a practice sword (+4 ATK, 80 gold) or leather armor (+2 DEF, 60 gold) from the inventory shop; bought gear is added unequipped.
- Enhance an inventory weapon from the forge panel when signed in: +0 to +1 costs 1,000 gold at 90%, +1 to +2 costs 2,000 at 70%, and +2 to +3 costs 3,000 at 50%. Success increases the weapon's current attack by 10% (rounded to a whole point); failure still charges the fee.
- Stackable materials and consumables can still be collected when all 20 inventory slots are occupied, if their stack already exists.
- Character progress is saved in this browser and restored after a reload; Auto Battle is always off after restoring a save.

The map and characters currently use Phaser-drawn placeholder shapes. Progress is saved locally and can optionally be synced to an account; Auto Battle is always off after restoring a save. Server-authoritative combat, dungeons, and multiplayer are not part of this prototype yet.
