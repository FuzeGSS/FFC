// © 2026 Duysens Florent – All rights reserved
// -------------------------------
//   CONSTANTES & OUTILS
// -------------------------------
const R = 6371000;

function toRad(v) { return v * Math.PI / 180; }
function toDeg(v) { return v * 180 / Math.PI; }

// Distance Haversine (mode réel)
function haversine(p1, p2) {
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lon - p1.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Azimut vrai en millièmes OTAN (mode réel)
function bearingMils(p1, p2) {
  const φ1 = toRad(p1.lat);
  const φ2 = toRad(p2.lat);
  const Δλ = toRad(p2.lon - p1.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let brngDeg = toDeg(Math.atan2(y, x));
  if (brngDeg < 0) brngDeg += 360;
  return (brngDeg * 6400 / 360) % 6400;
}

// Convergence de grille (γ)
function gridConvergence(lat, lon) {
  const zone = Math.floor((lon + 180) / 6) + 1;
  const lambda0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const phi = lat * Math.PI / 180;
  const lambda = lon * Math.PI / 180;
  const gamma = Math.atan(Math.tan(lambda - lambda0) * Math.sin(phi));
  return gamma * 180 / Math.PI;
}

// Back-azimut
function backAzimuth(az) {
  return (az + 3200) % 6400;
}

// Valeur Sight = Direction Mortier − DirS (direction des jalons de référence)
// DirS = 0000 par défaut → Valeur Sight = Direction (cas sans jalons orientés)
function getSightValue(dirMor) {
  const el = document.getElementById("dirS");
  const dirS = el ? (parseFloat(el.value) || 0) : 0;
  return (dirMor - dirS + 6400) % 6400;
}

// Formater millièmes sur 4 chiffres
function fmtMils(v) {
  return String(Math.round(v)).padStart(4, '0');
}

// -------------------------------
//   VALIDATION MGRS
// -------------------------------
function isMGRSValid(str) {
  if (!str || str.trim() === "") return false;
  try {
    const pt = mgrs.toPoint(str.trim());
    return Array.isArray(pt) && pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]);
  } catch {
    return false;
  }
}

function validateInput(id, value) {
  const el = document.getElementById(id);
  const valid = isMGRSValid(value);
  el.classList.toggle("input-error", !valid && value.trim() !== "");
  el.classList.toggle("input-ok", valid);
  return valid;
}

// -------------------------------
//   MODE PLAN LOCAL ÉCOLE (Δx/Δy)
// -------------------------------
function mgrsToXY(mgrsStr) {
  const clean = mgrsStr.replace(/\s+/g, "").toUpperCase();
  const grid = clean.slice(5);
  const x = parseInt(grid.slice(0, 5), 10);
  const y = parseInt(grid.slice(5, 10), 10);
  return { x, y };
}

function schoolDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// BUG FIX : utilisation de atan2 pour éviter division par zéro
function schoolAzimuthMils(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  // atan2(dx, dy) = azimut depuis le nord, sens horaire
  let angleDeg = toDeg(Math.atan2(dx, dy));
  if (angleDeg < 0) angleDeg += 360;
  return Math.round(angleDeg * 6400 / 360);
}

// -------------------------------
//   HISTORIQUE
// -------------------------------
const MAX_HISTORY = 8;
let history = JSON.parse(localStorage.getItem("ffc_history") || "[]");

function saveHistory(entry) {
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  localStorage.setItem("ffc_history", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById("history-list");
  if (!container) return;
  if (history.length === 0) {
    container.innerHTML = '<p class="no-history">Aucun calcul enregistré</p>';
    return;
  }
  container.innerHTML = history.map((h, i) => `
    <div class="history-item" onclick="restoreHistory(${i})">
      <div class="history-row">
        <span class="history-label">Posn</span>
        <span class="history-val">${h.posn}</span>
      </div>
      <div class="history-row">
        <span class="history-label">Obj</span>
        <span class="history-val">${h.obj}</span>
      </div>
      <div class="history-result">
        <span>📏 ${h.dist} m</span>
        <span>🧭 ${h.az} mills</span>
      </div>
      <div class="history-time">${h.time}</div>
    </div>
  `).join("");
}

function restoreHistory(i) {
  const h = history[i];
  if (!h) return;
  document.getElementById("posn_mor").value = h.posn;
  document.getElementById("obj_main").value = h.obj;
  document.getElementById("obj_oa").value = h.obj;
  showToast("Calcul restauré ✓");
  // Scroll vers le haut
  document.querySelector("section").scrollIntoView({ behavior: "smooth" });
}

function clearHistory() {
  history = [];
  localStorage.removeItem("ffc_history");
  renderHistory();
  showToast("Historique effacé");
}

// -------------------------------
//   TOAST
// -------------------------------
function showToast(msg, type = "info") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// -------------------------------
//   CARTE LEAFLET
// -------------------------------
let map;
let markerPosnMor = null;
let markerObj = null;
let markerOA = null;
let markerObjCorr = null;
let markerGPS = null;
let lineLayer = null;

function initMap() {
  map = L.map('map').setView([50.85, 4.35], 6);
  L.tileLayer('tiles/{z}/{x}/{y}.png', {
    maxZoom: 12,
    minZoom: 4
  }).addTo(map);
}

// -------------------------------
//   MARQUEURS
// -------------------------------
const MARKER_COLORS = {
  posn: "#1e90ff",
  obj: "#ff4444",
  oa: "#ffaa00",
  obj_corr: "#00ff88",
  gps: "#00ccff"
};

function createIcon(color, label) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      color:#fff;
      font-size:11px;
      font-weight:bold;
      padding:3px 6px;
      border-radius:4px;
      white-space:nowrap;
      box-shadow:0 2px 6px rgba(0,0,0,0.5);
      border:1px solid rgba(255,255,255,0.3);
    ">${label}</div>`,
    iconAnchor: [0, 0]
  });
}

function placeMarker(lat, lon, type) {
  if (!map) return;
  const labels = { posn: "Posn Mor", obj: "Obj", oa: "OA", obj_corr: "Obj corrigée", gps: "GPS" };
  const refs = { posn: "markerPosnMor", obj: "markerObj", oa: "markerOA", obj_corr: "markerObjCorr", gps: "markerGPS" };

  const ref = refs[type];
  if (!ref) return;
  if (window[ref]) map.removeLayer(window[ref]);

  window[ref] = L.marker([lat, lon], {
    icon: createIcon(MARKER_COLORS[type] || "#fff", labels[type])
  }).addTo(map).bindPopup(`<b>${labels[type]}</b><br>${lat.toFixed(5)}, ${lon.toFixed(5)}`);
}

function drawLine(p1, p2) {
  if (!map) return;
  if (lineLayer) map.removeLayer(lineLayer);
  lineLayer = L.polyline([
    [p1.lat, p1.lon],
    [p2.lat, p2.lon]
  ], { color: "#ff4444", weight: 2, dashArray: "6 4", opacity: 0.8 }).addTo(map);

  const bounds = L.latLngBounds([[p1.lat, p1.lon], [p2.lat, p2.lon]]);
  map.fitBounds(bounds, { padding: [40, 40] });
}

// -------------------------------
//   GPS → Posn Mor
// -------------------------------
function useGPS() {
  const btn = document.querySelector("button[onclick='useGPS()']");
  if (btn) btn.textContent = "…";

  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    const mgrsCoord = mgrs.forward([longitude, latitude], 5);
    document.getElementById("posn_mor").value = mgrsCoord;
    validateInput("posn_mor", mgrsCoord);
    placeMarker(latitude, longitude, "gps");
    map.setView([latitude, longitude], 10);
    showToast("Position GPS acquise ✓", "success");
    if (btn) btn.textContent = "GPS";
  }, () => {
    showToast("GPS non disponible", "error");
    if (btn) btn.textContent = "GPS";
  }, { enableHighAccuracy: true, timeout: 10000 });
}

// -------------------------------
//   SYNCHRONISATION OBJ
// -------------------------------
let syncLock = false;

function syncObjFields(src) {
  if (syncLock) return;
  syncLock = true;
  const main = document.getElementById("obj_main");
  const oa = document.getElementById("obj_oa");
  if (src === "main") oa.value = main.value;
  if (src === "oa") main.value = oa.value;
  syncLock = false;
}

// -------------------------------
//   CALCUL POSN MOR → OBJ
// -------------------------------
function compute() {
  const posn = document.getElementById("posn_mor").value.trim();
  const obj = document.getElementById("obj_main").value.trim();
  const type = document.getElementById("azimutType").value;
  const modeOA = document.getElementById("oaMode").value;

  const error = document.getElementById("error");
  const result = document.getElementById("result");

  error.textContent = "";
  result.innerHTML = "";

  // Validation
  if (!posn || !obj) {
    error.textContent = "Veuillez renseigner Posn Mor et Obj.";
    return;
  }

  try {
    if (modeOA === "flat") {
      // MODE ÉCOLE : Δx / Δy
      const P1 = mgrsToXY(posn);
      const P2 = mgrsToXY(obj);

      if (isNaN(P1.x) || isNaN(P1.y) || isNaN(P2.x) || isNaN(P2.y)) {
        throw new Error("MGRS invalide pour mode école");
      }

      const d = Math.round(schoolDistance(P1, P2));
      const az = schoolAzimuthMils(P1, P2);
      const sightVal = getSightValue(az);

      result.innerHTML = buildResultHTML({
        dist: d, az: fmtMils(az), sightVal: fmtMils(sightVal), mode: "Plan local"
      });

      try {
        const p1geo = mgrs.toPoint(posn);
        const p2geo = mgrs.toPoint(obj);
        placeMarker(p1geo[1], p1geo[0], "posn");
        placeMarker(p2geo[1], p2geo[0], "obj");
        drawLine({ lat: p1geo[1], lon: p1geo[0] }, { lat: p2geo[1], lon: p2geo[0] });
      } catch {}

      saveHistory({ posn, obj, dist: d, az: fmtMils(az), time: nowStr() });
      return;
    }

    // MODE RÉEL
    if (!isMGRSValid(posn) || !isMGRSValid(obj)) {
      throw new Error("Coordonnées MGRS invalides");
    }

    const p1 = mgrs.toPoint(posn);
    const p2 = mgrs.toPoint(obj);
    const P1 = { lat: p1[1], lon: p1[0] };
    const P2 = { lat: p2[1], lon: p2[0] };

    const d = Math.round(haversine(P1, P2));
    const azVrai = bearingMils(P1, P2);
    let azFinal = azVrai;

    if (type === "grille") {
      const gammaDeg = gridConvergence(P1.lat, P1.lon);
      const gammaMils = gammaDeg * 6400 / 360;
      azFinal = (azVrai - gammaMils + 6400) % 6400;
    }

    const sightVal = getSightValue(azFinal);

    result.innerHTML = buildResultHTML({
      dist: d, az: fmtMils(azFinal), sightVal: fmtMils(sightVal),
      mode: type === "grille" ? "Azimut quadrillage" : "Azimut vrai"
    });

    placeMarker(P1.lat, P1.lon, "posn");
    placeMarker(P2.lat, P2.lon, "obj");
    drawLine(P1, P2);
    saveHistory({ posn, obj, dist: d, az: fmtMils(azFinal), time: nowStr() });

  } catch (e) {
    error.textContent = e.message || "Coordonnées MGRS invalides";
  }
}

function buildResultHTML({ dist, az, sightVal, mode }) {
  return `
    <div class="result-grid">
      <div class="result-card">
        <div class="result-icon">📏</div>
        <div class="result-label">Distance</div>
        <div class="result-value">${dist} <span class="unit">m</span></div>
      </div>
      <div class="result-card">
        <div class="result-icon">🧭</div>
        <div class="result-label">Direction</div>
        <div class="result-value">${az} <span class="unit">mills</span></div>
      </div>
      <div class="result-card">
        <div class="result-icon">🎯</div>
        <div class="result-label">Val. Sight</div>
        <div class="result-value sight-value">${sightVal} <span class="unit">mills</span></div>
      </div>
    </div>
    <div class="result-mode">${mode}</div>
    <button class="copy-btn" onclick="copyResult()">📋 Copier</button>
  `;
}

function copyResult() {
  const text = document.getElementById("result").innerText
    .replace(/📏|🧭|↩️/g, "").replace(/\n+/g, " | ").trim();
  navigator.clipboard.writeText(text).then(() => showToast("Copié ✓", "success"));
}

function nowStr() {
  return new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
}

// -------------------------------
//   OA : CORRECTION SUCCESSIVE
// -------------------------------
let latSign = 1;
let rangeSign = 1;

function setLatSign(sign) {
  latSign = sign;
  document.getElementById("btnG").classList.toggle("active", sign === -1);
  document.getElementById("btnD").classList.toggle("active", sign === 1);
}

function setRangeSign(sign) {
  rangeSign = sign;
  document.getElementById("btnLoin").classList.toggle("active", sign === 1);
  document.getElementById("btnPres").classList.toggle("active", sign === -1);
}

function applyOACorrection() {
  const modeOA = document.getElementById("oaMode").value;

  // BUG FIX : vérification du mode
  if (modeOA === "flat") {
    showToast("Correction OA uniquement en mode réel", "error");
    document.getElementById("oa_result").innerHTML =
      '<p class="warn">⚠️ Passez en mode réel pour utiliser la correction OA.</p>';
    return;
  }

  const oaMgrs = document.getElementById("oa_mgrs").value.trim();
  const oaAzStr = document.getElementById("oa_azimut").value.trim();
  const objStr = document.getElementById("obj_oa").value.trim();
  const latCorrStr = document.getElementById("oa_lat").value.trim();
  const rangeCorrStr = document.getElementById("oa_range").value.trim();
  const posnMorStr = document.getElementById("posn_mor").value.trim();

  const out = document.getElementById("oa_result");
  const error = document.getElementById("error");
  out.innerHTML = "";
  error.textContent = "";

  // Validation des champs requis
  if (!oaMgrs || !oaAzStr || !objStr || !posnMorStr) {
    error.textContent = "Renseignez OA, Azimut OA, Obj et Posn Mor.";
    return;
  }

  if (!isMGRSValid(oaMgrs) || !isMGRSValid(objStr) || !isMGRSValid(posnMorStr)) {
    error.textContent = "Coordonnées MGRS invalides.";
    return;
  }

  try {
    const azMilsGrille = parseFloat(oaAzStr);
    if (isNaN(azMilsGrille)) throw new Error("Azimut OA invalide");

    const latCorr = latSign * parseFloat(latCorrStr || "0");
    const rangeCorr = rangeSign * parseFloat(rangeCorrStr || "0");

    const oaPoint = mgrs.toPoint(oaMgrs);
    const objPoint = mgrs.toPoint(objStr);
    const posnPoint = mgrs.toPoint(posnMorStr);

    const OA   = { lat: oaPoint[1],   lon: oaPoint[0] };
    const OBJ  = { lat: objPoint[1],  lon: objPoint[0] };
    const POSN = { lat: posnPoint[1], lon: posnPoint[0] };

    // ─── CORRECTION 1 ───────────────────────────────────────────────────────
    // L'azimut OA est saisi en QUADRILLAGE (comme sur une planchette).
    // bearingMils() travaille en azimut VRAI.
    // Il faut convertir l'azimut quadrillage → vrai AVANT le calcul géométrique.
    // Az_vrai = Az_quadrillage + γ  (γ = convergence de grille, positive à l'est du méridien)
    const gammaDeg_OA  = gridConvergence(OA.lat, OA.lon);
    const gammaMils_OA = gammaDeg_OA * 6400 / 360;
    const azMilsVrai   = (azMilsGrille + gammaMils_OA + 6400) % 6400;
    const azRad        = azMilsVrai * 2 * Math.PI / 6400;
    // ────────────────────────────────────────────────────────────────────────

    // ─── CORRECTIONS SUCCESSIVES ────────────────────────────────────────────
    // On applique les corrections comme des DELTAS depuis la position OBJ actuelle.
    // Correction range  : déplacement dans l'axe OA  (+ loin / + près)
    // Correction latérale : déplacement perpendiculaire à l'axe OA (G / D)
    // L'axe de référence reste toujours l'azimut de vue de l'OA (fixe).
    // Ainsi chaque appui applique une correction indépendante sur la position courante.

    const phi0   = toRad(OA.lat);

    // Vecteur unitaire "avant" dans l'axe OA (Nord/Est)
    const uN_range =  Math.cos(azRad);   // composante Nord du range
    const uE_range =  Math.sin(azRad);   // composante Est  du range
    // Vecteur unitaire "droite" (perpendiculaire, sens horaire)
    const uN_lat   = -Math.sin(azRad);   // composante Nord du latéral
    const uE_lat   =  Math.cos(azRad);   // composante Est  du latéral

    // On déplace l'OBJ ACTUELLE (pas depuis OA) par les deltas
    const dNorth = rangeCorr * uN_range + latCorr * uN_lat;
    const dEast  = rangeCorr * uE_range + latCorr * uE_lat;

    const latNew = OBJ.lat + toDeg(dNorth / R);
    const lonNew = OBJ.lon + toDeg(dEast  / (R * Math.cos(toRad(OBJ.lat))));
    // ────────────────────────────────────────────────────────────────────────

    const mgrsNew = mgrs.forward([lonNew, latNew], 5);

    document.getElementById("obj_main").value = mgrsNew;
    document.getElementById("obj_oa").value   = mgrsNew;

    const P2 = { lat: latNew, lon: lonNew };
    const dFinal    = Math.round(haversine(POSN, P2));

    // ─── CORRECTION 2 ───────────────────────────────────────────────────────
    // bearingMils() retourne un azimut VRAI.
    // Le résultat doit être en QUADRILLAGE pour être cohérent avec la section
    // Posn→Obj et utilisable directement sur la planchette mortier.
    // Az_quadrillage = Az_vrai − γ  (depuis la position du mortier)
    const azVraiPosn   = bearingMils(POSN, P2);
    const gammaDeg_P   = gridConvergence(POSN.lat, POSN.lon);
    const gammaMils_P  = gammaDeg_P * 6400 / 360;
    const azFinalGrille = (azVraiPosn - gammaMils_P + 6400) % 6400;
    // ────────────────────────────────────────────────────────────────────────

    const azFinal   = Math.round(azFinalGrille);
    const sightVal   = getSightValue(azFinal);

    out.innerHTML = `
      <div class="oa-new-obj">📍 Nouvelle Obj : <strong>${mgrsNew}</strong></div>
      <div class="result-grid">
        <div class="result-card">
          <div class="result-icon">📏</div>
          <div class="result-label">Distance</div>
          <div class="result-value">${dFinal} <span class="unit">m</span></div>
        </div>
        <div class="result-card">
          <div class="result-icon">🧭</div>
          <div class="result-label">Direction</div>
          <div class="result-value">${fmtMils(azFinal)} <span class="unit">mills</span></div>
        </div>
        <div class="result-card">
          <div class="result-icon">🎯</div>
          <div class="result-label">Val. Sight</div>
          <div class="result-value sight-value">${fmtMils(sightVal)} <span class="unit">mills</span></div>
        </div>
      </div>
      <button class="copy-btn" onclick="copyOAResult()">📋 Copier</button>
    `;

    placeMarker(OA.lat, OA.lon, "oa");
    placeMarker(latNew, lonNew, "obj_corr");
    drawLine(POSN, P2);

    showToast("Correction appliquée ✓", "success");

  } catch (e) {
    error.textContent = e.message || "Erreur dans les données OA.";
  }
}

function copyOAResult() {
  const text = document.getElementById("oa_result").innerText
    .replace(/📏|🧭|↩️|📍/g, "").replace(/\n+/g, " | ").trim();
  navigator.clipboard.writeText(text).then(() => showToast("Copié ✓", "success"));
}

// -------------------------------
//   INIT DOM
// -------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Listeners synchronisation
  document.getElementById("obj_main").addEventListener("input", () => syncObjFields("main"));
  document.getElementById("obj_oa").addEventListener("input", () => syncObjFields("oa"));

  // Validation à la saisie
  ["posn_mor", "obj_main", "oa_mgrs", "obj_oa"].forEach(id => {
    document.getElementById(id).addEventListener("input", e => {
      validateInput(id, e.target.value);
    });
  });

  // Initialiser carte
  initMap();

  // Charger historique
  renderHistory();

  // Défaut boutons toggle
  setLatSign(1);
  setRangeSign(1);
});
