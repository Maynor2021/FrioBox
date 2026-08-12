/* ==========================================================================
   FrioBox · Modelo 3D de la estación de lockers refrigerados
   Unidad FBX-S1 · 11 casilleros · control térmico dual
   ========================================================================== */

(function (global) {
  "use strict";

  /* ------------------------------------------------------------ medidas --- */

  var DIM = {
    W: 1.86,          // ancho total
    D: 0.80,          // profundidad del cuerpo
    plinth: 0.14,     // zócalo
    bodyTop: 2.14,    // altura del cuerpo
    signH: 0.28,      // corona luminosa
    colW: 0.62,
    stile: 0.035,     // montante vertical
    rail: 0.03,       // travesaño horizontal
    faceY0: 0.24,
    faceY1: 1.98
  };

  var COL_X = [-DIM.colW, 0, DIM.colW];
  var DOOR_W = DIM.colW - DIM.stile * 2;

  var ZONE = {
    freeze: { key: "freeze", label: "CONGELACIÓN", temp: "-18 °C", color: 0x7b8cff, hex: "#7b8cff" },
    cold: { key: "cold", label: "REFRIGERACIÓN", temp: "0 a 5 °C", color: 0x35c8e8, hex: "#35c8e8" }
  };

  /* --------------------------------------------------------- materiales --- */

  function std(color, metalness, roughness, extra) {
    var p = { color: color, metalness: metalness, roughness: roughness };
    if (extra) for (var k in extra) p[k] = extra[k];
    return new THREE.MeshStandardMaterial(p);
  }

  function makeMats() {
    return {
      plinth: std(0x080d13, 0.5, 0.55),
      body: std(0x16222f, 0.5, 0.46),
      bodySide: std(0x131e2a, 0.52, 0.44),
      frame: std(0x0d151e, 0.58, 0.38),
      inset: std(0x0a1119, 0.4, 0.6),
      steelCold: std(0xc4d0da, 0.8, 0.28),
      steelFreeze: std(0xb6c0d8, 0.8, 0.28),
      steelDark: std(0x2b3947, 0.7, 0.36),
      rubber: std(0x0a0e13, 0.1, 0.9),
      cavity: std(0xa9bcc9, 0.14, 0.78, { side: THREE.BackSide }),
      shelf: std(0x9fb0bd, 0.85, 0.32),
      evap: std(0xaebfcc, 0.9, 0.25),
      glass: std(0x050c12, 0.35, 0.12, { transparent: true, opacity: 0.9 }),
      screenGlass: std(0x000000, 0.2, 0.08),
      camera: std(0x11181f, 0.35, 0.3),
      ledOff: std(0x0c1218, 0.2, 0.6),
      concrete: std(0x2a2f36, 0.05, 0.95),
      chrome: std(0xdfe6ec, 0.95, 0.16)
    };
  }

  /* ------------------------------------------------------ util geometría --- */

  function box(w, h, d, mat, x, y, z, name) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (name) m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function emissiveMat(hex, intensity) {
    return new THREE.MeshStandardMaterial({
      color: 0x0a0f14,
      emissive: new THREE.Color(hex),
      emissiveIntensity: intensity === undefined ? 1 : intensity,
      metalness: 0.1,
      roughness: 0.5
    });
  }

  function texFromCanvas(cv) {
    var t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ------------------------------------------------------- código QR viz --- */
  /* Matriz determinista con patrones de localización reales (representación
     visual de un código de un solo uso, no un QR decodificable).            */

  function makeQRCanvas(text, px) {
    var N = 25, quiet = 2, total = N + quiet * 2;
    px = px || 260;
    var scale = Math.floor(px / total) || 4;
    var cv = document.createElement("canvas");
    cv.width = cv.height = total * scale;
    var c = cv.getContext("2d");
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, cv.width, cv.height);

    var grid = [], i, j;
    for (i = 0; i < N; i++) { grid[i] = []; for (j = 0; j < N; j++) grid[i][j] = 0; }
    var used = [];
    for (i = 0; i < N; i++) { used[i] = []; for (j = 0; j < N; j++) used[i][j] = false; }

    function finder(ox, oy) {
      for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) {
        var edge = x === 0 || y === 0 || x === 6 || y === 6;
        var core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y][ox + x] = (edge || core) ? 1 : 0;
        used[oy + y][ox + x] = true;
      }
      for (var k = -1; k < 8; k++) {
        [[ox + k, oy - 1], [ox + k, oy + 7], [ox - 1, oy + k], [ox + 7, oy + k]].forEach(function (p) {
          if (p[0] >= 0 && p[0] < N && p[1] >= 0 && p[1] < N) used[p[1]][p[0]] = true;
        });
      }
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);

    for (i = 8; i < N - 8; i++) {
      grid[6][i] = i % 2 === 0 ? 1 : 0; used[6][i] = true;
      grid[i][6] = i % 2 === 0 ? 1 : 0; used[i][6] = true;
    }
    for (var y2 = 0; y2 < 5; y2++) for (var x2 = 0; x2 < 5; x2++) {
      var e = x2 === 0 || y2 === 0 || x2 === 4 || y2 === 4;
      grid[N - 7 + y2][N - 7 + x2] = (e || (x2 === 2 && y2 === 2)) ? 1 : 0;
      used[N - 7 + y2][N - 7 + x2] = true;
    }

    var h = 2166136261 >>> 0;
    var s = String(text || "FRIOBOX");
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var seed = h;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

    for (i = 0; i < N; i++) for (j = 0; j < N; j++) if (!used[i][j]) grid[i][j] = rnd() > 0.48 ? 1 : 0;

    c.fillStyle = "#04141c";
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) if (grid[i][j])
      c.fillRect((j + quiet) * scale, (i + quiet) * scale, scale, scale);

    return cv;
  }

  /* --------------------------------------------------- pantalla del kiosco --- */

  var SCR_W = 640, SCR_H = 480;

  function makeScreen() {
    var cv = document.createElement("canvas");
    cv.width = SCR_W; cv.height = SCR_H;
    return cv;
  }

  function paintScreen(cv, state, d) {
    d = d || {};
    var c = cv.getContext("2d");
    var W = SCR_W, H = SCR_H;

    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a1622"); g.addColorStop(1, "#060d15");
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    /* barra superior */
    c.fillStyle = "rgba(255,255,255,0.045)"; c.fillRect(0, 0, W, 52);
    c.fillStyle = "#35c8e8";
    roundRect(c, 20, 13, 26, 26, 8); c.fill();
    c.fillStyle = "#04222c"; c.font = "bold 17px Segoe UI, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("❄", 33, 27);
    c.textAlign = "left";
    c.fillStyle = "#eaf5fa"; c.font = "bold 21px Segoe UI, sans-serif";
    c.fillText("FrioBox", 56, 27);
    c.fillStyle = "#5f7788"; c.font = "12px Segoe UI, sans-serif";
    c.fillText("EST. 04 · GASOLINERA BLVD. MORAZÁN", 140, 28);
    c.fillStyle = "#2fd39a";
    c.beginPath(); c.arc(W - 96, 26, 5, 0, 6.3); c.fill();
    c.fillStyle = "#8ba3b4"; c.font = "12px Segoe UI, sans-serif";
    c.fillText("EN LÍNEA", W - 84, 28);

    function title(t, sub, color) {
      c.textAlign = "center";
      c.fillStyle = color || "#eaf5fa"; c.font = "bold 34px Segoe UI, sans-serif";
      c.fillText(t, W / 2, 116);
      if (sub) {
        c.fillStyle = "#8ba3b4"; c.font = "17px Segoe UI, sans-serif";
        c.fillText(sub, W / 2, 152);
      }
      c.textAlign = "left";
    }

    function footTemps() {
      c.fillStyle = "rgba(255,255,255,0.04)"; c.fillRect(0, H - 54, W, 54);
      c.fillStyle = "#35c8e8"; c.font = "bold 15px Segoe UI, sans-serif";
      c.fillText("REFRIG.  " + (d.cold !== undefined ? d.cold.toFixed(1) : "3.4") + " °C", 22, H - 27);
      c.fillStyle = "#7b8cff";
      c.fillText("CONGEL.  " + (d.freeze !== undefined ? d.freeze.toFixed(1) : "-18.2") + " °C", 210, H - 27);
      c.fillStyle = "#5f7788"; c.font = "14px Segoe UI, sans-serif";
      c.textAlign = "right"; c.fillText("SERVICIO 24/7", W - 22, H - 27); c.textAlign = "left";
    }

    if (state === "idle") {
      title("Bienvenido", "Acerque su código QR o ingrese su PIN");
      var bx = 118, by = 190, bw = 180, bh = 190;
      [["ESCANEAR QR", "#35c8e8", bx], ["INGRESAR PIN", "#7b8cff", bx + 206]].forEach(function (o) {
        c.strokeStyle = o[1]; c.lineWidth = 2.5;
        c.fillStyle = "rgba(255,255,255,0.035)";
        roundRect(c, o[2], by, bw, bh, 16); c.fill(); c.stroke();
        c.fillStyle = o[1]; c.font = "bold 16px Segoe UI, sans-serif";
        c.textAlign = "center"; c.fillText(o[0], o[2] + bw / 2, by + bh - 26); c.textAlign = "left";
      });
      c.strokeStyle = "#35c8e8"; c.lineWidth = 3;
      c.strokeRect(bx + 56, by + 46, 68, 68);
      c.fillStyle = "#35c8e8"; c.fillRect(bx + 56, by + 76, 68, 4);
      c.fillStyle = "#7b8cff"; c.font = "bold 46px Segoe UI, sans-serif";
      c.textAlign = "center"; c.fillText("• • • •", bx + 206 + bw / 2, by + 96); c.textAlign = "left";
      footTemps();

    } else if (state === "courier") {
      title("Modo repartidor", "Aliado: " + (d.ally || "Supermercado La Colonia"));
      c.fillStyle = "rgba(53,200,232,0.09)";
      roundRect(c, 60, 178, W - 120, 132, 14); c.fill();
      c.strokeStyle = "rgba(53,200,232,0.4)"; c.lineWidth = 2; c.stroke();
      c.fillStyle = "#8ba3b4"; c.font = "14px Segoe UI, sans-serif";
      c.fillText("MANIFIESTO", 82, 208);
      c.fillStyle = "#eaf5fa"; c.font = "bold 22px Segoe UI, sans-serif";
      c.fillText(d.orders || "3 pedidos por depositar", 82, 240);
      c.fillStyle = "#8ba3b4"; c.font = "15px Segoe UI, sans-serif";
      c.fillText("2 refrigerados  ·  1 congelado", 82, 270);
      c.fillStyle = "#2fd39a"; c.font = "bold 15px Segoe UI, sans-serif";
      c.fillText("✓ Repartidor verificado  ·  ID RP-0148", 82, 296);
      footTemps();

    } else if (state === "assign") {
      title("Validación de espacio", "Asignando casillero disponible…");
      var gx = 178, gy = 178, cw = 46, ch = 34, gap = 7;
      var occ = d.occupied || [1, 4, 6, 9];
      for (var i = 0; i < 12; i++) {
        var col = i % 3, row = Math.floor(i / 3);
        var x = gx + col * (cw + gap), y = gy + row * (ch + gap);
        var isTarget = i === (d.targetIdx === undefined ? 7 : d.targetIdx);
        var isOcc = occ.indexOf(i) >= 0;
        c.fillStyle = isTarget ? "#35c8e8" : isOcc ? "rgba(255,255,255,0.07)" : "rgba(47,211,154,0.16)";
        roundRect(c, x, y, cw, ch, 6); c.fill();
        c.strokeStyle = isTarget ? "#8fe6f8" : isOcc ? "rgba(255,255,255,0.13)" : "rgba(47,211,154,0.4)";
        c.lineWidth = isTarget ? 3 : 1.4; c.stroke();
      }
      c.fillStyle = "#8ba3b4"; c.font = "14px Segoe UI, sans-serif";
      c.fillText("LIBRE", 60, 196); c.fillStyle = "rgba(47,211,154,0.5)";
      roundRect(c, 60, 204, 34, 12, 4); c.fill();
      c.fillStyle = "#8ba3b4"; c.font = "14px Segoe UI, sans-serif";
      c.fillText("OCUPADO", 60, 244); c.fillStyle = "rgba(255,255,255,0.12)";
      roundRect(c, 60, 252, 34, 12, 4); c.fill();
      c.fillStyle = "#eaf5fa"; c.font = "bold 20px Segoe UI, sans-serif";
      c.fillText("→ " + (d.door || "C3"), 452, 220);
      c.fillStyle = "#35c8e8"; c.font = "15px Segoe UI, sans-serif";
      c.fillText(d.zone || "Refrigerado", 452, 246);
      footTemps();

    } else if (state === "open") {
      title("Puerta " + (d.door || "C3") + " abierta", d.msg || "Deposite el pedido y cierre la puerta", "#2fd39a");
      c.strokeStyle = "rgba(47,211,154,0.85)"; c.lineWidth = 5;
      roundRect(c, 232, 192, 176, 150, 12); c.stroke();
      c.fillStyle = "rgba(47,211,154,0.12)"; c.fill();
      c.fillStyle = "#2fd39a"; c.font = "bold 74px Segoe UI, sans-serif";
      c.textAlign = "center"; c.fillText("✓", W / 2, 285); c.textAlign = "left";
      c.fillStyle = "#8ba3b4"; c.font = "16px Segoe UI, sans-serif";
      c.textAlign = "center";
      c.fillText("Cierre en " + (d.count === undefined ? 45 : d.count) + " s", W / 2, 372);
      c.textAlign = "left";
      footTemps();

    } else if (state === "scan") {
      title("Leyendo código…", "Mantenga el código frente al lector", "#35c8e8");
      c.strokeStyle = "#35c8e8"; c.lineWidth = 3;
      var qx = 252, qy = 186, qs = 136;
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (p) {
        var cx = qx + p[0] * qs, cy = qy + p[1] * qs, sx = p[0] ? -1 : 1, sy = p[1] ? -1 : 1;
        c.beginPath();
        c.moveTo(cx, cy + sy * 34); c.lineTo(cx, cy); c.lineTo(cx + sx * 34, cy); c.stroke();
      });
      var ly = qy + ((d.t || 0) % 1) * qs;
      var lg = c.createLinearGradient(0, ly - 16, 0, ly + 16);
      lg.addColorStop(0, "rgba(53,200,232,0)"); lg.addColorStop(0.5, "rgba(53,200,232,0.85)");
      lg.addColorStop(1, "rgba(53,200,232,0)");
      c.fillStyle = lg; c.fillRect(qx, ly - 16, qs, 32);
      footTemps();

    } else if (state === "pin") {
      title("Ingrese su PIN", "Código de 6 dígitos enviado a su app", "#7b8cff");
      var n = d.len || 0;
      for (var k = 0; k < 6; k++) {
        var px = 176 + k * 50;
        c.fillStyle = k < n ? "rgba(123,140,255,0.2)" : "rgba(255,255,255,0.05)";
        roundRect(c, px, 196, 40, 56, 8); c.fill();
        c.strokeStyle = k < n ? "#7b8cff" : "rgba(255,255,255,0.14)"; c.lineWidth = 2; c.stroke();
        if (k < n) {
          c.fillStyle = "#a4b0ff";
          c.beginPath(); c.arc(px + 20, 224, 7, 0, 6.3); c.fill();
        }
      }
      c.fillStyle = "#5f7788"; c.font = "15px Segoe UI, sans-serif";
      c.textAlign = "center"; c.fillText("¿Problemas? Presione AYUDA", W / 2, 316); c.textAlign = "left";
      footTemps();

    } else if (state === "error") {
      c.fillStyle = "rgba(244,82,107,0.1)"; c.fillRect(0, 52, W, H - 52);
      title("Código no válido", d.msg || "Verifique el código en su app o intente de nuevo", "#f4526b");
      c.strokeStyle = "#f4526b"; c.lineWidth = 5;
      c.beginPath(); c.arc(W / 2, 262, 52, 0, 6.3); c.stroke();
      c.beginPath(); c.moveTo(W / 2 - 22, 240); c.lineTo(W / 2 + 22, 284);
      c.moveTo(W / 2 + 22, 240); c.lineTo(W / 2 - 22, 284); c.stroke();
      footTemps();

    } else if (state === "picked") {
      title("Retiro completado", "Gracias por usar FrioBox", "#2fd39a");
      c.fillStyle = "#2fd39a"; c.font = "bold 96px Segoe UI, sans-serif";
      c.textAlign = "center"; c.fillText("✓", W / 2, 288);
      c.fillStyle = "#8ba3b4"; c.font = "16px Segoe UI, sans-serif";
      c.fillText("Cadena de frío mantenida · 0 desviaciones", W / 2, 356);
      c.textAlign = "left";
      footTemps();

    } else if (state === "stored") {
      title("Pedido resguardado", "Se notificó al cliente por app y SMS", "#35c8e8");
      c.fillStyle = "rgba(255,255,255,0.045)";
      roundRect(c, 78, 186, W - 156, 150, 14); c.fill();
      var rows = [
        ["Casillero", d.door || "C3"],
        ["Zona térmica", d.zone || "Refrigerado 0 a 5 °C"],
        ["Temp. de custodia", (d.cold !== undefined ? d.cold.toFixed(1) : "3.4") + " °C"],
        ["Vence el resguardo", d.expiry || "Hoy 22:00 h"]
      ];
      rows.forEach(function (r, idx) {
        var yy = 218 + idx * 32;
        c.fillStyle = "#8ba3b4"; c.font = "15px Segoe UI, sans-serif"; c.fillText(r[0], 104, yy);
        c.fillStyle = "#eaf5fa"; c.font = "bold 15px Segoe UI, sans-serif";
        c.textAlign = "right"; c.fillText(r[1], W - 104, yy); c.textAlign = "left";
      });
      footTemps();

    } else if (state === "temps") {
      title("Monitoreo térmico", "Lectura de sensores en tiempo real");
      [[ZONE.cold, d.cold === undefined ? 3.4 : d.cold, "0 a 5 °C", 66],
       [ZONE.freeze, d.freeze === undefined ? -18.2 : d.freeze, "-20 a -16 °C", 340]].forEach(function (z) {
        var zz = z[0], val = z[1], rng = z[2], x0 = z[3];
        c.fillStyle = "rgba(255,255,255,0.04)";
        roundRect(c, x0, 180, 234, 160, 14); c.fill();
        c.strokeStyle = zz.hex + "66"; c.lineWidth = 2; c.stroke();
        c.fillStyle = "#8ba3b4"; c.font = "13px Segoe UI, sans-serif";
        c.fillText(zz.label, x0 + 20, 208);
        c.fillStyle = zz.hex; c.font = "bold 46px Segoe UI, sans-serif";
        c.fillText(val.toFixed(1) + "°", x0 + 20, 264);
        c.fillStyle = "#5f7788"; c.font = "13px Segoe UI, sans-serif";
        c.fillText("Rango objetivo " + rng, x0 + 20, 292);
        var okz = zz.key === "cold" ? (val >= 0 && val <= 5) : (val >= -20 && val <= -16);
        c.fillStyle = okz ? "#2fd39a" : "#f5a524"; c.font = "bold 14px Segoe UI, sans-serif";
        c.fillText(okz ? "✓ EN RANGO" : "⚠ FUERA DE RANGO", x0 + 20, 320);
      });
      footTemps();

    } else if (state === "alert") {
      c.fillStyle = "rgba(245,165,36,0.12)"; c.fillRect(0, 52, W, H - 52);
      title("Alerta térmica", d.msg || "Casillero C3 · desviación detectada", "#f5a524");
      c.fillStyle = "#f5a524";
      c.beginPath(); c.moveTo(W / 2, 196); c.lineTo(W / 2 + 58, 296); c.lineTo(W / 2 - 58, 296); c.closePath();
      c.fill();
      c.fillStyle = "#0a1622"; c.font = "bold 52px Segoe UI, sans-serif";
      c.textAlign = "center"; c.fillText("!", W / 2, 278);
      c.fillStyle = "#8ba3b4"; c.font = "15px Segoe UI, sans-serif";
      c.fillText("Notificado a central de operaciones · Técnico en ruta", W / 2, 348);
      c.textAlign = "left";
      footTemps();

    } else if (state === "off") {
      c.fillStyle = "#03080d"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#1b2836"; c.font = "bold 22px Segoe UI, sans-serif";
      c.textAlign = "center"; c.fillText("MODO AHORRO", W / 2, H / 2); c.textAlign = "left";
    }
  }

  /* --------------------------------------------------- texturas auxiliares --- */

  function doorPlateCanvas(code, zone) {
    var cv = document.createElement("canvas");
    cv.width = 256; cv.height = 104;
    var c = cv.getContext("2d");
    c.fillStyle = "#0c141d"; c.fillRect(0, 0, 256, 104);
    c.strokeStyle = "rgba(255,255,255,0.16)"; c.lineWidth = 3;
    c.strokeRect(1.5, 1.5, 253, 101);
    c.fillStyle = zone.hex; c.fillRect(0, 0, 9, 104);
    c.textBaseline = "middle";
    c.fillStyle = "#f4fbfe"; c.font = "bold 52px Segoe UI, sans-serif";
    c.fillText(code, 26, 36);
    c.fillStyle = zone.hex; c.font = "bold 26px Segoe UI, sans-serif";
    c.fillText(zone.temp, 26, 78);
    return cv;
  }

  function headerCanvas(zone) {
    var cv = document.createElement("canvas");
    cv.width = 512; cv.height = 128;
    var c = cv.getContext("2d");
    c.fillStyle = "#070d13"; c.fillRect(0, 0, 512, 128);
    var g = c.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, zone.hex); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.globalAlpha = 0.22; c.fillRect(0, 0, 512, 128); c.globalAlpha = 1;
    c.fillStyle = zone.hex; c.fillRect(0, 108, 512, 8);
    c.fillStyle = "#e9f6fb"; c.font = "bold 44px Segoe UI, sans-serif";
    c.textBaseline = "middle"; c.fillText(zone.label, 26, 48);
    c.fillStyle = zone.hex; c.font = "bold 30px Segoe UI, sans-serif";
    c.fillText(zone.temp, 26, 90);
    return cv;
  }

  function signCanvas() {
    var cv = document.createElement("canvas");
    cv.width = 1024; cv.height = 168;
    var c = cv.getContext("2d");
    var g = c.createLinearGradient(0, 0, 1024, 0);
    g.addColorStop(0, "#0b1a26"); g.addColorStop(0.55, "#0e2433"); g.addColorStop(1, "#0b1a26");
    c.fillStyle = g; c.fillRect(0, 0, 1024, 168);
    c.fillStyle = "#35c8e8";
    roundRect(c, 42, 44, 80, 80, 22); c.fill();
    c.fillStyle = "#04222c"; c.font = "bold 56px Segoe UI, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("❄", 82, 84);
    c.textAlign = "left";
    c.fillStyle = "#f2fbff"; c.font = "bold 72px Segoe UI, sans-serif";
    c.fillText("Frio", 146, 82);
    var w = c.measureText("Frio").width;
    c.fillStyle = "#35c8e8"; c.fillText("Box", 146 + w, 82);
    c.fillStyle = "#7f9aab"; c.font = "600 26px Segoe UI, sans-serif";
    c.fillText("LOCKERS REFRIGERADOS INTELIGENTES", 148, 128);
    c.textAlign = "right";
    c.fillStyle = "#35c8e8"; c.font = "bold 44px Segoe UI, sans-serif";
    c.fillText("RETIRO 24/7", 980, 70);
    c.fillStyle = "#7f9aab"; c.font = "600 24px Segoe UI, sans-serif";
    c.fillText("REFRIGERADO  ·  CONGELADO", 980, 116);
    c.textAlign = "left";
    return cv;
  }

  function decalCanvas() {
    var cv = document.createElement("canvas");
    cv.width = 320; cv.height = 1024;
    var c = cv.getContext("2d");
    c.fillStyle = "#131e2a"; c.fillRect(0, 0, 320, 1024);
    c.save();
    c.translate(160, 512); c.rotate(-Math.PI / 2);
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "#f2fbff"; c.font = "bold 118px Segoe UI, sans-serif";
    c.fillText("FrioBox", -40, -22);
    c.fillStyle = "#35c8e8"; c.font = "600 40px Segoe UI, sans-serif";
    c.fillText("CADENA DE FRÍO GARANTIZADA", -40, 48);
    c.restore();
    c.fillStyle = "#35c8e8";
    roundRect(c, 108, 96, 104, 104, 28); c.fill();
    c.fillStyle = "#04222c"; c.font = "bold 74px Segoe UI, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("❄", 160, 148);
    return cv;
  }

  function instructionCanvas() {
    var cv = document.createElement("canvas");
    cv.width = 512; cv.height = 256;
    var c = cv.getContext("2d");
    c.fillStyle = "#0c141d"; c.fillRect(0, 0, 512, 256);
    c.strokeStyle = "#1d2c3b"; c.lineWidth = 4; c.strokeRect(2, 2, 508, 252);
    c.fillStyle = "#35c8e8"; c.font = "bold 27px Segoe UI, sans-serif";
    c.fillText("¿CÓMO RETIRAR?", 24, 44);
    var steps = ["1. Abra la app FrioBox", "2. Escanee el QR o digite su PIN", "3. Retire y cierre la puerta"];
    c.font = "22px Segoe UI, sans-serif";
    steps.forEach(function (s, i) {
      c.fillStyle = "#c3d4e0"; c.fillText(s, 24, 96 + i * 42);
    });
    c.fillStyle = "#5f7788"; c.font = "19px Segoe UI, sans-serif";
    c.fillText("Soporte 24/7 · (504) 2200-0000", 24, 228);
    return cv;
  }

  /* --------------------------------------------- contenido de casilleros --- */

  var CONTENTS = {
    A1: "congelado", A3: "congelado",
    B1: "medicina",
    C1: "lacteos", C3: "bolsa", C5: "flores"
  };

  function buildContents(kind) {
    var g = new THREE.Group();
    g.name = "contenido-" + kind;

    function part(geo, color, m, r, x, y, z) {
      var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: color, metalness: m, roughness: r
      }));
      mesh.position.set(x, y, z);
      g.add(mesh);
      return mesh;
    }
    function bx(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
    function cyl(r, h) { return new THREE.CylinderGeometry(r, r, h, 18); }

    if (kind === "bolsa") {
      part(bx(0.25, 0.21, 0.17), 0xc7a479, 0.05, 0.85, 0, 0.105, 0);
      part(bx(0.25, 0.03, 0.17), 0xb08f65, 0.05, 0.85, 0, 0.207, 0);
      [-0.06, 0.06].forEach(function (hx) {
        var hd = new THREE.Mesh(
          new THREE.TorusGeometry(0.035, 0.006, 6, 14, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0x9c7f5c, roughness: 0.9 })
        );
        hd.position.set(hx, 0.215, 0.03);
        g.add(hd);
      });
      part(bx(0.07, 0.12, 0.05), 0x8fbf6a, 0.05, 0.8, -0.06, 0.26, -0.02);
      part(cyl(0.028, 0.1), 0xd9534f, 0.05, 0.6, 0.06, 0.255, 0);

    } else if (kind === "lacteos") {
      part(bx(0.085, 0.18, 0.085), 0xf2f4f6, 0.05, 0.5, -0.095, 0.09, 0);
      part(bx(0.085, 0.035, 0.085), 0x3b7fc4, 0.05, 0.5, -0.095, 0.196, 0);
      part(bx(0.075, 0.16, 0.075), 0xf4efe6, 0.05, 0.5, 0.0, 0.08, -0.03);
      part(bx(0.075, 0.03, 0.075), 0xd8a13b, 0.05, 0.5, 0.0, 0.175, -0.03);
      [0.085, 0.145].forEach(function (yx, i) {
        part(cyl(0.032, 0.055), i ? 0xe8607d : 0xf0e2c0, 0.05, 0.55, 0.115, yx - 0.03, 0.02);
      });

    } else if (kind === "medicina") {
      part(bx(0.21, 0.1, 0.15), 0xf7fafb, 0.05, 0.45, 0, 0.05, 0);
      part(bx(0.055, 0.016, 0.002), 0x2fa36e, 0.05, 0.5, 0, 0.05, 0.076);
      part(bx(0.016, 0.055, 0.002), 0x2fa36e, 0.05, 0.5, 0, 0.05, 0.076);
      part(bx(0.19, 0.055, 0.13), 0xdfe9ee, 0.05, 0.5, 0, 0.128, 0);
      part(bx(0.06, 0.014, 0.09), 0x35c8e8, 0.1, 0.4, -0.055, 0.157, 0);

    } else if (kind === "flores") {
      var cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.082, 0.17, 20, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xe6eef2, metalness: 0.05, roughness: 0.35, side: THREE.DoubleSide })
      );
      cone.rotation.x = Math.PI;
      cone.position.set(0, 0.09, 0);
      g.add(cone);
      part(bx(0.055, 0.012, 0.002), 0x35c8e8, 0.1, 0.5, 0, 0.115, 0.055);
      [[-0.045, 0.2, 0.02, 0xe4557f], [0.0, 0.215, -0.02, 0xf0d264], [0.045, 0.196, 0.025, 0xd96a9c],
       [-0.02, 0.185, -0.04, 0xf5f0e4], [0.022, 0.178, 0.045, 0xe4557f]].forEach(function (b) {
        part(new THREE.SphereGeometry(0.024, 12, 10), b[3], 0.05, 0.75, b[0], b[1], b[2]);
      });
      part(cyl(0.004, 0.07), 0x4f7a44, 0.05, 0.8, 0.06, 0.16, -0.03);

    } else if (kind === "congelado") {
      [-0.075, 0.005].forEach(function (cx, i) {
        part(cyl(0.052, 0.085), i ? 0x8b6a4f : 0xdfe6ec, 0.05, 0.5, cx, 0.0425, 0);
        part(cyl(0.055, 0.012), 0x2b3a52, 0.1, 0.45, cx, 0.09, 0);
      });
      part(bx(0.21, 0.055, 0.14), 0x9fc4d8, 0.15, 0.45, 0, 0.12, 0);
      part(bx(0.09, 0.02, 0.003), 0x2b3a52, 0.05, 0.5, 0, 0.12, 0.072);
      part(bx(0.16, 0.05, 0.11), 0xc9dce6, 0.15, 0.4, 0.01, 0.172, 0);
    }

    g.traverse(function (o) { o.castShadow = false; o.receiveShadow = false; });
    return g;
  }

  /* -------------------------------------------------------- construcción --- */

  function buildLocker() {
    var M = makeMats();
    var root = new THREE.Group();
    root.name = "FrioBoxUnit";

    var shellMats = [M.body, M.bodySide, M.frame, M.inset, M.steelCold, M.steelFreeze, M.steelDark, M.plinth];
    var doors = [];
    var contentsByCode = {};
    var api = {};

    /* ---- zócalo y anclajes ---- */
    root.add(box(DIM.W - 0.06, DIM.plinth, DIM.D - 0.05, M.plinth, 0, DIM.plinth / 2, 0, "zocalo"));
    [-0.82, 0.82].forEach(function (x) {
      [-0.3, 0.3].forEach(function (z) {
        var p = box(0.11, 0.02, 0.11, M.steelDark, x, 0.01, z, "anclaje");
        root.add(p);
        var bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8), M.chrome);
        bolt.position.set(x, 0.03, z); root.add(bolt);
      });
    });

    /* ---- cuerpo: laterales, fondo, techo ---- */
    var bodyH = DIM.bodyTop - DIM.plinth;
    var bodyCY = DIM.plinth + bodyH / 2;

    var decalTex = texFromCanvas(decalCanvas());
    var sideMat = new THREE.MeshStandardMaterial({ map: decalTex, metalness: 0.4, roughness: 0.5 });

    root.add(box(0.03, bodyH, DIM.D, sideMat, -DIM.W / 2 + 0.015, bodyCY, 0, "lateral-izq"));
    root.add(box(0.03, bodyH, DIM.D, sideMat, DIM.W / 2 - 0.015, bodyCY, 0, "lateral-der"));
    root.add(box(DIM.W, bodyH, 0.04, M.bodySide, 0, bodyCY, -DIM.D / 2 + 0.02, "fondo"));
    root.add(box(DIM.W, 0.04, DIM.D, M.body, 0, DIM.bodyTop - 0.02, 0, "techo"));
    root.add(box(DIM.W, 0.03, DIM.D, M.body, 0, DIM.plinth + 0.015, 0, "piso"));

    /* ---- columnas: facha, casilleros, cavidades ---- */
    var layout = [
      { x: COL_X[0], zone: ZONE.freeze, prefix: "A", doors: 4, gapTop: 0 },
      { x: COL_X[1], zone: ZONE.cold, prefix: "B", doors: 2, kiosk: true },
      { x: COL_X[2], zone: ZONE.cold, prefix: "C", doors: 5, gapTop: 0 }
    ];

    var cavityGroup = new THREE.Group(); cavityGroup.name = "interiores";
    root.add(cavityGroup);
    var coldPts = [], freezePts = [];

    layout.forEach(function (col) {
      var y0 = DIM.faceY0;
      var y1 = col.kiosk ? 0.96 : DIM.faceY1;
      var n = col.doors;
      var dh = (y1 - y0 - DIM.rail * (n - 1)) / n;

      /* montantes verticales */
      [-1, 1].forEach(function (s) {
        root.add(box(DIM.stile, DIM.faceY1 - y0 + 0.1, 0.05,
          M.frame, col.x + s * (DIM.colW / 2 - DIM.stile / 2),
          (y0 + DIM.faceY1) / 2, DIM.D / 2 - 0.02, "montante"));
      });

      for (var i = 0; i < n; i++) {
        var dy0 = y0 + i * (dh + DIM.rail);
        var cy = dy0 + dh / 2;
        var code = col.prefix + (n - i);
        var zone = col.zone;

        /* travesaño superior de cada casillero */
        if (i < n - 1) {
          root.add(box(DOOR_W, DIM.rail, 0.05, M.frame, col.x, dy0 + dh + DIM.rail / 2, DIM.D / 2 - 0.02, "travesano"));
        }

        /* cavidad interior */
        var cav = new THREE.Mesh(
          new THREE.BoxGeometry(DOOR_W - 0.03, dh - 0.03, DIM.D - 0.12),
          M.cavity
        );
        cav.position.set(col.x, cy, -0.02);
        cavityGroup.add(cav);

        /* estante + evaporador + sensor */
        var shelf = box(DOOR_W - 0.07, 0.008, DIM.D - 0.2, M.shelf, col.x, cy - dh / 2 + 0.055, -0.02, "estante");
        cavityGroup.add(shelf);
        var evap = box(DOOR_W - 0.09, dh - 0.11, 0.012, M.evap, col.x, cy, -DIM.D / 2 + 0.11, "evaporador");
        cavityGroup.add(evap);
        for (var f = 0; f < 6; f++) {
          cavityGroup.add(box(DOOR_W - 0.09, 0.004, 0.03, M.evap, col.x,
            cy - dh / 2 + 0.09 + f * ((dh - 0.16) / 5), -DIM.D / 2 + 0.13, "aleta"));
        }
        var sensor = box(0.05, 0.024, 0.02, M.steelDark, col.x + DOOR_W / 2 - 0.07, cy + dh / 2 - 0.05, -0.12, "sensor");
        cavityGroup.add(sensor);
        var sled = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), emissiveMat(zone.hex, 2.4));
        sled.position.set(col.x + DOOR_W / 2 - 0.07, cy + dh / 2 - 0.05, -0.105);
        cavityGroup.add(sled);

        /* partículas de aire frío */
        var target = zone.key === "cold" ? coldPts : freezePts;
        for (var p = 0; p < 16; p++) {
          target.push(
            col.x + (Math.random() - 0.5) * (DOOR_W - 0.09),
            cy + (Math.random() - 0.5) * (dh - 0.07),
            -0.02 + (Math.random() - 0.5) * (DIM.D - 0.2)
          );
        }

        /* contenido resguardado */
        if (CONTENTS[code]) {
          var contents = buildContents(CONTENTS[code]);
          contents.position.set(col.x, cy - dh / 2 + 0.062, -0.02);
          cavityGroup.add(contents);
          contentsByCode[code] = contents;
        }

        /* puerta con bisagra a la izquierda */
        var hinge = new THREE.Group();
        hinge.position.set(col.x - DOOR_W / 2, cy, DIM.D / 2 - 0.015);
        root.add(hinge);

        var dmat = (zone.key === "cold" ? M.steelCold : M.steelFreeze).clone();
        var leaf = box(DOOR_W, dh, 0.035, dmat, DOOR_W / 2, 0, 0.018, "puerta-" + code);
        hinge.add(leaf);

        /* burlete */
        hinge.add(box(DOOR_W - 0.01, dh - 0.01, 0.012, M.rubber, DOOR_W / 2, 0, -0.002, "burlete"));

        /* jaladera embutida */
        var pull = box(0.035, dh * 0.5, 0.022, M.steelDark, DOOR_W - 0.055, 0, 0.036, "jaladera");
        hinge.add(pull);
        hinge.add(box(0.018, dh * 0.44, 0.03, M.rubber, DOOR_W - 0.055, 0, 0.042, "hueco-jaladera"));

        /* placa con número y temperatura */
        var plateTex = texFromCanvas(doorPlateCanvas(code, zone));
        var plate = new THREE.Mesh(
          new THREE.PlaneGeometry(0.148, 0.06),
          new THREE.MeshStandardMaterial({
            map: plateTex, emissive: 0xffffff, emissiveMap: plateTex,
            emissiveIntensity: 0.95, metalness: 0.2, roughness: 0.5
          })
        );
        plate.position.set(0.128, dh / 2 - 0.056, 0.0365);
        hinge.add(plate);

        /* LED de estado */
        var ledMat = emissiveMat(zone.hex, 1.7);
        var led = box(0.012, dh - 0.1, 0.006, ledMat, 0.024, 0, 0.037, "led-" + code);
        hinge.add(led);

        doors.push({
          code: code, zone: zone, hinge: hinge, leaf: leaf, led: led, ledMat: ledMat,
          doorMat: dmat, angle: 0, targetAngle: 0, y: cy, h: dh, x: col.x, state: "free"
        });
        shellMats.push(dmat);
      }

      /* cabecera de zona */
      if (!col.kiosk) {
        var hTex = texFromCanvas(headerCanvas(col.zone));
        var header = new THREE.Mesh(
          new THREE.PlaneGeometry(DIM.colW - 0.02, 0.145),
          new THREE.MeshStandardMaterial({
            map: hTex, emissive: 0xffffff, emissiveMap: hTex,
            emissiveIntensity: 0.7, metalness: 0.1, roughness: 0.6
          })
        );
        header.position.set(col.x, 2.055, DIM.D / 2 + 0.001);
        root.add(header);
      }
    });

    /* ---- partículas de aire frío ---- */
    function makePoints(arr, hex) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      var mat = new THREE.PointsMaterial({
        color: new THREE.Color(hex), size: 0.022, transparent: true,
        opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending
      });
      var pts = new THREE.Points(geo, mat);
      pts.visible = false;
      root.add(pts);
      return pts;
    }
    var coldAir = makePoints(coldPts, ZONE.cold.hex);
    var freezeAir = makePoints(freezePts, ZONE.freeze.hex);
    var airBase = {
      cold: coldPts.slice(),
      freeze: freezePts.slice()
    };

    /* ---- kiosco central ---- */
    var kiosk = new THREE.Group();
    kiosk.name = "kiosco";
    root.add(kiosk);

    kiosk.add(box(DIM.colW - 0.02, 1.02, 0.045, M.inset, 0, 1.49, DIM.D / 2 - 0.018, "panel-kiosco"));
    kiosk.add(box(DOOR_W, DIM.rail, 0.05, M.frame, 0, 0.99, DIM.D / 2 - 0.02, "travesano-kiosco"));

    /* pantalla táctil inclinada */
    var scrCanvas = makeScreen();
    paintScreen(scrCanvas, "idle", {});
    var scrTex = texFromCanvas(scrCanvas);
    var screenMat = new THREE.MeshStandardMaterial({
      map: scrTex, emissive: 0xffffff, emissiveMap: scrTex,
      emissiveIntensity: 1.15, metalness: 0.05, roughness: 0.34
    });
    var screenBezel = box(0.5, 0.4, 0.03, M.steelDark, 0, 1.63, DIM.D / 2 + 0.005, "bisel-pantalla");
    screenBezel.rotation.x = -0.12;
    kiosk.add(screenBezel);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.455, 0.345), screenMat);
    screen.position.set(0, 1.6305, DIM.D / 2 + 0.0225);
    screen.rotation.x = -0.12;
    screen.name = "pantalla";
    kiosk.add(screen);

    /* halo de pantalla */
    var screenLight = new THREE.PointLight(0x35c8e8, 0.55, 1.5);
    screenLight.position.set(0, 1.62, DIM.D / 2 + 0.22);
    kiosk.add(screenLight);

    /* lector QR */
    var scannerPlate = box(0.24, 0.15, 0.026, M.steelDark, 0, 1.37, DIM.D / 2 + 0.004, "placa-lector");
    kiosk.add(scannerPlate);
    var scannerGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x03080d, metalness: 0.5, roughness: 0.1 })
    );
    scannerGlass.position.set(0, 1.37, DIM.D / 2 + 0.018);
    kiosk.add(scannerGlass);

    var scanBeamMat = new THREE.MeshBasicMaterial({
      color: 0x35c8e8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    });
    var scanBeam = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.02), scanBeamMat);
    scanBeam.position.set(0, 1.37, DIM.D / 2 + 0.022);
    kiosk.add(scanBeam);

    var scanGlowMat = emissiveMat("#f4526b", 1.2);
    var scanGlow = box(0.16, 0.006, 0.004, scanGlowMat, 0, 1.318, DIM.D / 2 + 0.02, "led-lector");
    kiosk.add(scanGlow);

    var scanLight = new THREE.PointLight(0x35c8e8, 0, 0.9);
    scanLight.position.set(0, 1.37, DIM.D / 2 + 0.16);
    kiosk.add(scanLight);

    /* teclado numérico */
    var keypad = box(0.26, 0.26, 0.02, M.steelDark, 0, 1.155, DIM.D / 2 + 0.002, "teclado");
    kiosk.add(keypad);
    for (var kr = 0; kr < 4; kr++) {
      for (var kc = 0; kc < 3; kc++) {
        kiosk.add(box(0.055, 0.043, 0.012, M.steelCold,
          -0.075 + kc * 0.075, 1.255 - kr * 0.065, DIM.D / 2 + 0.014, "tecla"));
      }
    }

    /* cámara de seguridad + micrófono + NFC */
    var camHousing = box(0.14, 0.07, 0.06, M.camera, 0, 1.935, DIM.D / 2 - 0.005, "carcasa-camara");
    kiosk.add(camHousing);
    var camDome = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 16), M.glass);
    camDome.position.set(0, 1.925, DIM.D / 2 + 0.028);
    kiosk.add(camDome);
    var camLed = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), emissiveMat("#f4526b", 2));
    camLed.position.set(0.048, 1.935, DIM.D / 2 + 0.026);
    kiosk.add(camLed);

    var nfc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 24), M.steelCold);
    nfc.rotation.x = Math.PI / 2;
    nfc.position.set(0.19, 1.37, DIM.D / 2 + 0.008);
    kiosk.add(nfc);

    for (var sg = 0; sg < 5; sg++) {
      kiosk.add(box(0.09, 0.006, 0.008, M.steelDark, -0.19, 1.4 - sg * 0.014, DIM.D / 2 + 0.006, "bocina"));
    }

    /* instructivo serigrafiado */
    var insTex = texFromCanvas(instructionCanvas());
    var instr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.21),
      new THREE.MeshStandardMaterial({
        map: insTex, emissive: 0xffffff, emissiveMap: insTex,
        emissiveIntensity: 0.35, metalness: 0.1, roughness: 0.7
      })
    );
    instr.position.set(0, 1.02 - 0.0, DIM.D / 2 + 0.026);
    instr.position.y = 1.02;
    kiosk.add(instr);

    /* ---- corona luminosa ---- */
    var signTex = texFromCanvas(signCanvas());
    var signBody = box(DIM.W + 0.04, DIM.signH, DIM.D + 0.03, M.frame, 0, DIM.bodyTop + DIM.signH / 2, 0, "corona");
    root.add(signBody);
    var signFaceMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: 0xffffff, emissiveMap: signTex,
      emissiveIntensity: 1.25, metalness: 0.05, roughness: 0.5
    });
    var signFace = new THREE.Mesh(new THREE.PlaneGeometry(DIM.W - 0.02, DIM.signH - 0.05), signFaceMat);
    signFace.position.set(0, DIM.bodyTop + DIM.signH / 2, DIM.D / 2 + 0.017);
    root.add(signFace);
    var signBack = signFace.clone();
    signBack.position.z = -DIM.D / 2 - 0.017;
    signBack.rotation.y = Math.PI;
    root.add(signBack);
    var signLight = new THREE.PointLight(0x35c8e8, 0.7, 2.6);
    signLight.position.set(0, DIM.bodyTop + 0.1, DIM.D / 2 + 0.35);
    root.add(signLight);

    /* ---- parte trasera: máquina, rejillas, UPS, servicio ---- */
    var backGroup = new THREE.Group(); backGroup.name = "trasera";
    root.add(backGroup);

    /* unidad condensadora */
    var machine = box(1.2, 0.52, 0.3, M.steelDark, 0, 1.78, -DIM.D / 2 - 0.15, "unidad-condensadora");
    backGroup.add(machine);
    [-0.3, 0.3].forEach(function (fx) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.016, 8, 28), M.steelDark);
      ring.position.set(fx, 1.78, -DIM.D / 2 - 0.3);
      backGroup.add(ring);
      var grid = new THREE.Mesh(new THREE.CircleGeometry(0.16, 26), M.rubber);
      grid.position.set(fx, 1.78, -DIM.D / 2 - 0.302);
      grid.rotation.y = Math.PI;
      backGroup.add(grid);
      for (var b = 0; b < 3; b++) {
        var blade = box(0.13, 0.028, 0.006, M.steelCold, fx, 1.78, -DIM.D / 2 - 0.296, "aspa");
        blade.rotation.z = (b * Math.PI * 2) / 3;
        blade.position.x = fx; blade.position.y = 1.78;
        backGroup.add(blade);
      }
    });

    /* rejillas de ventilación */
    for (var lv = 0; lv < 9; lv++) {
      var lou = box(1.5, 0.022, 0.05, M.steelDark, 0, 0.42 + lv * 0.045, -DIM.D / 2 - 0.01, "rejilla");
      lou.rotation.x = 0.42;
      backGroup.add(lou);
    }

    /* puerta de servicio */
    backGroup.add(box(0.86, 0.62, 0.02, M.bodySide, -0.42, 1.05, -DIM.D / 2 - 0.005, "puerta-servicio"));
    var lock = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16), M.chrome);
    lock.rotation.x = Math.PI / 2;
    lock.position.set(-0.04, 1.05, -DIM.D / 2 - 0.02);
    backGroup.add(lock);

    /* UPS + acometida */
    backGroup.add(box(0.4, 0.26, 0.16, M.steelDark, 0.52, 0.36, -DIM.D / 2 - 0.08, "ups"));
    var upsLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), emissiveMat("#2fd39a", 2.2));
    upsLed.position.set(0.52, 0.42, -DIM.D / 2 - 0.162);
    backGroup.add(upsLed);
    var conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 12), M.steelDark);
    conduit.position.set(0.72, 0.2, -DIM.D / 2 - 0.06);
    backGroup.add(conduit);

    /* antena / router */
    var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 8), M.steelDark);
    ant.position.set(0.78, 2.12, -DIM.D / 2 - 0.06);
    backGroup.add(ant);

    /* ------------------------------------------------------------- API --- */

    api.group = root;
    api.doors = doors;
    api.dim = DIM;
    api.zones = ZONE;
    api.screenCanvas = scrCanvas;
    api.screenTex = scrTex;
    api.screenMesh = screen;
    api.screenLight = screenLight;
    api.mats = M;
    api.shellMats = shellMats;
    api.cavityGroup = cavityGroup;
    api.coldAir = coldAir;
    api.freezeAir = freezeAir;
    api.airBase = airBase;
    api.scanBeam = scanBeam;
    api.scanBeamMat = scanBeamMat;
    api.scanGlowMat = scanGlowMat;
    api.scanLight = scanLight;
    api.backGroup = backGroup;
    api.signLight = signLight;

    api.byCode = {};
    doors.forEach(function (d) { api.byCode[d.code] = d; });

    api.setScreen = function (state, data) {
      paintScreen(scrCanvas, state, data);
      scrTex.needsUpdate = true;
    };

    var STATE_COLORS = {
      free: "#2fd39a",
      occupied: null,       // color de zona
      open: "#f5a524",
      error: "#f4526b",
      alert: "#f5a524"
    };

    api.setDoorState = function (code, state) {
      var d = api.byCode[code];
      if (!d) return;
      d.state = state;
      var hex = STATE_COLORS[state] || d.zone.hex;
      d.ledMat.emissive.set(hex);
      d.ledMat.emissiveIntensity = state === "free" ? 0.9 : 1.9;
    };

    api.openDoor = function (code, deg) {
      var d = api.byCode[code];
      if (d) d.targetAngle = ((deg === undefined ? 105 : deg) * Math.PI) / 180;
    };

    api.closeDoor = function (code) {
      var d = api.byCode[code];
      if (d) d.targetAngle = 0;
    };

    api.closeAll = function () {
      doors.forEach(function (d) { d.targetAngle = 0; });
    };

    api.setXray = function (on) {
      shellMats.forEach(function (m) {
        m.transparent = on;
        m.opacity = on ? 0.2 : 1;
        m.depthWrite = !on;
        m.needsUpdate = true;
      });
      signFaceMat.transparent = on; signFaceMat.opacity = on ? 0.35 : 1;
      coldAir.visible = on;
      freezeAir.visible = on;
    };

    api.setAir = function (on) {
      coldAir.visible = on;
      freezeAir.visible = on;
    };

    api.occupied = Object.keys(CONTENTS);

    api.setContents = function (code, on) {
      if (contentsByCode[code]) contentsByCode[code].visible = on;
    };

    api.resetContents = function () {
      for (var k in contentsByCode) contentsByCode[k].visible = true;
    };

    /* animación por frame */
    api.update = function (dt, t) {
      doors.forEach(function (d) {
        if (Math.abs(d.angle - d.targetAngle) > 0.0015) {
          d.angle += (d.targetAngle - d.angle) * Math.min(1, dt * 7);
          d.hinge.rotation.y = -d.angle;
        }
      });

      /* deriva del aire frío */
      [[coldAir, airBase.cold], [freezeAir, airBase.freeze]].forEach(function (pair) {
        if (!pair[0].visible) return;
        var pos = pair[0].geometry.attributes.position, base = pair[1];
        for (var i = 0; i < pos.count; i++) {
          var by = base[i * 3 + 1];
          var yy = by - (((t * 0.09 + i * 0.037) % 0.16) - 0.08);
          pos.array[i * 3] = base[i * 3] + Math.sin(t * 0.7 + i) * 0.008;
          pos.array[i * 3 + 1] = yy;
          pos.array[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.5 + i) * 0.008;
        }
        pos.needsUpdate = true;
      });
    };

    return api;
  }

  /* ------------------------------------------------------------ hotspots --- */

  var HOTSPOTS = [
    {
      id: "pantalla", pos: [0, 1.66, 0.46], label: "Pantalla táctil 15\"",
      title: "Pantalla táctil de 15\"",
      body: "Interfaz de autoservicio en español con alto contraste y modo accesible. Guía al cliente y al repartidor paso a paso, muestra la temperatura de custodia en vivo y opera 24/7 sin personal en sitio."
    },
    {
      id: "lector", pos: [0, 1.37, 0.46], label: "Lector QR",
      title: "Lector QR de un solo uso",
      body: "Escáner óptico 2D que valida el código QR dinámico generado por la app FrioBox. El código es de un solo uso y expira, de modo que la puerta abre únicamente para el pedido correcto."
    },
    {
      id: "teclado", pos: [0, 1.155, 0.44], label: "Teclado PIN",
      title: "Teclado PIN antivandálico",
      body: "Respaldo cuando el cliente no puede escanear: PIN de 6 dígitos enviado por app y SMS. Teclado de acero con teclas selladas contra polvo y agua."
    },
    {
      id: "camara", pos: [0, 1.94, 0.44], label: "Cámara de seguridad",
      title: "Cámara enlazada a operaciones",
      body: "Domo de video vinculado directamente a la central de operaciones. Registra cada apertura como evidencia y disuade el vandalismo, una de las amenazas identificadas en el análisis FODA."
    },
    {
      id: "congelacion", pos: [-0.62, 1.5, 0.44], label: "Zona congelación −18 °C",
      title: "Columna de congelación (−18 °C)",
      body: "Cuatro casilleros A1–A4 con evaporador independiente para helados, carnes y productos congelados. Es la capacidad que ningún locker de paquetería tradicional ofrece."
    },
    {
      id: "refrigeracion", pos: [0.62, 1.5, 0.44], label: "Zona refrigeración 0–5 °C",
      title: "Columna de refrigeración (0 a 5 °C)",
      body: "Cinco casilleros C1–C5 más dos casilleros B1–B2 bajo el kiosco, para lácteos, frutas, verduras, medicamentos y flores."
    },
    {
      id: "led", pos: [0.9, 1.05, 0.42], label: "LED de estado",
      title: "LED de estado por casillero",
      body: "Verde disponible, azul en custodia refrigerada, violeta congelado, ámbar puerta abierta y rojo incidencia. Permite auditar el estado de toda la estación de un vistazo."
    },
    {
      id: "corona", pos: [0, 2.28, 0.44], label: "Corona luminosa",
      title: "Corona luminosa de marca",
      body: "Señalización iluminada visible de día y de noche. Comunica «retiro 24/7» y las dos zonas térmicas, y construye reconocimiento de marca en los puntos de alto flujo urbano."
    },
    {
      id: "condensadora", pos: [0, 1.78, -0.62], label: "Unidad condensadora",
      title: "Unidad condensadora dual",
      body: "Dos circuitos de refrigeración independientes con ventiladores de baja emisión sonora, para sostener simultáneamente la zona de frío y la de congelación."
    },
    {
      id: "rejillas", pos: [0.55, 0.6, -0.52], label: "Rejillas de ventilación",
      title: "Rejillas de disipación",
      body: "Louvers inclinados que evacuan el calor del condensador sin permitir el ingreso de lluvia ni de objetos. Requieren 40 cm libres al respaldo."
    },
    {
      id: "ups", pos: [0.52, 0.36, -0.55], label: "UPS de respaldo",
      title: "UPS y apertura de emergencia",
      body: "Alimentación ininterrumpida que sostiene la refrigeración y las cerraduras ante cortes de energía, con protocolo de apertura manual asistida. Responde a la amenaza de fallas de conectividad del CAME."
    },
    {
      id: "anclaje", pos: [0.82, 0.03, 0.3], label: "Anclaje al piso",
      title: "Anclaje antivandalismo",
      body: "Cuatro placas ancladas con pernos de expansión a la losa. Junto con el chasis de acero reforzado impide el arrastre o volcado del equipo."
    },
    {
      id: "sensor", pos: [0.85, 1.62, 0], label: "Sensor térmico",
      title: "Sensor térmico por casillero",
      body: "Cada casillero lleva su propio sensor que reporta a la nube cada 60 segundos. Es la base de la trazabilidad térmica que el cliente consulta desde la app."
    }
  ];

  /* ------------------------------------------------------------- export --- */

  global.FrioBoxModel = {
    DIM: DIM,
    ZONE: ZONE,
    HOTSPOTS: HOTSPOTS,
    buildLocker: buildLocker,
    makeQRCanvas: makeQRCanvas,
    paintScreen: paintScreen
  };
})(window);
