# Handoff notes

Internal dev notes for whoever (human or Claude) picks this up next. Not linked from the README on purpose — this is a working log, not user-facing docs.

## What this project is

Snake Royale: a local-network party game. One PC/laptop runs `server.js` and displays `public/host.html` on a big screen (the arena + dashboard). Players join via QR code on `public/c.html` (phone controller) and steer with a virtual joystick. Server (`server.js`) is a dumb WebSocket relay — all game logic/physics runs client-side in the host tab's JS. Everything is plain HTML/CSS/JS, no build step, no framework.

## Current state (as of this session)

- Core game loop, 5 power-ups + 2 new ones (✂️ trim, 🌀 warp), a ☄️ comet hazard, 7 arena themes with distinct moods/floor styles/foreground decor, an 8-species cosmetic system, dashboard (QR display, theme picker, win-score picker, kick controls, live match stats), and a redesigned phone controller UI are all implemented and pushed to `main` on `github.com/Dagmawi-M/snake-royale`.
- `server.js` sends `Cache-Control: no-store` on all static files — this was added after a real bug where phones/browsers cached stale HTML and the user thought edits weren't working. Keep it.

## Open problem: species patterns are too subtle (unresolved)

The user's core complaint, still not properly fixed: each snake species (`SPECIES_STYLE` in `host.html`, ~line 470) is supposed to have a visually distinct body pattern (bands, blotches, diamonds, chevrons, rings, zigzag, speckle, plain), drawn in `drawTrails()` (~line 1367) as small marks computed from local trail tangents.

**Verified by actual screenshots** (see investigation method below) that roughly half the patterns don't read at normal viewing distance: viper's zigzag, boa's bands, anaconda's rings, and taipan's speckle are all close to invisible. Python's blotches and rattlesnake's diamonds+rattle read fine. Cobra's chevrons are borderline.

Root cause (not a bug, a scale problem): `trailW()` is only ~5–7px on a real screen (`Math.max(3.5, minDim * 0.0075)`), so a pattern mark has 2-3px to work with — canvas 2D stroke rendering doesn't anti-alias thin diagonal marks well at that scale, and they smear into noise instead of reading as shapes.

**Recommended real fix** (not yet attempted): stop drawing thin geometric marks *on* a thin stroke. Either (a) meaningfully thicken the body render width, or (b) switch from line-stroke pattern marks to solid color-block segments (alternating fill colors along the body width, like the actual bands/blotches species already sort of do) so there's enough surface area to read at a glance. This is a genuine rendering redesign, not a tweak — budget real time for it, and re-screenshot to verify before declaring it fixed instead of eyeballing the code.

## How to verify visual changes without guessing (important — read this before touching rendering code)

There is no headless test harness in this repo. The method that actually worked this session, after some trial and error:

1. **Chromium is available** at `/usr/bin/chromium` and works headless, but **you MUST pass a separate `--user-data-dir`** pointing somewhere in the scratchpad. Without it, headless chromium silently collides with the user's actual running browser profile and hangs or fails with no useful error. This cost significant time to diagnose — don't repeat it.
2. **Bot players**: connect fake controller clients directly to the WebSocket server with `ws` (already a dependency) to populate the arena without needing real phones. Example pattern used this session:
   ```js
   const WebSocket = require('ws');
   const ws = new WebSocket('ws://localhost:8789');
   ws.on('open', () => ws.send(JSON.stringify({t:'hello', role:'ctrl', name:'cobra', species:'cobra'})));
   ws.on('message', d => {
     const m = JSON.parse(d);
     if (m.t === 'id') {
       ws.send(JSON.stringify({t:'ready', v:true}));
       let ang = 0;
       setInterval(() => { ang += 0.03; ws.send(JSON.stringify({t:'in', x: Math.cos(ang), y: Math.sin(ang)*0.5})); }, 80);
     }
   });
   ```
3. **Ordering matters**: launch the chromium "host" tab FIRST (it registers as the authoritative host and runs the physics loop), THEN start bot connections a couple seconds later. If bots connect before any host is registered, their `join` broadcast is dropped (server only relays to a live host; roster-on-connect covers late-joining hosts, but there's a race — give it margin, 2-3s sleep before bots, and use `--virtual-time-budget` of 6000+ so the countdown/physics has time to actually run inside the headless session).
4. Screenshot with `chromium --headless --disable-gpu --no-sandbox --user-data-dir=<scratch dir> --window-size=1920,1080 --virtual-time-budget=<ms> --screenshot=<path> <url>`.
5. Crop with `magick <in> -crop WxH+X+Y +repage <out>` (ImageMagick is available as `magick`/`convert`) — snake spawn position varies by player count/order, so check the full frame first before assuming a fixed crop box.
6. Read the resulting PNG with the Read tool to actually look at it. Don't assume a change worked from reading code — this session found real, user-confirmed-by-screenshot gaps that code review alone had missed.

Clean up bot node processes and chromium after (`pkill -f "ws://localhost:8789"`) — they don't self-terminate reliably if a screenshot times out.

## Other loose threads

- No automated tests exist at all. All verification has been manual (syntax check via `new Function()` extraction from `<script>` tags + live screenshots).
- GitHub repo housekeeping (unrelated to the game) was also done this session: old fork/toy repos on the user's GitHub were made private, bio updated, `snake-royale` description set. Not relevant to future game work, mentioned here only so it's not a surprise if referenced.
