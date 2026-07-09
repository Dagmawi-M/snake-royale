# Handoff notes

Internal dev notes for whoever (human or Claude) picks this up next. Not linked from the README on purpose — this is a working log, not user-facing docs.

## What this project is

Snake Royale: a local-network party game. One PC/laptop runs `server.js` and displays `public/host.html` on a big screen (the arena + dashboard). Players join via QR code on `public/c.html` (phone controller) and steer with a virtual joystick. Server (`server.js`) is a dumb WebSocket relay — all game logic/physics runs client-side in the host tab's JS. Everything is plain HTML/CSS/JS, no build step, no framework.

## Current state (as of the visual-overhaul session)

- Core game loop, 7 power-ups (💎⚡👻🛡️❄️ + ✂️ trim + 🌀 warp), a ☄️ comet hazard, 7 arena themes with distinct moods/floor styles/foreground decor, dashboard (QR display, theme picker, win-score picker, kick controls, live match stats), and a polished phone controller UI. All pushed to `main` on `github.com/Dagmawi-M/snake-royale`.
- `server.js` sends `Cache-Control: no-store` on all static files — added after a real bug where phones/browsers cached stale HTML and edits appeared "not working". Keep it.

## Snake visual identity: `public/snakes.js` (RESOLVED — read this before touching snake rendering)

The old "species patterns too subtle / heads all identical" problem is fixed. The architecture now:

- **`public/snakes.js`** defines `window.SnakeArt`, loaded via `<script src="/snakes.js">` by BOTH `host.html` and `c.html`. Single source of truth for species visuals:
  - `SnakeArt.SPECIES` — the 8 species (key/name/color). `c.html`'s picker and `host.html`'s `SPECIES_COLORS/NAMES` derive from it.
  - `SnakeArt.STYLE[key]` — per-species body `pattern` (+ `hood`/`rattle` flags) and a `head` spec (skull length/rear width/snout roundness, brow ridges, pupil slit|round, iris color, eye placement, stripe/pits/paleSnout/mouth markings).
  - `SnakeArt.headSprite(key, color, u)` — pre-renders a species head facing +X into a cached offscreen canvas at 3× supersampling; returns `{c, w, h, ax, ay, snout, hood}` in caller px (anchor `ax/ay` = the point the game rotates around). Cobra hood is part of the sprite, drawn *behind* the anchor.
  - `SnakeArt.markAt(g, pattern, x, y, tx, ty, w, k, dark, light)` — one chunky full-width pattern block at a trail point (bands/rings/diamonds/blotches/chevrons/zigzag/speckle). Used by the arena's `drawTrails()` AND the previews, so patterns match everywhere.
  - `SnakeArt.paintPreview(canvas, key, color, {headOnly})` — self-contained S-curved snake (or head icon) used by: c.html join-screen preview, species chips, species-overlay preview, topbar swatch; host.html dashboard player rows.
  - `SnakeArt.shade(color, amt)` — mix any CSS color (incl. `hsl()`) toward black/white; resolves colors via a 1px scratch canvas.
- Players carry `p.styleKey` (species key, or cycled default via `SnakeArt.styleKeyFor(speciesKey, idx)`) + `p.style` (the STYLE object). The host's `species` message handler updates both, so switching species on the phone changes the head + pattern live. Phones show it instantly via the previews.
- Body render (`drawTrails` in host.html): dark outline → color body → thin white dorsal highlight → `markAt` pattern pass (step ≈ `tw*3.2/POINT_GAP`, alpha ≈ 1.0 near head) → traveling sheen. `trailW = max(4, minDim*0.0088)`.
- Head render (`drawHeads`): status rings + boost streak (live), then one sprite blit at `u = hr*1.55` (visual only — collision radius `hr` unchanged), cobra hood breathes via y-scale, tongue flick drawn live at `spr.snout * u`. Rattlesnake tail rattle drawn live at trail tip.
- Verified by real screenshots: all 8 heads are visibly distinct (cobra hood+spectacle, viper/rattler brow ridges + slit pupils, anaconda high round eyes + stripe, mamba slender dark mouth, taipan pale snout, python lip pits), and bands/rings/zigzag/blotches read from across the room. README screenshots regenerated from this state.

## How to verify visual changes without guessing (IMPORTANT — the reliable method)

No test harness exists. The **CDP screenshot script** is the reliable approach (virtual-time-budget screenshots race the real-time WebSocket and miss game state — that cost a lot of time; don't go back to it):

1. Keep a headless browser running: `chromium --headless --disable-gpu --no-sandbox --user-data-dir=<scratch-dir> --remote-debugging-port=9222 about:blank` (MUST use a separate `--user-data-dir`, or it silently collides with the user's real browser profile).
2. Use a `shoot.js` like the one from this session (lives in the session scratchpad; trivially re-writable): PUT `/json/new?<url>` on port 9222, attach via `ws` (require it from `/home/dagmawi/snake-royale/node_modules/ws`), `Emulation.setDeviceMetricsOverride`, optional `Runtime.evaluate` (e.g. to click Join on c.html), wait REAL milliseconds, `Page.captureScreenshot`. `/json/close/<id>` returns non-JSON — don't parse it.
3. Bot players: connect `ws` clients, send `{t:'hello',role:'ctrl',name,species}`, then re-send `{t:'ready',v:true}` every ~1s (the roster snapshot a late-joining host receives does NOT include ready state, and messages relayed before the host connects are dropped — repeating ready solves both). Steer with `{t:'in',x,y}` every 80ms; `ang += 0.07` per tick gives tight circles that won't hit walls.
4. Start bots ~1s before the shot; countdown is 3s after all ready; shoot at ~11s for a mid-round shot with long trails.
5. Crop with `magick <in> -crop WxH+X+Y +repage -resize 160% <out>` and actually LOOK at the PNG with the Read tool before declaring a visual change done.
6. Kill bot node processes after (`kill $BOT`); the game server runs fine in the background via the harness's `run_in_background` (plain `nohup ... &` inside a sandboxed Bash call gets reaped between calls — another time sink; don't).

## Other notes

- No automated tests. Syntax check = extract `<script>` blocks → `new Function(...)`, plus `node -c server.js`.
- GitHub repo housekeeping (profile cleanup, private-ing old repos, bio) was done in an earlier session — unrelated to game work.
- The user cares a lot about: snakes looking like real snakes, species being visually distinct everywhere (arena + phone + dashboard), professional UI, and NO AI attribution in anything public-facing (commits are authored solely as Dagmawi-M, no Co-Authored-By trailers).
