const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { WebSocketServer } = require("ws");
const QRCode = require("qrcode");

const PORT = 8789;
const PUB = path.join(__dirname, "public");

// Enumerate joinable addresses. LAN (Wi-Fi/Ethernet) is primary — phones
// must share a network with the laptop. VPN is listed too, but whether
// client-to-client traffic works depends on the VPN's own policy.
function addresses() {
  const skip = /^(docker|br-|veth|wwan|lo)/;
  const label = (n) =>
    n.startsWith("wl") ? "Wi-Fi" :
    /^(enp|eth|en)/.test(n) ? "Ethernet" :
    /^(gpd|tun|tailscale|wg)/.test(n) ? "VPN" : n;
  const rank = { "Wi-Fi": 0, "Ethernet": 1, "VPN": 2 };
  const all = [];
  for (const [name, ifs] of Object.entries(os.networkInterfaces())) {
    for (const i of ifs || []) {
      if (i.family === "IPv4" && !i.internal && !skip.test(name)) {
        all.push({ label: label(name), addr: i.address });
      }
    }
  }
  all.sort((a, b) => (rank[a.label] ?? 9) - (rank[b.label] ?? 9));
  return all;
}
function lanIP() {
  const a = addresses();
  return a.find(x => x.label !== "VPN")?.addr || null;
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
};

const server = http.createServer((req, res) => {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/host.html";
  if (url === "/c") url = "/c.html";
  if (url === "/info") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ip: lanIP(), port: PORT, addresses: addresses() }));
    return;
  }
  if (url === "/qr.png") {
    const want = new URLSearchParams(req.url.split("?")[1] || "").get("addr");
    const ip = addresses().find(a => a.addr === want)?.addr || lanIP();
    if (!ip) { res.statusCode = 404; res.end(); return; }
    QRCode.toBuffer(`http://${ip}:${PORT}/c`, {
      width: 440, margin: 1,
      color: { dark: "#e8ebf5", light: "#0e1220" },
    }).then((buf) => {
      res.setHeader("Content-Type", "image/png");
      res.end(buf);
    }).catch(() => { res.statusCode = 500; res.end(); });
    return;
  }
  const f = path.join(PUB, path.normalize(url).replace(/^([/\\])+/, ""));
  if (!f.startsWith(PUB) || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
    res.statusCode = 404;
    res.end("not found");
    return;
  }
  res.setHeader("Content-Type", MIME[path.extname(f)] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");   // phones aggressively cache; always serve fresh
  fs.createReadStream(f).pipe(res);
});

// ---- WebSocket relay: one host (the arena screen), many controllers ----
const wss = new WebSocketServer({ server });
let host = null;
const ctrls = new Map(); // id -> { ws, name }
let nextId = 1;

function send(ws, m) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
}

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }

    if (m.t === "hello") {
      if (m.role === "host") {
        host = ws;
        ws.isHost = true;
        send(ws, { t: "roster", players: [...ctrls].map(([id, c]) => ({ id, name: c.name, species: c.species })) });
      } else {
        const id = nextId++;
        ws.id = id;
        const name = String(m.name || "Player").slice(0, 12);
        const species = String(m.species || "").slice(0, 20);
        ctrls.set(id, { ws, name, species });
        send(ws, { t: "id", id });
        send(host, { t: "join", id, name, species });
      }
      return;
    }

    if (ws.isHost) {
      if (m.t === "to") send(ctrls.get(m.id)?.ws, m.m);
      else if (m.t === "all") for (const c of ctrls.values()) send(c.ws, m.m);
      else if (m.t === "kick") ctrls.get(m.id)?.ws.close();
    } else if (ws.id != null) {
      if (m.t === "species") {
        const c = ctrls.get(ws.id);
        if (c) c.species = String(m.key || "").slice(0, 20);
      }
      m.id = ws.id;
      send(host, m);
    }
  });

  ws.on("close", () => {
    if (ws.isHost) {
      if (host === ws) host = null;
    } else if (ws.id != null) {
      ctrls.delete(ws.id);
      send(host, { t: "leave", id: ws.id });
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const ip = lanIP();
  console.log(`Snake Royale screen : http://localhost:${PORT}`);
  if (ip) console.log(`  also reachable at  : http://${ip}:${PORT}  (open on another PC on the same network)`);
  console.log(`Phones join at    : ${ip ? `http://${ip}:${PORT}/c` : "(no LAN — join a Wi-Fi network or hotspot first)"}`);
});
