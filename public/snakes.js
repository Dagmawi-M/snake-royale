// Snake visual identity — shared by the arena (host.html) and the phone controller (c.html).
// Each species gets a distinct head (shape, brow, pupil, markings) rendered once into a
// cached offscreen sprite, plus a body pattern drawn as chunky full-width blocks so it
// reads from across the room. host draws sprites in the arena; c.html uses the same
// renderer for live previews on the join screen, species chips, and the dashboard rows.
window.SnakeArt = (() => {
  const TAU = Math.PI * 2;

  const SPECIES = [
    { key: "cobra",       name: "Cobra",       color: "#5ec8b0" },
    { key: "python",      name: "Python",      color: "#8de85e" },
    { key: "viper",       name: "Viper",       color: "#e8836e" },
    { key: "mamba",       name: "Black Mamba", color: "#7a8ce8" },
    { key: "anaconda",    name: "Anaconda",    color: "#e8c56e" },
    { key: "rattlesnake", name: "Rattlesnake", color: "#e85e8f" },
    { key: "boa",         name: "Boa",         color: "#a78bfa" },
    { key: "taipan",      name: "Taipan",      color: "#6fb1e8" },
  ];

  // head: len/rear/snub shape the skull (in head-units); brow = ridge over the eyes,
  // eyeY/eyeX place the eyes, pupil slit|round, iris color, stripe = post-orbital band,
  // pits = heat-sensing dots, paleSnout = light patch, spectacle = cobra hood mark.
  const STYLE = {
    cobra:       { pattern: "chevrons", hood: true, head: { len: 2.6, rear: 1.15, snub: 0.5, pupil: "round", iris: "#ffd76e", eyeX: 0.95, eyeY: 0.62 } },
    python:      { pattern: "blotches", head: { len: 2.8, rear: 1.5,  snub: 0.55, pupil: "slit", iris: "#d8e86e", eyeX: 1.0, eyeY: 0.78, stripe: true, pits: true } },
    viper:       { pattern: "zigzag",   head: { len: 2.5, rear: 1.7,  snub: 0.35, pupil: "slit", iris: "#ffb454", eyeX: 0.8, eyeY: 0.85, brow: true } },
    mamba:       { pattern: "plain",    head: { len: 3.1, rear: 0.95, snub: 0.6,  pupil: "round", iris: "#2a2f3e", eyeX: 1.25, eyeY: 0.5, mouth: true } },
    anaconda:    { pattern: "rings",    head: { len: 2.7, rear: 1.55, snub: 0.65, pupil: "round", iris: "#c8b46e", eyeX: 1.05, eyeY: 0.42, stripe: true } },
    rattlesnake: { pattern: "diamonds", rattle: true, head: { len: 2.6, rear: 1.65, snub: 0.4, pupil: "slit", iris: "#ffd76e", eyeX: 0.85, eyeY: 0.82, brow: true, pits: true } },
    boa:         { pattern: "bands",    head: { len: 2.7, rear: 1.35, snub: 0.55, pupil: "slit", iris: "#e8c56e", eyeX: 1.0, eyeY: 0.7, stripe: true } },
    taipan:      { pattern: "speckle",  head: { len: 3.0, rear: 1.2,  snub: 0.5,  pupil: "round", iris: "#ffb454", eyeX: 1.15, eyeY: 0.6, paleSnout: true } },
  };
  const DEFAULT_KEYS = ["boa", "python", "viper", "mamba", "anaconda", "rattlesnake", "cobra", "taipan"];
  const styleKeyFor = (speciesKey, idx) => STYLE[speciesKey] ? speciesKey : DEFAULT_KEYS[idx % DEFAULT_KEYS.length];

  // ---- color helpers (accept any CSS color incl. hsl(); resolved via a 1px scratch canvas) ----
  const scratch = document.createElement("canvas");
  scratch.width = scratch.height = 1;
  const sg = scratch.getContext("2d", { willReadFrequently: true });
  const rgbCache = new Map();
  function rgb(color) {
    let v = rgbCache.get(color);
    if (!v) {
      sg.fillStyle = "#000"; sg.fillStyle = color;
      sg.clearRect(0, 0, 1, 1); sg.fillRect(0, 0, 1, 1);
      const d = sg.getImageData(0, 0, 1, 1).data;
      v = [d[0], d[1], d[2]];
      rgbCache.set(color, v);
    }
    return v;
  }
  // amt -1..0 mixes toward near-black, 0..1 toward white
  function shade(color, amt) {
    const [r, g, b] = rgb(color);
    const t = amt < 0 ? 8 : 255, k = Math.abs(amt);
    const m = (c) => Math.round(c + (t - c) * k);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }

  // ---- head sprites: drawn facing +X, cached per species+color+size ----
  const S = 3;                       // internal supersampling
  const cache = new Map();
  function headSprite(styleKey, color, u) {
    u = Math.max(4, Math.round(u));
    const key = `${styleKey}|${color}|${u}`;
    let spr = cache.get(key);
    if (spr) return spr;
    if (cache.size > 96) cache.clear();

    const st = STYLE[styleKey] || STYLE.boa;
    const h = st.head;
    const su = u * S;                                  // head unit in sprite px
    const back = st.hood ? 4.0 : 2.1;                  // how far the sprite extends behind the anchor
    const W = Math.ceil((h.len + 0.8 + back) * su);
    const H = Math.ceil((st.hood ? 6.4 : Math.max(2 * h.rear + 1.2, 3.4)) * su);
    const ax = back * su, ay = H / 2;                  // anchor: the (0,0) the game rotates around
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.translate(ax, ay);
    g.lineJoin = g.lineCap = "round";

    const dark = shade(color, -0.62), darker = shade(color, -0.78);
    const lite = shade(color, 0.42);

    // cobra hood: flared mantle BEHIND the skull (top-down view) with the spectacle mark
    if (st.hood) {
      g.beginPath(); g.ellipse(-1.7 * su, 0, 1.95 * su, 2.45 * su, 0, 0, TAU);
      g.fillStyle = color; g.fill();
      g.lineWidth = 0.16 * su; g.strokeStyle = dark; g.stroke();
      g.beginPath(); g.ellipse(-1.75 * su, 0, 1.15 * su, 1.6 * su, 0, 0, TAU);
      g.fillStyle = "rgba(8,11,20,0.24)"; g.fill();
      for (const sgn of [-1, 1]) {                     // spectacle "eyes" on the hood
        g.beginPath(); g.arc(-1.95 * su, sgn * 0.78 * su, 0.3 * su, 0, TAU);
        g.strokeStyle = lite; g.lineWidth = 0.13 * su; g.stroke();
      }
      g.beginPath(); g.moveTo(-1.95 * su, -0.48 * su); g.lineTo(-1.95 * su, 0.48 * su);
      g.strokeStyle = lite; g.lineWidth = 0.11 * su; g.stroke();
    }

    // skull: rear → jaw → snout, mirrored; snub rounds the nose tip
    const L = h.len * su, R = h.rear * su, snub = h.snub * su;
    const skull = () => {
      g.beginPath();
      g.moveTo(L, -snub * 0.5);
      g.quadraticCurveTo(L + snub * 0.35, 0, L, snub * 0.5);          // rounded nose
      g.quadraticCurveTo(L * 0.82, R * 0.86, L * 0.28, R);            // jaw flare
      g.quadraticCurveTo(-0.55 * su, R * 0.88, -1.5 * su, R * 0.34);  // neck: tapers to body width
      g.lineTo(-1.5 * su, -R * 0.34);
      g.quadraticCurveTo(-0.55 * su, -R * 0.88, L * 0.28, -R);
      g.quadraticCurveTo(L * 0.82, -R * 0.86, L, -snub * 0.5);
      g.closePath();
    };
    skull();
    g.fillStyle = color; g.fill();

    // volume: top-forward highlight + darker rim, clipped to the skull
    g.save(); skull(); g.clip();
    let gr = g.createRadialGradient(L * 0.35, -R * 0.4, 0, L * 0.35, -R * 0.4, L * 1.25);
    gr.addColorStop(0, "rgba(255,255,255,0.20)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(-2 * su, -H, W, 2 * H);
    gr = g.createRadialGradient(0, 0, R * 0.4, 0, 0, L * 1.35);
    gr.addColorStop(0, "rgba(8,11,20,0)"); gr.addColorStop(1, "rgba(8,11,20,0.38)");
    g.fillStyle = gr; g.fillRect(-2 * su, -H, W, 2 * H);

    if (h.paleSnout) {                                 // taipan's pale nose
      g.beginPath(); g.ellipse(L * 0.82, 0, L * 0.28, R * 0.72, 0, 0, TAU);
      g.fillStyle = "rgba(255,246,224,0.42)"; g.fill();
    }
    if (h.stripe) {                                    // dark band running back through the eye
      for (const sgn of [-1, 1]) {
        g.beginPath();
        g.moveTo(h.eyeX * su + 0.3 * su, sgn * h.eyeY * su * 0.9);
        g.lineTo(-1.4 * su, sgn * R * 0.55);
        g.strokeStyle = "rgba(8,11,20,0.5)"; g.lineWidth = 0.3 * su; g.stroke();
      }
    }
    if (h.mouth) {                                     // mamba's long dark mouth line
      for (const sgn of [-1, 1]) {
        g.beginPath();
        g.moveTo(L * 0.96, sgn * snub * 0.4);
        g.quadraticCurveTo(L * 0.5, sgn * R * 0.98, -0.6 * su, sgn * R * 0.8);
        g.strokeStyle = "rgba(8,11,20,0.55)"; g.lineWidth = 0.12 * su; g.stroke();
      }
    }
    g.restore();

    skull();                                           // crisp outline over the shading
    g.strokeStyle = darker; g.lineWidth = 0.2 * su; g.stroke();

    // brow ridges (vipers/rattlers): heavy scale shelf that shadows the eye
    if (h.brow) {
      for (const sgn of [-1, 1]) {
        g.beginPath();
        g.moveTo((h.eyeX - 0.62) * su, sgn * (h.eyeY + 0.42) * su);
        g.quadraticCurveTo(h.eyeX * su, sgn * (h.eyeY + 0.62) * su, (h.eyeX + 0.58) * su, sgn * (h.eyeY + 0.18) * su);
        g.strokeStyle = darker; g.lineWidth = 0.22 * su; g.stroke();
      }
    }
    if (h.pits) {                                      // heat pits between eye and nostril
      for (const sgn of [-1, 1]) {
        g.beginPath(); g.arc((h.eyeX + 0.75) * su, sgn * h.eyeY * su * 0.62, 0.09 * su, 0, TAU);
        g.fillStyle = "rgba(8,11,20,0.85)"; g.fill();
      }
    }

    // eyes: sclera ring, colored iris, pupil (slit or round), glint
    for (const sgn of [-1, 1]) {
      const ex = h.eyeX * su, ey = sgn * h.eyeY * su, er = 0.4 * su;
      g.beginPath(); g.arc(ex, ey, er * 1.12, 0, TAU); g.fillStyle = darker; g.fill();
      g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fillStyle = h.iris; g.fill();
      gr = g.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 0, ex, ey, er);
      gr.addColorStop(0, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(0,0,0,0.25)");
      g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fillStyle = gr; g.fill();
      g.fillStyle = "#0c0f18";
      if (h.pupil === "slit") { g.beginPath(); g.ellipse(ex + er * 0.12, ey, er * 0.22, er * 0.82, 0, 0, TAU); g.fill(); }
      else { g.beginPath(); g.arc(ex + er * 0.08, ey, er * 0.42, 0, TAU); g.fill(); }
      g.beginPath(); g.arc(ex - er * 0.32, ey - er * 0.34, er * 0.16, 0, TAU);
      g.fillStyle = "rgba(255,255,255,0.85)"; g.fill();
    }

    // nostrils
    for (const sgn of [-1, 1]) {
      g.beginPath(); g.ellipse(L * 0.9, sgn * snub * 0.55, 0.07 * su, 0.05 * su, sgn * 0.5, 0, TAU);
      g.fillStyle = "rgba(8,11,20,0.8)"; g.fill();
    }
    // scale texture: faint plate lines across the crown
    g.strokeStyle = "rgba(8,11,20,0.16)"; g.lineWidth = 0.06 * su;
    for (let i = 1; i <= 3; i++) {
      const x = L * (0.15 + i * 0.2);
      g.beginPath(); g.moveTo(x, -R * (1 - x / (L * 1.6)) * 0.7);
      g.quadraticCurveTo(x + 0.15 * su, 0, x, R * (1 - x / (L * 1.6)) * 0.7);
      g.stroke();
    }

    spr = { c, w: W / S, h: H / S, ax: ax / S, ay: ay / S, snout: h.len, hood: !!st.hood };
    cache.set(key, spr);
    return spr;
  }

  // ---- one chunky pattern mark at a trail point (tangent tx,ty · body width w) ----
  function markAt(g, pattern, x, y, tx, ty, w, k, dark, light) {
    const nx = -ty, ny = tx;
    if (pattern === "bands") {                         // boa: bold dark bands, every 3rd light
      const isLight = k % 3 === 2;
      g.strokeStyle = isLight ? light : dark;
      g.lineWidth = Math.max(1.5, w * (isLight ? 0.38 : 0.85));
      g.lineCap = "butt";
      g.beginPath(); g.moveTo(x - nx * w * 1.02, y - ny * w * 1.02); g.lineTo(x + nx * w * 1.02, y + ny * w * 1.02); g.stroke();
    } else if (pattern === "rings") {                  // anaconda: dark ring with a light core
      g.lineCap = "butt";
      g.strokeStyle = dark; g.lineWidth = Math.max(1.5, w * 0.55);
      g.beginPath(); g.moveTo(x - nx * w * 1.02, y - ny * w * 1.02); g.lineTo(x + nx * w * 1.02, y + ny * w * 1.02); g.stroke();
      g.strokeStyle = light; g.lineWidth = Math.max(1, w * 0.16);
      g.beginPath(); g.moveTo(x - nx * w * 0.9, y - ny * w * 0.9); g.lineTo(x + nx * w * 0.9, y + ny * w * 0.9); g.stroke();
    } else if (pattern === "diamonds") {               // rattlesnake: fat diamonds, light centers
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(x + tx * w * 1.3, y + ty * w * 1.3);
      g.lineTo(x + nx * w * 0.95, y + ny * w * 0.95);
      g.lineTo(x - tx * w * 1.3, y - ty * w * 1.3);
      g.lineTo(x - nx * w * 0.95, y - ny * w * 0.95);
      g.closePath(); g.fill();
      g.fillStyle = light;
      g.beginPath(); g.arc(x, y, Math.max(1, w * 0.24), 0, TAU); g.fill();
    } else if (pattern === "blotches") {               // python: big saddles alternating sides
      const side = k % 2 ? 0.3 : -0.3;
      g.fillStyle = dark;
      g.beginPath(); g.ellipse(x + nx * w * side, y + ny * w * side, w * 1.15, w * 0.72, Math.atan2(ty, tx), 0, TAU); g.fill();
    } else if (pattern === "chevrons") {               // cobra: thick tailward V-marks
      g.strokeStyle = dark; g.lineWidth = Math.max(1.5, w * 0.55); g.lineCap = "round";
      g.beginPath();
      g.moveTo(x + tx * w * 1.15 + nx * w * 1.0, y + ty * w * 1.15 + ny * w * 1.0);
      g.lineTo(x - tx * w * 0.75, y - ty * w * 0.75);
      g.lineTo(x + tx * w * 1.15 - nx * w * 1.0, y + ty * w * 1.15 - ny * w * 1.0);
      g.stroke();
    } else if (pattern === "zigzag") {                 // viper: heavy lightning bars edge-to-edge
      const s1 = k % 2 ? 1 : -1;
      g.strokeStyle = dark; g.lineWidth = Math.max(2, w * 0.6); g.lineCap = "round";
      g.beginPath();
      g.moveTo(x - tx * w * 1.35 + nx * s1 * w * 0.8, y - ty * w * 1.35 + ny * s1 * w * 0.8);
      g.lineTo(x + tx * w * 1.35 - nx * s1 * w * 0.8, y + ty * w * 1.35 - ny * s1 * w * 0.8);
      g.stroke();
    } else if (pattern === "speckle") {                // taipan: bold dark+light flecks
      for (const [off, col, r] of [[0.55, dark, 0.34], [-0.4, dark, 0.28], [0.05, light, 0.22]]) {
        const j = Math.sin(k * 12.9898 + off * 78.233) * 43758.5453;
        const jit = (j - Math.floor(j)) - 0.5;
        g.fillStyle = col;
        g.beginPath(); g.arc(x + nx * (off + jit * 0.5) * w, y + ny * (off + jit * 0.5) * w, Math.max(1, w * r), 0, TAU); g.fill();
      }
    }
  }

  // ---- self-contained preview: S-curved patterned body + head, for UI chips/cards ----
  function paintPreview(cv, styleKey, color, opts = {}) {
    const g = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.lineJoin = g.lineCap = "round";
    const st = STYLE[styleKey] || STYLE.boa;
    const dark = shade(color, -0.6), light = shade(color, 0.65);

    if (opts.headOnly) {
      const u = Math.min(W, H) * (st.hood ? 0.16 : 0.22);
      const spr = headSprite(styleKey, color, u);
      g.save();
      g.translate(W * 0.44, H / 2);
      g.rotate(-0.28);
      g.drawImage(spr.c, -spr.ax, -spr.ay, spr.w, spr.h);
      g.restore();
      return;
    }

    const bw = H * 0.17;                               // body half-ish width (stroke width)
    const x0 = W * 0.06, x1 = W * 0.72, midY = H * 0.54;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push([x0 + (x1 - x0) * t, midY + Math.sin(t * Math.PI * 1.8 + 0.4) * H * 0.2 * (1 - t * 0.5)]);
    }
    const trace = () => { g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); };
    trace(); g.strokeStyle = shade(color, -0.75); g.lineWidth = bw * 1.5; g.stroke();
    trace(); g.strokeStyle = color; g.lineWidth = bw; g.stroke();
    trace(); g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = bw * 0.3; g.stroke();
    for (let i = 4, k = 0; i < pts.length - 2; i += 4, k++) {
      const [ax2, ay2] = pts[i - 1], [bx, by] = pts[i + 1], [px, py] = pts[i];
      const dl = Math.hypot(bx - ax2, by - ay2) || 1;
      markAt(g, st.pattern, px, py, (bx - ax2) / dl, (by - ay2) / dl, bw * 0.62, k, dark, light);
    }
    // head at the leading end, angled along the final tangent
    const [ex, ey] = pts[pts.length - 1], [qx, qy] = pts[pts.length - 4];
    const ang = Math.atan2(ey - qy, ex - qx);
    const spr = headSprite(styleKey, color, bw * 0.66);
    g.save(); g.translate(ex, ey); g.rotate(ang);
    g.drawImage(spr.c, -spr.ax, -spr.ay, spr.w, spr.h);
    g.restore();
  }

  return { SPECIES, STYLE, DEFAULT_KEYS, styleKeyFor, shade, headSprite, markAt, paintPreview };
})();
