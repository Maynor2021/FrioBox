/* ==========================================================================
   FrioBox · Entornos de instalación
   Estudio · Gasolinera · Supermercado · Farmacia
   ========================================================================== */

(function (global) {
  "use strict";

  function std(color, m, r, extra) {
    var p = { color: color, metalness: m, roughness: r };
    if (extra) for (var k in extra) p[k] = extra[k];
    return new THREE.MeshStandardMaterial(p);
  }

  function box(w, h, d, mat, x, y, z, name) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (name) mesh.name = name;
    return mesh;
  }

  function canvasTex(w, h, draw, repX, repY) {
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    draw(cv.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX || 1, repY || 1);
    t.anisotropy = 8;
    return t;
  }

  function emissive(hex, intensity) {
    return new THREE.MeshStandardMaterial({
      color: 0x0b1118,
      emissive: new THREE.Color(hex),
      emissiveIntensity: intensity || 1,
      roughness: 0.6,
      metalness: 0.05
    });
  }

  function signTex(text, sub, bg, fg, accent) {
    return canvasTex(1024, 256, function (c, w, h) {
      c.fillStyle = bg; c.fillRect(0, 0, w, h);
      c.fillStyle = accent; c.fillRect(0, h - 16, w, 16);
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = fg; c.font = "bold 108px Segoe UI, sans-serif";
      c.fillText(text, w / 2, sub ? h / 2 - 26 : h / 2 - 6);
      if (sub) {
        c.fillStyle = accent; c.font = "600 40px Segoe UI, sans-serif";
        c.fillText(sub, w / 2, h / 2 + 56);
      }
    });
  }

  /* --------------------------------------------------------------- studio --- */

  function studio() {
    var g = new THREE.Group();
    g.name = "env-estudio";

    var disc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.8, 0.1, 72),
      std(0x0d1620, 0.35, 0.55)
    );
    disc.position.y = -0.05;
    disc.receiveShadow = true;
    g.add(disc);

    for (var i = 1; i <= 4; i++) {
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(i * 1.05, i * 1.05 + 0.008, 96),
        new THREE.MeshBasicMaterial({ color: 0x35c8e8, transparent: true, opacity: 0.13, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.003;
      g.add(ring);
    }

    var glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 48),
      new THREE.MeshBasicMaterial({ color: 0x35c8e8, transparent: true, opacity: 0.07 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.002;
    g.add(glow);

    return {
      group: g,
      bg: 0x070d14,
      fog: null,
      ambient: 0.55,
      key: 1.5,
      camera: { pos: [2.5, 1.9, 3.6], target: [0, 1.15, 0] },
      note: "Vista de estudio para revisar geometría, acabados y proporciones del equipo."
    };
  }

  /* ----------------------------------------------------------- gasolinera --- */

  function gasStation() {
    var g = new THREE.Group();
    g.name = "env-gasolinera";

    var asphalt = canvasTex(512, 512, function (c, w, h) {
      c.fillStyle = "#22262b"; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 9000; i++) {
        var v = 20 + Math.random() * 34;
        c.fillStyle = "rgba(" + v + "," + (v + 2) + "," + (v + 5) + ",0.5)";
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, 6, 6);

    var floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshStandardMaterial({
      map: asphalt, metalness: 0.05, roughness: 0.92
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    /* franjas de estacionamiento y zona peatonal */
    var lineMat = new THREE.MeshBasicMaterial({ color: 0xd8dee4, transparent: true, opacity: 0.4 });
    for (var p = 0; p < 4; p++) {
      var ln = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 4.4), lineMat);
      ln.rotation.x = -Math.PI / 2;
      ln.position.set(3.6 + p * 2.5, 0.005, 3.4);
      g.add(ln);
    }
    var walk = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.03, roughness: 0.9 }));
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0.5, 0.008, 0.9);
    walk.receiveShadow = true;
    g.add(walk);
    var curb = box(11, 0.12, 0.16, std(0xc9ced4, 0.05, 0.85), 0.5, 0.06, 1.94, "cordon");
    g.add(curb);

    /* tienda de conveniencia detrás */
    var wallMat = std(0x2b3340, 0.15, 0.7);
    g.add(box(15, 4.2, 0.3, wallMat, 0, 2.1, -1.6, "muro-tienda"));
    var glassMat = std(0x0a1a24, 0.6, 0.14, { transparent: true, opacity: 0.62 });
    [-5.2, -3.2, 3.2, 5.2].forEach(function (x) {
      g.add(box(1.7, 2.3, 0.06, glassMat, x, 1.5, -1.42, "vitrina"));
      var warm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2),
        new THREE.MeshBasicMaterial({ color: 0xffe2ab, transparent: true, opacity: 0.16 }));
      warm.position.set(x, 1.5, -1.44);
      g.add(warm);
    });
    /* puerta de la tienda */
    g.add(box(1.9, 2.5, 0.06, glassMat, -1.3, 1.3, -1.42, "puerta-tienda"));

    var storeSign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.95),
      new THREE.MeshStandardMaterial({
        map: signTex("TIENDA", "ABIERTO 24 HORAS", "#101c2a", "#ffffff", "#f5a524"),
        emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.6, metalness: 0.05
      }));
    storeSign.material.emissiveMap = storeSign.material.map;
    storeSign.position.set(0, 3.5, -1.42);
    g.add(storeSign);

    /* techumbre (canopy) */
    var canopyMat = std(0xe8edf1, 0.1, 0.6);
    g.add(box(17, 0.4, 11, canopyMat, 1.5, 4.85, 3.4, "techumbre"));
    g.add(box(17, 0.34, 0.3, std(0x1d5f8f, 0.2, 0.6), 1.5, 4.6, 8.85, "faja-techumbre"));
    [[-5.5, 3.4], [8, 3.4], [-5.5, 7.6], [8, 7.6]].forEach(function (c0) {
      var col = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 4.65, 16), canopyMat);
      col.position.set(c0[0], 2.32, c0[1]);
      col.castShadow = true;
      g.add(col);
    });

    /* luminarias bajo la techumbre */
    [[-3.5, 2.4], [1.5, 2.4], [6.5, 2.4], [-3.5, 6.2], [1.5, 6.2], [6.5, 6.2]].forEach(function (l) {
      var lam = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshBasicMaterial({ color: 0xfff3dd, transparent: true, opacity: 0.85 }));
      lam.rotation.x = Math.PI / 2;
      lam.position.set(l[0], 4.63, l[1]);
      g.add(lam);
      var pl = new THREE.PointLight(0xfff0d6, 0.55, 13);
      pl.position.set(l[0], 4.4, l[1]);
      g.add(pl);
    });

    /* dispensadores de combustible */
    function pump(px, pz) {
      var pg = new THREE.Group();
      pg.position.set(px, 0, pz);
      var island = box(3.2, 0.18, 1.5, std(0xc9ced4, 0.05, 0.85), 0, 0.09, 0, "isla");
      pg.add(island);
      var bodyMat = std(0xf2f5f7, 0.25, 0.45);
      pg.add(box(1.05, 1.85, 0.7, bodyMat, 0, 1.1, 0, "surtidor"));
      pg.add(box(1.1, 0.34, 0.75, std(0x1d5f8f, 0.3, 0.5), 0, 2.14, 0, "tapa-surtidor"));
      [-1, 1].forEach(function (s) {
        var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.5), emissive("#0d3b4d", 0.9));
        scr.position.set(0, 1.5, s * 0.355);
        if (s < 0) scr.rotation.y = Math.PI;
        pg.add(scr);
        var noz = box(0.1, 0.3, 0.13, std(0x1a1e24, 0.4, 0.5), s * 0.42, 0.86, s * 0.24, "pistola");
        pg.add(noz);
        var hose = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 16, Math.PI), std(0x0d1014, 0.2, 0.8));
        hose.position.set(s * 0.42, 1.06, s * 0.24);
        hose.rotation.y = Math.PI / 2;
        pg.add(hose);
      });
      var poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 10), bodyMat);
      poleL.position.set(-1.4, 1.15, 0); pg.add(poleL);
      var poleR = poleL.clone(); poleR.position.x = 1.4; pg.add(poleR);
      return pg;
    }
    g.add(pump(2.2, 5.6));
    g.add(pump(7.4, 5.6));

    /* bolardos protegiendo el locker */
    [-1.5, 1.5].forEach(function (bx) {
      var b = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.92, 14), std(0xf5c33b, 0.2, 0.6));
      b.position.set(bx, 0.46, 0.72);
      b.castShadow = true;
      g.add(b);
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.12, 14), std(0x1a1e24, 0.2, 0.7));
      cap.position.set(bx, 0.86, 0.72);
      g.add(cap);
    });

    /* tótem direccional FrioBox */
    var totem = new THREE.Group();
    totem.position.set(-3.5, 0, 1.1);
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.3, 12), std(0x2b3340, 0.5, 0.4));
    post.position.y = 1.15; totem.add(post);
    var tSign = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.62),
      new THREE.MeshStandardMaterial({
        map: signTex("FrioBox", "RETIRO AQUÍ →", "#0c1a26", "#ffffff", "#35c8e8"),
        emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.55, metalness: 0.05
      }));
    tSign.material.emissiveMap = tSign.material.map;
    tSign.position.set(0, 2.05, 0.03);
    totem.add(tSign);
    var tBack = tSign.clone(); tBack.position.z = -0.03; tBack.rotation.y = Math.PI; totem.add(tBack);
    g.add(totem);

    /* luz de cortesía sobre el locker */
    var spot = new THREE.SpotLight(0xdff3ff, 1.15, 9, 0.62, 0.45, 1.4);
    spot.position.set(0, 4.3, 2.2);
    spot.target.position.set(0, 1.1, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    g.add(spot);
    g.add(spot.target);

    return {
      group: g,
      bg: 0x070c13,
      fog: { color: 0x070c13, near: 16, far: 42 },
      ambient: 0.34,
      key: 0.5,
      camera: { pos: [3.4, 2.2, 5.2], target: [0, 1.25, 0] },
      note: "Ubicación primaria del plan: gasolinera de alto flujo urbano, bajo techumbre, junto a la tienda de conveniencia y con acceso peatonal y vehicular 24/7."
    };
  }

  /* --------------------------------------------------------- supermercado --- */

  function supermarket() {
    var g = new THREE.Group();
    g.name = "env-supermercado";

    var tile = canvasTex(256, 256, function (c, w, h) {
      c.fillStyle = "#d9dde1"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "#b9c0c6"; c.lineWidth = 4;
      c.strokeRect(0, 0, w, h);
      c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(8, 8, w - 16, h - 16);
    }, 14, 14);

    var floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({
      map: tile, metalness: 0.12, roughness: 0.34
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    /* muro y vitrina de acceso */
    g.add(box(16, 4.6, 0.28, std(0xeceff2, 0.06, 0.75), 0, 2.3, -1.55, "muro"));
    var glassMat = std(0xbfe0ef, 0.4, 0.1, { transparent: true, opacity: 0.34 });
    g.add(box(15.6, 3.4, 0.06, glassMat, 0, 1.8, 5.4, "vitrina-acceso"));
    [-4, 4].forEach(function (mx) {
      var mull = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.4, 0.1), std(0x8a939b, 0.6, 0.35));
      mull.position.set(mx, 1.8, 5.4);
      g.add(mull);
    });

    /* cielo con paneles de luz */
    g.add(box(20, 0.24, 16, std(0xe4e8ec, 0.05, 0.8), 0, 4.7, 2, "cielo"));
    [-4.5, 0, 4.5].forEach(function (lx) {
      [-0.2, 3.4].forEach(function (lz) {
        var panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }));
        panel.rotation.x = Math.PI / 2;
        panel.position.set(lx, 4.56, lz);
        g.add(panel);
        var pl = new THREE.PointLight(0xffffff, 0.42, 12);
        pl.position.set(lx, 4.3, lz);
        g.add(pl);
      });
    });

    /* rótulo del aliado */
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.1),
      new THREE.MeshStandardMaterial({
        map: signTex("SUPERMERCADO", "PUNTO DE RETIRO FRIOBOX", "#123a2a", "#ffffff", "#35c8e8"),
        emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.6, metalness: 0.05
      }));
    sign.material.emissiveMap = sign.material.map;
    sign.position.set(0, 3.7, -1.38);
    g.add(sign);

    /* carritos de compra */
    for (var k = 0; k < 5; k++) {
      var cart = new THREE.Group();
      cart.position.set(4.6 + k * 0.28, 0, 2.3);
      var basket = box(0.6, 0.42, 0.86, std(0xa9b3bb, 0.85, 0.3), 0, 0.62, 0, "canasta");
      cart.add(basket);
      var handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 14, Math.PI), std(0xd8492f, 0.3, 0.5));
      handle.position.set(0, 0.94, 0.44);
      handle.rotation.z = Math.PI / 2;
      cart.add(handle);
      [[-0.24, 0.36], [0.24, 0.36], [-0.24, -0.36], [0.24, -0.36]].forEach(function (w0) {
        var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), std(0x22272d, 0.3, 0.6));
        wh.rotation.z = Math.PI / 2;
        wh.position.set(w0[0], 0.05, w0[1]);
        cart.add(wh);
      });
      g.add(cart);
    }

    /* pilar y basurero de ambiente */
    g.add(box(0.5, 4.6, 0.5, std(0xdfe3e7, 0.08, 0.7), -6.2, 2.3, 2.4, "pilar"));

    var spot = new THREE.SpotLight(0xffffff, 0.85, 10, 0.7, 0.5, 1.2);
    spot.position.set(0, 4.2, 2.4);
    spot.target.position.set(0, 1.1, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    g.add(spot); g.add(spot.target);

    return {
      group: g,
      bg: 0x101820,
      fog: null,
      ambient: 0.78,
      key: 0.7,
      camera: { pos: [3.1, 2.0, 4.6], target: [0, 1.2, 0] },
      note: "Vestíbulo de supermercado aliado: el cliente recoge su compra en línea al pasar, sin depender del horario de reparto."
    };
  }

  /* -------------------------------------------------------------- farmacia --- */

  function pharmacy() {
    var g = new THREE.Group();
    g.name = "env-farmacia";

    var tile = canvasTex(256, 256, function (c, w, h) {
      c.fillStyle = "#e7ece8"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "#cbd4cd"; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
    }, 10, 10);

    var floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshStandardMaterial({
      map: tile, metalness: 0.1, roughness: 0.4
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    g.add(box(9.5, 3.9, 0.26, std(0xf1f5f2, 0.05, 0.78), 0, 1.95, -1.5, "muro"));
    g.add(box(9.5, 0.22, 9, std(0xe8ede9, 0.05, 0.8), 0, 3.9, 2.4, "cielo"));

    /* cruz de farmacia */
    var crossMat = emissive("#2fd39a", 1.3);
    g.add(box(0.9, 0.28, 0.08, crossMat, -3.1, 3.05, -1.34, "cruz-h"));
    g.add(box(0.28, 0.9, 0.08, crossMat, -3.1, 3.05, -1.34, "cruz-v"));

    var sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.86),
      new THREE.MeshStandardMaterial({
        map: signTex("FARMACIA", "MEDICAMENTOS EN CADENA DE FRÍO", "#0f2a22", "#ffffff", "#2fd39a"),
        emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.6, metalness: 0.05
      }));
    sign.material.emissiveMap = sign.material.map;
    sign.position.set(1.3, 3.05, -1.34);
    g.add(sign);

    /* mostrador */
    g.add(box(3.2, 1.05, 0.7, std(0xd7ded8, 0.08, 0.6), 3.6, 0.53, 0.6, "mostrador"));
    g.add(box(3.3, 0.06, 0.8, std(0x9fb3a8, 0.5, 0.4), 3.6, 1.08, 0.6, "cubierta"));

    [-2.4, 0, 2.4].forEach(function (lx) {
      var panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
      panel.rotation.x = Math.PI / 2;
      panel.position.set(lx, 3.77, 1.4);
      g.add(panel);
      var pl = new THREE.PointLight(0xffffff, 0.38, 9);
      pl.position.set(lx, 3.5, 1.4);
      g.add(pl);
    });

    var spot = new THREE.SpotLight(0xffffff, 0.8, 9, 0.7, 0.5, 1.2);
    spot.position.set(0, 3.6, 2);
    spot.target.position.set(0, 1.1, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    g.add(spot); g.add(spot.target);

    return {
      group: g,
      bg: 0x121a1e,
      fog: null,
      ambient: 0.8,
      key: 0.62,
      camera: { pos: [2.6, 1.85, 4.1], target: [0, 1.15, 0] },
      note: "Farmacia aliada: resguardo de medicamentos termosensibles con trazabilidad de temperatura verificable por el paciente."
    };
  }

  global.FrioBoxEnv = {
    estudio: studio,
    gasolinera: gasStation,
    supermercado: supermarket,
    farmacia: pharmacy
  };
})(window);
