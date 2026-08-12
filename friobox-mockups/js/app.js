/* ==========================================================================
   FrioBox · Aplicación de mockups interactivos
   ========================================================================== */

(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var M = window.FrioBoxModel;
  var ENV = window.FrioBoxEnv;

  /* ====================================================== estado global === */

  var renderer, scene, camera, controls, clock;
  var locker, envGroup = null, envMeta = null;
  var hemi, dirLight;
  var tween = null;
  var hotspotEls = [];
  var currentSection = "panorama";
  var autoRotate = false;

  var sim = {
    cold: 3.4, coldTarget: 3.4,
    freeze: -18.2, freezeTarget: -18.2,
    history: [],
    power: true,
    ups: false,
    status: "Nominal",
    doorEvent: 0
  };

  for (var h = 0; h < 120; h++) {
    sim.history.push({ c: 3.4 + Math.sin(h / 9) * 0.5, f: -18.2 + Math.sin(h / 7) * 0.4 });
  }

  /* ============================================================== visor === */

  function initViewer() {
    var canvas = $("#scene-canvas");
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = false;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070d14);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
    camera.position.set(2.5, 1.9, 3.6);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.15, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.8;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI / 2 + 0.16;
    controls.enablePan = true;

    hemi = new THREE.HemisphereLight(0xbfdcec, 0x0a1118, 0.55);
    scene.add(hemi);

    dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(4.5, 6.5, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 22;
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.top = 6;
    dirLight.shadow.camera.bottom = -1;
    dirLight.shadow.bias = -0.0012;
    scene.add(dirLight);

    var fill = new THREE.DirectionalLight(0x8fc4de, 0.4);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0x35c8e8, 0.32);
    rim.position.set(-2, 2.4, 4.5);
    scene.add(rim);

    locker = M.buildLocker();
    scene.add(locker.group);

    clock = new THREE.Clock();
    window.addEventListener("resize", onResize);
    onResize();
  }

  function onResize() {
    var st = $(".stage");
    var w = st.clientWidth, hh = st.clientHeight;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    camera.updateProjectionMatrix();
    resizeChart();
  }

  function setEnvironment(name) {
    if (envGroup) { scene.remove(envGroup); disposeGroup(envGroup); }
    envMeta = ENV[name]();
    envGroup = envMeta.group;
    scene.add(envGroup);
    scene.background = new THREE.Color(envMeta.bg);
    scene.fog = envMeta.fog ? new THREE.Fog(envMeta.fog.color, envMeta.fog.near, envMeta.fog.far) : null;
    hemi.intensity = envMeta.ambient;
    dirLight.intensity = envMeta.key;
    var note = $("#env-note");
    if (note) note.textContent = envMeta.note;
    return envMeta;
  }

  function disposeGroup(g) {
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) {
          if (m.map && m.map.dispose) m.map.dispose();
          m.dispose();
        });
      }
    });
  }

  function flyTo(pos, target, dur) {
    tween = {
      p0: camera.position.clone(),
      p1: new THREE.Vector3(pos[0], pos[1], pos[2]),
      t0: controls.target.clone(),
      t1: new THREE.Vector3(target[0], target[1], target[2]),
      t: 0,
      dur: dur === undefined ? 1.1 : dur
    };
  }

  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  /* ========================================================== hotspots === */

  function buildHotspots() {
    var layer = $("#hotspot-layer");
    layer.innerHTML = "";
    hotspotEls = M.HOTSPOTS.map(function (hs) {
      var el = document.createElement("div");
      el.className = "hotspot";
      el.innerHTML = '<div class="hotspot-dot"></div><div class="hotspot-tag">' + hs.label + "</div>";
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        showHotspot(hs, el);
      });
      layer.appendChild(el);
      return { el: el, hs: hs, v: new THREE.Vector3(hs.pos[0], hs.pos[1], hs.pos[2]) };
    });
  }

  function showHotspot(hs, el) {
    hotspotEls.forEach(function (o) { o.el.classList.remove("is-open"); });
    if (el) el.classList.add("is-open");
    var box = $("#hs-detail");
    if (!box) return;
    box.innerHTML =
      '<div class="card" style="border-color:rgba(53,200,232,.34);background:rgba(53,200,232,.06)">' +
      '<div class="card-h"><span class="ico">' + iconSvg("target") + "</span>" + hs.title + "</div>" +
      '<p class="card-b">' + hs.body + "</p></div>";
    if (currentSection === "vista360") {
      var p = hs.pos;
      var out = new THREE.Vector3(p[0], p[1], p[2]).sub(new THREE.Vector3(0, 1.1, 0)).normalize();
      flyTo(
        [p[0] + out.x * 1.5 + 0.35, p[1] + 0.22, p[2] + out.z * 1.5 + 0.5],
        [p[0], p[1], p[2]], 0.95
      );
    }
  }

  var CENTER = new THREE.Vector3(0, 1.1, 0);
  var tmpV = new THREE.Vector3();

  function updateHotspots() {
    var show = currentSection === "vista360" && $("#tg-hotspots").classList.contains("on");
    var st = $(".stage");
    var w = st.clientWidth, hh = st.clientHeight;
    hotspotEls.forEach(function (o) {
      if (!show) { o.el.style.display = "none"; return; }
      tmpV.copy(o.v);
      var nrm = tmpV.clone().sub(CENTER).normalize();
      var toCam = camera.position.clone().sub(o.v).normalize();
      if (nrm.dot(toCam) < 0.08) { o.el.style.display = "none"; return; }
      tmpV.project(camera);
      if (tmpV.z > 1) { o.el.style.display = "none"; return; }
      var x = (tmpV.x * 0.5 + 0.5) * w;
      var y = (-tmpV.y * 0.5 + 0.5) * hh;
      if (x < 8 || x > w - 8 || y < 8 || y > hh - 8) { o.el.style.display = "none"; return; }
      o.el.style.display = "block";
      o.el.style.left = x + "px";
      o.el.style.top = y + "px";
      o.el.classList.toggle("flip", x > w * 0.62);
    });
  }

  /* ============================================================ iconos === */

  var ICONS = {
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    snow: '<path d="M12 2v20M4.9 6.5l14.2 11M19.1 6.5L4.9 17.5"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 19h2v2h-2z"/>',
    truck: '<path d="M2 7h11v9H2zM13 10h5l3 3v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    thermo: '<path d="M12 14V4a2 2 0 0 1 4 0v10"/><circle cx="14" cy="17" r="4"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    pin: '<path d="M12 22s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    shield: '<path d="M12 2l8 3v7c0 5-4 8.5-8 10-4-1.5-8-5-8-10V5z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    check: '<path d="M4 12.5 9.5 18 20 6"/>',
    box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v10"/>'
  };

  function iconSvg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || ICONS.target) + "</svg>";
  }

  function paintIcons() {
    $$("[data-ico]").forEach(function (el) {
      if (!el.dataset.done) { el.innerHTML = iconSvg(el.dataset.ico); el.dataset.done = "1"; }
    });
  }

  /* ====================================================== códigos y app === */

  var access = { code: "", pin: "", expires: 60, mode: "qr", typed: "" };

  function newCode() {
    var s = "";
    for (var i = 0; i < 4; i++) s += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    access.code = "FBX-" + s + "-" + Math.floor(1000 + Math.random() * 9000);
    access.pin = "";
    for (var j = 0; j < 6; j++) access.pin += Math.floor(Math.random() * 10);
    access.expires = 60;
    access.typed = "";
    renderAccessPhone();
  }

  function renderQR(container, text) {
    container.innerHTML = "";
    container.appendChild(M.makeQRCanvas(text, 260));
  }

  function renderAccessPhone() {
    var wrap = $("#acc-qr");
    if (!wrap) return;
    renderQR(wrap, access.code);
    $("#acc-code").textContent = access.code;
    $("#acc-expiry").textContent = access.expires + " s";
    $("#acc-pin").textContent = access.pin.replace(/(\d{3})(\d{3})/, "$1 $2");
    renderTyped();
  }

  function renderTyped() {
    var d = $("#pin-display");
    if (!d) return;
    d.innerHTML = "";
    for (var i = 0; i < 6; i++) {
      var c = document.createElement("div");
      c.className = "pin-cell" + (i < access.typed.length ? " filled" : "");
      c.textContent = i < access.typed.length ? "•" : "";
      d.appendChild(c);
    }
  }

  /* ======================================================== flujo entrega === */

  var TARGET_DOOR = "C3";

  var FLOW = [
    {
      title: "Recepción de solicitud",
      kind: "Operación",
      desc: "El supermercado o farmacia aliada envía el pedido a FrioBox por API desde su propio checkout. El sistema recibe el tipo de producto, la zona térmica que requiere y la estación destino; el repartidor se identifica en el kiosco con su credencial digital.",
      run: function () {
        locker.closeAll();
        locker.setContents(TARGET_DOOR, false);
        locker.setDoorState(TARGET_DOOR, "free");
        locker.setScreen("courier", { ally: "Supermercado La Colonia", orders: "3 pedidos por depositar", cold: sim.cold, freeze: sim.freeze });
        flyTo([1.45, 1.95, 2.75], [0, 1.4, 0.15], 1.1);
        phone(
          '<div class="ps-push"><div class="h">Nuevo pedido asignado</div>' +
          '<div class="b">Orden #48210 · 2 refrigerados, 1 congelado · Estación 04 Blvd. Morazán</div></div>' +
          row("Aliado", "La Colonia") + row("Repartidor", "RP-0148") + row("Ventana", "18:00 – 20:00 h")
        );
      }
    },
    {
      title: "Validación de espacio",
      kind: "Inspección",
      desc: "Antes de abrir cualquier puerta el sistema inspecciona la disponibilidad y la temperatura real de cada casillero. Solo asigna uno que esté libre, limpio y dentro del rango térmico del producto: si la zona de frío no está en rango, no se autoriza el depósito.",
      run: function () {
        locker.setContents(TARGET_DOOR, false);
        locker.setScreen("assign", { targetIdx: 7, door: TARGET_DOOR, zone: "Refrigerado 0 a 5 °C", cold: sim.cold, freeze: sim.freeze });
        locker.setDoorState(TARGET_DOOR, "alert");
        flyTo([0.7, 1.72, 1.9], [0.05, 1.5, 0.25], 0.9);
        phone(
          row("Casillero asignado", TARGET_DOOR) +
          row("Zona", "Refrigeración") +
          row("Temp. verificada", sim.cold.toFixed(1) + " °C") +
          '<div class="ps-push" style="border-color:rgba(47,211,154,.35);background:rgba(47,211,154,.09)">' +
          '<div class="h">Espacio validado ✓</div><div class="b">Casillero C3 libre y en rango térmico.</div></div>'
        );
      }
    },
    {
      title: "Depósito del pedido",
      kind: "Operación",
      desc: "El repartidor escanea el QR del manifiesto y únicamente la puerta asignada se destraba. Deposita el pedido, cierra y el sensor de cierre confirma el sellado del burlete. La operación queda registrada con hora, casillero y video.",
      run: function () {
        locker.setContents(TARGET_DOOR, false);
        locker.setScreen("open", { door: TARGET_DOOR, count: 45, msg: "Deposite el pedido y cierre la puerta", cold: sim.cold, freeze: sim.freeze });
        locker.setDoorState(TARGET_DOOR, "open");
        locker.openDoor(TARGET_DOOR, 108);
        sim.doorEvent = 6;
        flyTo([1.5, 1.42, 1.75], [0.5, 1.15, 0.25], 1.05);
        setTimeout(function () {
          if (flowStep === 2 && currentSection === "entrega") locker.setContents(TARGET_DOOR, true);
        }, 1900);
        phone(
          '<div class="ps-push"><div class="h">Puerta C3 abierta</div>' +
          '<div class="b">Deposite el producto y cierre. Tiene 45 segundos.</div></div>' +
          row("Apertura", "18:24:07") + row("Autorizado por", "QR manifiesto")
        );
      }
    },
    {
      title: "Notificación al cliente",
      kind: "Operación",
      desc: "Al confirmar el cierre, la plataforma genera el código de retiro de un solo uso y avisa al cliente por app y SMS con la estación, el número de casillero y el plazo de resguardo. Aquí termina la responsabilidad del repartidor.",
      run: function () {
        locker.closeDoor(TARGET_DOOR);
        locker.setDoorState(TARGET_DOOR, "occupied");
        locker.setScreen("stored", { door: TARGET_DOOR, zone: "Refrigerado 0 a 5 °C", expiry: "Hoy 22:00 h", cold: sim.cold, freeze: sim.freeze });
        flyTo([0.4, 1.7, 2.3], [0, 1.4, 0], 1.05);
        newCode();
        phone(
          '<div class="ps-push"><div class="h">Su pedido ya está disponible</div>' +
          '<div class="b">Estación 04 · Casillero C3 · Retírelo antes de hoy 22:00 h</div></div>' +
          '<div class="qr-box" id="flow-qr"></div>' +
          '<div style="text-align:center;font-family:var(--mono);font-size:10px;color:var(--text-3)">' +
          access.code + "</div>" +
          row("PIN alterno", access.pin)
        );
        var q = $("#flow-qr");
        if (q) renderQR(q, access.code);
      }
    },
    {
      title: "Custodia térmica",
      kind: "Almacenamiento",
      desc: "Mientras el cliente llega, el casillero mantiene el producto en su rango y el sensor reporta a la nube cada 60 segundos. Cualquier desviación dispara alerta a la central antes de que afecte al cliente; el UPS sostiene el frío ante cortes de energía.",
      run: function () {
        locker.setScreen("temps", { cold: sim.cold, freeze: sim.freeze });
        locker.setXray(true);
        flyTo([1.9, 1.5, 2.1], [0.35, 1.2, 0], 1.1);
        phone(
          row("Casillero", TARGET_DOOR) +
          row("Temp. actual", sim.cold.toFixed(1) + " °C") +
          row("Desviaciones", "0") +
          '<div class="ps-push" style="border-color:rgba(47,211,154,.35);background:rgba(47,211,154,.09)">' +
          '<div class="h">Cadena de frío estable</div>' +
          '<div class="b">Trazabilidad térmica disponible en su historial.</div></div>'
        );
      }
    },
    {
      title: "Retiro por el cliente",
      kind: "Operación",
      desc: "El cliente llega a la hora que le convenga, escanea su QR o digita el PIN y la puerta se abre solo para su pedido. La entrega es desatendida: nadie del equipo FrioBox necesita estar en el sitio.",
      run: function () {
        locker.setXray(false);
        locker.setScreen("open", { door: TARGET_DOOR, count: 30, msg: "Retire su pedido y cierre la puerta", cold: sim.cold, freeze: sim.freeze });
        locker.setDoorState(TARGET_DOOR, "open");
        locker.openDoor(TARGET_DOOR, 108);
        sim.doorEvent = 5;
        flyTo([1.35, 1.3, 1.9], [0.45, 1.15, 0.2], 1.05);
        phone(
          '<div class="ps-push" style="border-color:rgba(47,211,154,.35);background:rgba(47,211,154,.09)">' +
          '<div class="h">Retiro autorizado ✓</div><div class="b">Casillero C3 abierto. Gracias por usar FrioBox.</div></div>' +
          row("Hora de retiro", "19:41") + row("Tiempo en custodia", "1 h 17 min") +
          row("Cadena de frío", "Sin desviaciones")
        );
        setTimeout(function () {
          if (flowStep === 5 && currentSection === "entrega") locker.setContents(TARGET_DOOR, false);
        }, 2100);
        setTimeout(function () {
          if (flowStep === 5 && currentSection === "entrega") {
            locker.closeDoor(TARGET_DOOR);
            locker.setDoorState(TARGET_DOOR, "free");
            locker.setScreen("picked", { cold: sim.cold, freeze: sim.freeze });
          }
        }, 4200);
      }
    }
  ];

  function row(k, v) {
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;' +
      'border-bottom:1px dashed var(--line);font-size:10.5px">' +
      '<span style="color:var(--text-3)">' + k + "</span>" +
      '<b style="font-family:var(--mono);font-weight:600">' + v + "</b></div>";
  }

  function phone(html) {
    var el = $("#flow-phone");
    if (el) el.innerHTML = html;
  }

  var flowStep = -1;
  var flowTimer = null;

  function renderFlowList() {
    var ul = $("#flow-steps");
    ul.innerHTML = "";
    FLOW.forEach(function (s, i) {
      var li = document.createElement("li");
      li.className = "step";
      li.innerHTML =
        '<div class="step-n">' + (i + 1) + "</div><div style='min-width:0'>" +
        '<div class="step-t">' + s.title + "</div>" +
        '<div class="step-k">' + s.kind + "</div>" +
        '<p class="step-d">' + s.desc + "</p></div>";
      li.addEventListener("click", function () { gotoStep(i); });
      ul.appendChild(li);
    });
  }

  function gotoStep(i) {
    flowStep = Math.max(0, Math.min(FLOW.length - 1, i));
    $$("#flow-steps .step").forEach(function (el, idx) {
      el.classList.toggle("is-active", idx === flowStep);
      el.classList.toggle("is-done", idx < flowStep);
    });
    FLOW[flowStep].run();
    $("#flow-prev").disabled = flowStep === 0;
    $("#flow-next").disabled = flowStep === FLOW.length - 1;
    /* centra el paso activo desplazando solo el panel, nunca la página */
    var active = $("#flow-steps .step.is-active");
    var panel = $(".panel");
    if (active && panel && panel.scrollHeight > panel.clientHeight + 4) {
      var ar = active.getBoundingClientRect(), pr = panel.getBoundingClientRect();
      panel.scrollBy({
        top: (ar.top + ar.height / 2) - (pr.top + pr.height / 2),
        behavior: "smooth"
      });
    }
  }

  function stopAuto() {
    if (flowTimer) { clearInterval(flowTimer); flowTimer = null; }
    var b = $("#flow-auto");
    if (b) b.innerHTML = '<span data-ico="clock"></span>Reproducir';
    paintIcons();
  }

  function toggleAuto() {
    if (flowTimer) { stopAuto(); return; }
    if (flowStep >= FLOW.length - 1) gotoStep(0);
    $("#flow-auto").innerHTML = "Pausar";
    flowTimer = setInterval(function () {
      if (flowStep >= FLOW.length - 1) { stopAuto(); return; }
      gotoStep(flowStep + 1);
    }, 5200);
  }

  /* ========================================================= acceso QR === */

  var accBusy = false;

  function doScan() {
    if (accBusy) return;
    if (access.expires <= 0) { doScanFail(); return; }
    accBusy = true;
    locker.closeAll();
    locker.setDoorState(TARGET_DOOR, "occupied");
    flyTo([0.42, 1.5, 1.25], [0, 1.38, 0.3], 0.85);
    scanFx(2.1);
    locker.setScreen("scan", { t: 0, cold: sim.cold, freeze: sim.freeze });
    accMsg("scan", "Leyendo el código de un solo uso…");

    setTimeout(function () {
      locker.setScreen("open", { door: TARGET_DOOR, count: 30, msg: "Retire su pedido y cierre la puerta", cold: sim.cold, freeze: sim.freeze });
      locker.setDoorState(TARGET_DOOR, "open");
      locker.openDoor(TARGET_DOOR, 108);
      sim.doorEvent = 5;
      flyTo([1.35, 1.3, 1.95], [0.45, 1.15, 0.2], 1);
      accMsg("ok", "Código válido. Puerta " + TARGET_DOOR + " abierta · el código quedó consumido y ya no sirve otra vez.");
      setTimeout(function () { locker.setContents(TARGET_DOOR, false); }, 1500);
      setTimeout(function () {
        locker.closeDoor(TARGET_DOOR);
        locker.setScreen("picked", { cold: sim.cold, freeze: sim.freeze });
        accBusy = false;
        newCode();
        locker.setDoorState(TARGET_DOOR, "occupied");
        locker.setContents(TARGET_DOOR, true);
      }, 3800);
    }, 2200);
  }

  function doScanFail() {
    if (accBusy) return;
    accBusy = true;
    flyTo([0.42, 1.5, 1.25], [0, 1.38, 0.3], 0.85);
    scanFx(1.6, true);
    locker.setScreen("scan", { t: 0, cold: sim.cold, freeze: sim.freeze });
    accMsg("scan", "Leyendo código…");
    setTimeout(function () {
      locker.setScreen("error", { msg: "El código ya fue usado o venció", cold: sim.cold, freeze: sim.freeze });
      accMsg("err", "Código rechazado: los QR son de un solo uso y vencen. Ninguna puerta se abre.");
      setTimeout(function () {
        locker.setScreen("idle", { cold: sim.cold, freeze: sim.freeze });
        accBusy = false;
      }, 3000);
    }, 1700);
  }

  var scanState = { t: 0, dur: 0, fail: false };
  var histAcc = 0, expAcc = 0, scanPaintAcc = 0;

  function scanFx(dur, fail) {
    scanState.t = 0; scanState.dur = dur; scanState.fail = !!fail;
  }

  function accMsg(kind, text) {
    var cls = kind === "ok" ? "ok" : kind === "err" ? "danger" : "warn";
    var ico = kind === "ok" ? "check" : kind === "err" ? "lock" : "qr";
    $("#acc-msg").innerHTML =
      '<div class="alert ' + cls + '"><span class="ai">' + iconSvg(ico) + "</span><div>" + text + "</div></div>";
  }

  function pressKey(k) {
    if (accBusy) return;
    if (k === "C") { access.typed = ""; }
    else if (k === "<") { access.typed = access.typed.slice(0, -1); }
    else if (access.typed.length < 6) { access.typed += k; }
    renderTyped();
    locker.setScreen("pin", { len: access.typed.length, cold: sim.cold, freeze: sim.freeze });
    flyTo([0.3, 1.35, 1.15], [0, 1.25, 0.3], 0.7);

    if (access.typed.length === 6) {
      accBusy = true;
      var ok = access.typed === access.pin;
      setTimeout(function () {
        if (ok) {
          locker.setScreen("open", { door: TARGET_DOOR, count: 30, msg: "Retire su pedido y cierre la puerta", cold: sim.cold, freeze: sim.freeze });
          locker.setDoorState(TARGET_DOOR, "open");
          locker.openDoor(TARGET_DOOR, 108);
          sim.doorEvent = 5;
          flyTo([1.35, 1.3, 1.95], [0.45, 1.15, 0.2], 1);
          accMsg("ok", "PIN correcto. Puerta " + TARGET_DOOR + " abierta.");
          setTimeout(function () { locker.setContents(TARGET_DOOR, false); }, 1400);
          setTimeout(function () {
            locker.closeDoor(TARGET_DOOR);
            locker.setScreen("picked", { cold: sim.cold, freeze: sim.freeze });
            accBusy = false;
            newCode();
            locker.setDoorState(TARGET_DOOR, "occupied");
            locker.setContents(TARGET_DOOR, true);
          }, 3600);
        } else {
          locker.setScreen("error", { msg: "PIN incorrecto · intento 1 de 3", cold: sim.cold, freeze: sim.freeze });
          $("#pin-display").classList.add("err");
          accMsg("err", "PIN incorrecto. Tras 3 intentos el casillero se bloquea y avisa a la central.");
          setTimeout(function () {
            $("#pin-display").classList.remove("err");
            access.typed = ""; renderTyped();
            locker.setScreen("pin", { len: 0, cold: sim.cold, freeze: sim.freeze });
            accBusy = false;
          }, 2200);
        }
      }, 520);
    }
  }

  function setAccessMode(mode) {
    access.mode = mode;
    access.typed = "";
    renderTyped();
    $$("#acc-mode .chip").forEach(function (c) { c.classList.toggle("is-active", c.dataset.mode === mode); });
    $("#acc-qr-block").style.display = mode === "qr" ? "" : "none";
    $("#acc-pin-block").style.display = mode === "pin" ? "" : "none";
    locker.setScreen(mode === "qr" ? "idle" : "pin", { len: 0, cold: sim.cold, freeze: sim.freeze });
    accMsg("scan", mode === "qr"
      ? "Presione «Escanear en el kiosco» para simular el retiro con QR."
      : "Digite el PIN de 6 dígitos que aparece en el teléfono.");
  }

  /* ====================================================== cadena de frío === */

  var chartCv, chartCtx;

  function resizeChart() {
    chartCv = $("#temp-chart");
    if (!chartCv) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = chartCv.clientWidth || 340, hh = 132;
    chartCv.width = w * dpr;
    chartCv.height = hh * dpr;
    chartCtx = chartCv.getContext("2d");
    chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart();
  }

  function drawChart() {
    if (!chartCtx) return;
    var c = chartCtx;
    var w = chartCv.clientWidth || 340, hh = 132;
    c.clearRect(0, 0, w, hh);

    var panes = [
      { key: "c", y0: 4, y1: 62, lo: -1, hi: 9, band: [0, 5], color: "#35c8e8", label: "REFRIG." },
      { key: "f", y0: 70, y1: 128, lo: -24, hi: -12, band: [-20, -16], color: "#7b8cff", label: "CONGEL." }
    ];

    panes.forEach(function (p) {
      var ph = p.y1 - p.y0;
      function ty(v) { return p.y1 - ((v - p.lo) / (p.hi - p.lo)) * ph; }

      c.fillStyle = "rgba(255,255,255,0.022)";
      c.fillRect(0, p.y0, w, ph);

      c.fillStyle = p.color + "1f";
      c.fillRect(0, ty(p.band[1]), w, ty(p.band[0]) - ty(p.band[1]));
      c.strokeStyle = p.color + "44";
      c.setLineDash([3, 3]); c.lineWidth = 1;
      [p.band[0], p.band[1]].forEach(function (v) {
        c.beginPath(); c.moveTo(0, ty(v)); c.lineTo(w, ty(v)); c.stroke();
      });
      c.setLineDash([]);

      var n = sim.history.length;
      c.beginPath();
      for (var i = 0; i < n; i++) {
        var x = (i / (n - 1)) * w;
        var v = sim.history[i][p.key];
        var y = Math.max(p.y0, Math.min(p.y1, ty(v)));
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = p.color; c.lineWidth = 1.8; c.stroke();

      var lastV = sim.history[n - 1][p.key];
      var lastY = Math.max(p.y0, Math.min(p.y1, ty(lastV)));
      c.fillStyle = p.color;
      c.beginPath(); c.arc(w - 2, lastY, 2.8, 0, 6.3); c.fill();

      c.fillStyle = "rgba(255,255,255,0.42)";
      c.font = "600 8px ui-monospace, monospace";
      c.fillText(p.label, 5, p.y0 + 11);
      c.textAlign = "right";
      c.fillStyle = p.color;
      c.font = "600 9px ui-monospace, monospace";
      c.fillText(lastV.toFixed(1) + "°C", w - 6, p.y0 + 11);
      c.textAlign = "left";
    });
  }

  function frioAlert(kind, title, text) {
    var box = $("#frio-alerts");
    if (!box) return;
    var ico = kind === "ok" ? "check" : kind === "danger" ? "bolt" : "thermo";
    box.innerHTML =
      '<div class="alert ' + kind + '"><span class="ai">' + iconSvg(ico) + "</span>" +
      "<div><b>" + title + "</b>" + text + "</div></div>";
  }

  function simOpenDoor() {
    sim.doorEvent = 20;
    sim.status = "Apertura";
    locker.setDoorState("C3", "open");
    locker.openDoor("C3", 100);
    locker.setScreen("open", { door: "C3", count: 30, cold: sim.cold, freeze: sim.freeze });
    flyTo([1.4, 1.35, 1.95], [0.45, 1.18, 0.2], 1);
    frioAlert("warn", "Apertura registrada · casillero C3",
      "La temperatura sube mientras la puerta está abierta. El compresor compensa y el sistema tolera la desviación breve sin marcar incidencia, tal como ocurre en cada retiro.");
    setTimeout(function () {
      locker.closeDoor("C3");
      locker.setDoorState("C3", "occupied");
      sim.status = "Recuperando";
      locker.setScreen("temps", { cold: sim.cold, freeze: sim.freeze });
    }, 5200);
    setTimeout(function () {
      if (sim.power) {
        sim.status = "Nominal";
        frioAlert("ok", "Rango recuperado", "El casillero regresó a su banda objetivo. El evento queda en el historial de trazabilidad que el cliente puede consultar en la app.");
      }
    }, 16000);
  }

  function simPowerLoss() {
    sim.power = false;
    sim.ups = true;
    sim.status = "UPS activo";
    locker.setScreen("alert", { msg: "Corte de energía · UPS en operación", cold: sim.cold, freeze: sim.freeze });
    locker.setXray(true);
    flyTo([2.4, 1.85, 2.4], [0.2, 1.3, 0], 1.2);
    frioAlert("danger", "Corte de energía en la estación",
      "El UPS sostiene cerraduras, sensores y comunicación, y la masa térmica del gabinete conserva el frío. La central de operaciones recibe la alerta y despacha al técnico de campo antes de que el producto se comprometa.");
    setTimeout(function () { if (!sim.power) restorePower(); }, 15000);
  }

  function restorePower() {
    sim.power = true;
    sim.ups = false;
    sim.status = "Nominal";
    locker.setXray(currentSection === "frio" ? true : false);
    locker.setScreen("temps", { cold: sim.cold, freeze: sim.freeze });
    frioAlert("ok", "Energía restablecida",
      "Los compresores retoman su ciclo y el registro térmico del evento queda disponible para el cliente y para auditoría del aliado comercial.");
  }

  function updateSim(dt) {
    sim.coldTarget = 3.4;
    sim.freezeTarget = -18.2;

    if (sim.doorEvent > 0) {
      sim.doorEvent -= dt;
      sim.coldTarget = 11.5;
    }
    if (!sim.power) {
      sim.coldTarget = 7.5;
      sim.freezeTarget = -14.5;
    }

    var rate = sim.doorEvent > 0 ? 0.55 : 0.22;
    sim.cold += (sim.coldTarget - sim.cold) * Math.min(1, dt * rate);
    sim.freeze += (sim.freezeTarget - sim.freeze) * Math.min(1, dt * 0.12);
    sim.cold += (Math.random() - 0.5) * 0.03;
    sim.freeze += (Math.random() - 0.5) * 0.03;

    histAcc += dt;
    if (histAcc > 0.35) {
      histAcc = 0;
      sim.history.push({ c: sim.cold, f: sim.freeze });
      if (sim.history.length > 120) sim.history.shift();
      if (currentSection === "frio") {
        drawChart();
        locker.setScreen(sim.power ? "temps" : "alert",
          { cold: sim.cold, freeze: sim.freeze, msg: "Corte de energía · UPS en operación" });
      }
    }

    var rc = $("#ro-cold"), rf = $("#ro-freeze"), rs = $("#ro-status"), rp = $("#ro-power");
    if (rc) {
      rc.textContent = sim.cold.toFixed(1) + "°";
      rc.className = "rv " + (sim.cold >= 0 && sim.cold <= 5 ? "cold" : "warn");
    }
    if (rf) {
      rf.textContent = sim.freeze.toFixed(1) + "°";
      rf.className = "rv " + (sim.freeze >= -20 && sim.freeze <= -16 ? "freeze" : "warn");
    }
    if (rs) {
      rs.textContent = sim.status;
      rs.className = "rv " + (sim.status === "Nominal" ? "ok" : sim.status === "UPS activo" ? "danger" : "warn");
    }
    if (rp) {
      rp.textContent = sim.power ? "Red" : "UPS";
      rp.className = "rv " + (sim.power ? "ok" : "danger");
    }

    /* vencimiento del código de retiro */
    if (currentSection === "acceso") {
      expAcc += dt;
      if (expAcc >= 1) {
        expAcc = 0;
        if (access.expires > 0) {
          access.expires--;
          var ex = $("#acc-expiry");
          if (ex) {
            ex.textContent = access.expires > 0 ? access.expires + " s" : "VENCIDO";
            ex.style.color = access.expires === 0 ? "var(--danger)"
              : access.expires <= 15 ? "var(--warn)" : "var(--text-2)";
          }
        }
      }
    }
  }

  /* ====================================================== plano de sitio === */

  function drawSitePlan() {
    var cv = $("#site-plan");
    if (!cv) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth || 340, hh = 208;
    cv.width = w * dpr; cv.height = hh * dpr;
    var c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    c.fillStyle = "#0a121b"; c.fillRect(0, 0, w, hh);
    c.strokeStyle = "rgba(120,178,214,0.09)"; c.lineWidth = 1;
    for (var gx = 0; gx < w; gx += 20) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, hh); c.stroke(); }
    for (var gy = 0; gy < hh; gy += 20) { c.beginPath(); c.moveTo(0, gy); c.lineTo(w, gy); c.stroke(); }

    var cx = w / 2, uw = 132, ud = 56;
    var uy = 108;

    /* muro */
    c.fillStyle = "#1b2c3d";
    c.fillRect(cx - 118, uy - 66, 236, 12);
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.font = "600 8px ui-monospace, monospace";
    c.fillText("MURO / FACHADA DEL ALIADO", cx - 112, uy - 70);

    /* holgura trasera */
    c.fillStyle = "rgba(245,165,36,0.13)";
    c.fillRect(cx - uw / 2, uy - 54, uw, 26);
    c.strokeStyle = "rgba(245,165,36,0.55)"; c.setLineDash([4, 3]);
    c.strokeRect(cx - uw / 2, uy - 54, uw, 26); c.setLineDash([]);
    c.fillStyle = "#f5a524"; c.font = "600 8px ui-monospace, monospace";
    c.textAlign = "center"; c.fillText("40 cm ventilación", cx, uy - 38);

    /* unidad */
    c.fillStyle = "#16222f";
    c.fillRect(cx - uw / 2, uy - 28, uw, ud);
    c.strokeStyle = "#35c8e8"; c.lineWidth = 2;
    c.strokeRect(cx - uw / 2, uy - 28, uw, ud);
    c.fillStyle = "#35c8e8"; c.font = "700 9px Segoe UI, sans-serif";
    c.fillText("FRIOBOX FBX-S1", cx, uy + 2);
    c.fillStyle = "rgba(255,255,255,0.5)"; c.font = "600 8px ui-monospace, monospace";
    c.fillText("1.86 m × 0.80 m", cx, uy + 16);

    /* zona de maniobra frontal */
    c.fillStyle = "rgba(53,200,232,0.1)";
    c.fillRect(cx - uw / 2 - 14, uy + 28, uw + 28, 42);
    c.strokeStyle = "rgba(53,200,232,0.5)"; c.setLineDash([4, 3]); c.lineWidth = 1;
    c.strokeRect(cx - uw / 2 - 14, uy + 28, uw + 28, 42); c.setLineDash([]);
    c.fillStyle = "#35c8e8"; c.font = "600 8px ui-monospace, monospace";
    c.fillText("ZONA DE MANIOBRA · 120 cm libres", cx, uy + 53);

    /* bolardos */
    [-1, 1].forEach(function (s) {
      c.fillStyle = "#f5c33b";
      c.beginPath(); c.arc(cx + s * 46, uy + 40, 5, 0, 6.3); c.fill();
    });
    c.fillStyle = "rgba(255,255,255,0.4)"; c.font = "600 7.5px ui-monospace, monospace";
    c.textAlign = "left";
    c.fillText("● bolardos de protección", 10, hh - 22);

    /* acometida */
    c.strokeStyle = "#2fd39a"; c.lineWidth = 1.6; c.setLineDash([5, 3]);
    c.beginPath(); c.moveTo(cx + uw / 2, uy - 16); c.lineTo(cx + 108, uy - 16); c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#2fd39a"; c.font = "600 7.5px ui-monospace, monospace";
    c.fillText("acometida 220 V + red", cx + 34, uy - 22);

    /* flujo peatonal */
    c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(20, hh - 12); c.lineTo(w - 20, hh - 12); c.stroke();
    [w - 26, w - 34].forEach(function (ax) {
      c.beginPath(); c.moveTo(ax, hh - 16); c.lineTo(w - 20, hh - 12); c.lineTo(ax, hh - 8); c.stroke();
    });
    c.fillStyle = "rgba(255,255,255,0.4)";
    c.textAlign = "right"; c.fillText("flujo peatonal", w - 44, hh - 18);
  }

  /* ========================================================== secciones === */

  var SECTIONS = {
    panorama: {
      title: "Panorama del producto",
      eyebrow: "FrioBox · Estación FBX-S1",
      chips: null,
      enter: function () {
        setEnvironment("estudio");
        locker.setXray(false);
        locker.closeAll();
        locker.setScreen("idle", { cold: sim.cold, freeze: sim.freeze });
        flyTo([3.0, 2.1, 4.2], [0, 1.15, 0], 1.4);
        autoRotate = true;
      },
      exit: function () { autoRotate = false; }
    },

    vista360: {
      title: "Vista 360° y anatomía",
      eyebrow: "Ingeniería del equipo",
      enter: function () {
        setEnvironment("estudio");
        locker.closeAll();
        locker.setScreen("idle", { cold: sim.cold, freeze: sim.freeze });
        flyTo([2.6, 1.85, 3.5], [0, 1.15, 0], 1.1);
        setAngle("tresq");
      },
      exit: function () {
        locker.setXray(false);
        locker.setAir(false);
        locker.closeAll();
        autoRotate = false;
        ["tg-xray", "tg-air", "tg-doors", "tg-rotate"].forEach(function (id) {
          $("#" + id).classList.remove("on");
        });
      }
    },

    entrega: {
      title: "Entrega: del aliado al casillero",
      eyebrow: "Flujograma productivo",
      enter: function () {
        setEnvironment("gasolinera");
        locker.setXray(false);
        gotoStep(0);
      },
      exit: function () {
        stopAuto();
        locker.closeAll();
        locker.setXray(false);
      }
    },

    acceso: {
      title: "Acceso con QR y PIN",
      eyebrow: "Seguridad de retiro",
      enter: function () {
        setEnvironment("gasolinera");
        locker.setXray(false);
        locker.closeAll();
        newCode();
        setAccessMode(access.mode);
        flyTo([0.55, 1.55, 1.5], [0, 1.4, 0.3], 1.2);
      },
      exit: function () { locker.closeAll(); }
    },

    frio: {
      title: "Cadena de frío y monitoreo",
      eyebrow: "Control térmico dual",
      enter: function () {
        setEnvironment("estudio");
        locker.closeAll();
        locker.setXray(true);
        locker.setScreen("temps", { cold: sim.cold, freeze: sim.freeze });
        flyTo([1.9, 1.5, 2.25], [0.2, 1.18, 0], 1.2);
        resizeChart();
        frioAlert("ok", "Sistema en rango",
          "Las dos zonas operan dentro de su banda objetivo. Cada casillero reporta su propia lectura a la nube cada 60 segundos.");
      },
      exit: function () {
        locker.setXray(false);
        sim.power = true; sim.ups = false; sim.status = "Nominal"; sim.doorEvent = 0;
      }
    },

    instalacion: {
      title: "Instalación en punto de servicio",
      eyebrow: "Ubicaciones estratégicas",
      enter: function () {
        var m = setEnvironment("gasolinera");
        locker.setXray(false);
        locker.closeAll();
        locker.setScreen("idle", { cold: sim.cold, freeze: sim.freeze });
        flyTo(m.camera.pos, m.camera.target, 1.3);
        $$("#env-chips .chip").forEach(function (c) { c.classList.toggle("is-active", c.dataset.env === "gasolinera"); });
        drawSitePlan();
      },
      exit: function () {}
    },

    proyecto: {
      title: "Ficha del proyecto",
      eyebrow: "Grupo 2 · UJCV",
      enter: function () {
        setEnvironment("estudio");
        locker.setXray(false);
        locker.closeAll();
        locker.setScreen("idle", { cold: sim.cold, freeze: sim.freeze });
        flyTo([2.2, 1.7, 3.2], [0, 1.15, 0], 1.2);
        autoRotate = true;
      },
      exit: function () { autoRotate = false; }
    }
  };

  function showSection(name) {
    if (!SECTIONS[name]) return;
    if (SECTIONS[currentSection] && SECTIONS[currentSection].exit) SECTIONS[currentSection].exit();
    currentSection = name;
    if (location.hash.slice(1) !== name) {
      try { history.replaceState(null, "", "#" + name); } catch (e) { location.hash = name; }
    }

    $$(".nav-btn").forEach(function (b) { b.classList.toggle("is-active", b.dataset.section === name); });
    $$(".panel-view").forEach(function (v) { v.classList.toggle("is-active", v.dataset.section === name); });
    $$("[data-chips]").forEach(function (v) { v.style.display = v.dataset.chips === name ? "flex" : "none"; });

    var s = SECTIONS[name];
    $("#stage-eyebrow").textContent = s.eyebrow;
    $("#stage-h").textContent = s.title;
    showHotspotClear();
    locker.resetContents();
    locker.doors.forEach(function (d) {
      locker.setDoorState(d.code, locker.occupied.indexOf(d.code) >= 0 ? "occupied" : "free");
    });
    s.enter();
    paintIcons();
  }

  function showHotspotClear() {
    hotspotEls.forEach(function (o) { o.el.classList.remove("is-open"); });
    var box = $("#hs-detail");
    if (box) box.innerHTML =
      '<div class="card"><div class="card-h"><span class="ico">' + iconSvg("target") +
      '</span>Explore los puntos calientes</div><p class="card-b">Active «Puntos de interés» y toque cualquier marcador ' +
      "sobre el equipo para ver el detalle técnico de ese componente.</p></div>";
  }

  /* ================================================== ángulos y toggles === */

  var ANGLES = {
    frontal: { pos: [0, 1.3, 3.6], target: [0, 1.2, 0] },
    tresq: { pos: [2.6, 1.85, 3.4], target: [0, 1.15, 0] },
    lateral: { pos: [4.0, 1.35, 0.2], target: [0, 1.15, 0] },
    posterior: { pos: [-1.4, 1.7, -3.4], target: [0, 1.2, -0.1] },
    superior: { pos: [1.2, 4.6, 2.2], target: [0, 1.1, 0] },
    kiosco: { pos: [0.15, 1.62, 1.25], target: [0, 1.45, 0.3] },
    zocalo: { pos: [1.1, 0.45, 1.9], target: [0.2, 0.35, 0] }
  };

  function setAngle(key) {
    var a = ANGLES[key];
    if (!a) return;
    flyTo(a.pos, a.target, 1.05);
    $$("#angle-chips .chip").forEach(function (c) { c.classList.toggle("is-active", c.dataset.angle === key); });
  }

  var INST_VIEWS = {
    peaton: { pos: [2.1, 1.6, 3.0], target: [0, 1.2, 0.1] },
    vehicular: { pos: [7.5, 2.4, 8.5], target: [1, 1.4, 1.5] },
    aerea: { pos: [5.5, 7.5, 8.0], target: [1, 1.0, 2.0] },
    contexto: { pos: [-6.5, 2.6, 6.5], target: [0.5, 1.3, 0.5] }
  };

  function toggleSwitch(el, fn) {
    el.addEventListener("click", function () {
      el.classList.toggle("on");
      fn(el.classList.contains("on"));
    });
  }

  /* ============================================================== tabla === */

  function renderDoorTable() {
    var tb = $("#door-table tbody");
    if (!tb) return;
    tb.innerHTML = "";
    locker.doors.slice().sort(function (a, b) {
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    }).forEach(function (d) {
      var wcm = Math.round((M.DIM.colW - M.DIM.stile * 2 - 0.07) * 100);
      var hcm = Math.round((d.h - 0.03) * 100);
      var dcm = Math.round((M.DIM.D - 0.14) * 100);
      var liters = Math.round((wcm * hcm * dcm) / 1000);
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + d.code + "</td>" +
        '<td><span class="tag ' + (d.zone.key === "cold" ? "cold" : "freeze") + '">' + d.zone.temp + "</span></td>" +
        "<td>" + wcm + "×" + hcm + "×" + dcm + "</td>" +
        "<td>" + liters + " L</td>";
      tr.style.cursor = "pointer";
      tr.addEventListener("click", function () {
        locker.closeAll();
        locker.openDoor(d.code, 105);
        locker.setDoorState(d.code, "open");
        locker.setScreen("open", { door: d.code, count: 30, cold: sim.cold, freeze: sim.freeze });
        flyTo([d.x + 1.25, d.y + 0.15, 1.85], [d.x + 0.15, d.y, 0.2], 0.95);
        setTimeout(function () {
          locker.closeDoor(d.code);
          locker.setDoorState(d.code, "free");
        }, 3600);
      });
      tb.appendChild(tr);
    });
  }

  /* =============================================================== loop === */

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    if (tween) {
      tween.t += dt / tween.dur;
      var k = ease(Math.min(1, tween.t));
      camera.position.lerpVectors(tween.p0, tween.p1, k);
      controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (tween.t >= 1) tween = null;
    } else if (autoRotate) {
      var r = Math.sqrt(camera.position.x * camera.position.x + camera.position.z * camera.position.z);
      var a = Math.atan2(camera.position.z, camera.position.x) + dt * 0.075;
      camera.position.x = Math.cos(a) * r;
      camera.position.z = Math.sin(a) * r;
    }

    controls.update();
    locker.update(dt, t);
    updateSim(dt);

    /* efecto de escaneo */
    if (scanState.dur > 0) {
      scanState.t += dt;
      var pr = scanState.t / scanState.dur;
      if (pr >= 1) {
        scanState.dur = 0;
        locker.scanBeamMat.opacity = 0;
        locker.scanLight.intensity = 0;
        locker.scanGlowMat.emissive.set(scanState.fail ? "#f4526b" : "#2fd39a");
      } else {
        locker.scanBeamMat.opacity = 0.55 + Math.sin(t * 22) * 0.25;
        locker.scanBeam.position.y = 1.325 + ((t * 0.55) % 0.09);
        locker.scanLight.intensity = 0.7;
        locker.scanGlowMat.emissive.set("#35c8e8");
        scanPaintAcc += dt;
        if (scanPaintAcc > 0.1) {
          scanPaintAcc = 0;
          locker.setScreen("scan", { t: t * 0.9, cold: sim.cold, freeze: sim.freeze });
        }
      }
    }

    /* latido del LED de la cámara */
    locker.signLight.intensity = 0.62 + Math.sin(t * 1.6) * 0.06;

    updateHotspots();
    renderer.render(scene, camera);
  }

  /* =============================================================== init === */

  function bind() {
    $$(".nav-btn").forEach(function (b) {
      b.addEventListener("click", function () { showSection(b.dataset.section); });
    });

    $$("#angle-chips .chip").forEach(function (c) {
      c.addEventListener("click", function () { setAngle(c.dataset.angle); });
    });

    $$("#env-chips .chip").forEach(function (c) {
      c.addEventListener("click", function () {
        var m = setEnvironment(c.dataset.env);
        flyTo(m.camera.pos, m.camera.target, 1.2);
        $$("#env-chips .chip").forEach(function (o) { o.classList.toggle("is-active", o === c); });
      });
    });

    $$("#inst-chips .chip").forEach(function (c) {
      c.addEventListener("click", function () {
        var v = INST_VIEWS[c.dataset.view];
        if (v) flyTo(v.pos, v.target, 1.2);
        $$("#inst-chips .chip").forEach(function (o) { o.classList.toggle("is-active", o === c); });
      });
    });

    toggleSwitch($("#tg-xray"), function (on) { locker.setXray(on); });
    toggleSwitch($("#tg-air"), function (on) { locker.setAir(on); });
    toggleSwitch($("#tg-hotspots"), function () {});
    toggleSwitch($("#tg-doors"), function (on) {
      if (on) {
        locker.doors.forEach(function (d, i) {
          setTimeout(function () { locker.openDoor(d.code, 82); }, i * 90);
        });
      } else locker.closeAll();
    });
    toggleSwitch($("#tg-rotate"), function (on) { autoRotate = on; });

    $("#flow-prev").addEventListener("click", function () { stopAuto(); gotoStep(flowStep - 1); });
    $("#flow-next").addEventListener("click", function () { stopAuto(); gotoStep(flowStep + 1); });
    $("#flow-auto").addEventListener("click", toggleAuto);

    $$("#acc-mode .chip").forEach(function (c) {
      c.addEventListener("click", function () { setAccessMode(c.dataset.mode); });
    });
    $("#acc-scan").addEventListener("click", doScan);
    $("#acc-fail").addEventListener("click", doScanFail);
    $("#acc-new").addEventListener("click", function () { newCode(); accMsg("scan", "Código nuevo generado. El anterior quedó inválido."); });

    var kp = $("#keypad");
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"].forEach(function (k) {
      var b = document.createElement("button");
      b.className = "key" + (k === "C" || k === "<" ? " fn" : "");
      b.textContent = k === "<" ? "BORR" : k === "C" ? "LIMP" : k;
      b.addEventListener("click", function () { pressKey(k); });
      kp.appendChild(b);
    });

    $("#frio-door").addEventListener("click", simOpenDoor);
    $("#frio-power").addEventListener("click", function () {
      if (sim.power) simPowerLoss(); else restorePower();
    });
    $("#frio-reset").addEventListener("click", function () {
      sim.power = true; sim.ups = false; sim.doorEvent = 0; sim.status = "Nominal";
      sim.cold = 3.4; sim.freeze = -18.2;
      locker.closeAll();
      locker.setDoorState("C3", "occupied");
      locker.setScreen("temps", { cold: sim.cold, freeze: sim.freeze });
      frioAlert("ok", "Simulación reiniciada", "Ambas zonas vuelven a su punto de consigna.");
    });

    $("#scene-canvas").addEventListener("pointerdown", function () {
      if (currentSection === "panorama" || currentSection === "proyecto") autoRotate = false;
      if (currentSection === "vista360") {
        var sw = $("#tg-rotate");
        if (sw.classList.contains("on")) { sw.classList.remove("on"); autoRotate = false; }
      }
      tween = null;
    });

    window.addEventListener("keydown", function (e) {
      if (currentSection !== "entrega") return;
      if (e.key === "ArrowRight") { stopAuto(); gotoStep(flowStep + 1); }
      if (e.key === "ArrowLeft") { stopAuto(); gotoStep(flowStep - 1); }
    });
  }

  function init() {
    initViewer();
    buildHotspots();
    renderFlowList();
    renderDoorTable();
    bind();
    paintIcons();
    newCode();
    var start = location.hash.slice(1);
    showSection(SECTIONS[start] ? start : "panorama");
    window.addEventListener("hashchange", function () {
      var h = location.hash.slice(1);
      if (SECTIONS[h] && h !== currentSection) showSection(h);
    });
    animate();
    setTimeout(function () { $("#loader").classList.add("hide"); }, 420);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else init();
})();
