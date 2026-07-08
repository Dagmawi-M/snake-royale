#!/bin/bash
# Snake Royale launcher: start the game server if needed, then open the arena screen.

PORT=8789
DIR="$HOME/snake-royale"

if ! curl -sf -o /dev/null "http://localhost:$PORT/info"; then
  setsid node "$DIR/server.js" >/dev/null 2>&1 &
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "http://localhost:$PORT/info" && break
    sleep 0.1
  done
fi

exec "$HOME/.local/share/omarchy/bin/omarchy-launch-webapp" "http://localhost:$PORT"
