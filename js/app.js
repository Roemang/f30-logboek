import { ENGINES, itemsForEngine } from "./intervals.js";
import { lookupVehicle, formatPlate } from "./rdw.js";
import { loadState, saveState, exportState, importState, DEFAULT_STATE } from "./storage.js";
import { estimateToday, itemStatus, todayIso, daysBetween, toDate } from "./calc.js";

let state = loadState();
const $ = (sel) => document.querySelector(sel);

const nf = new Intl.NumberFormat("nl-NL");
const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const df = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });
const fmtDate = (d) => (d ? df.format(d instanceof Date ? d : new Date(d)) : "—");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

function persist() {
  if (!saveState(state)) toast("Opslaan in de browser lukt niet (privévenster?).");
  render();
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("is-on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("is-on"), 3200);
}

function activeItems() {
  return itemsForEngine(state.engine).filter((i) => i.id !== "automaat" || state.automatic);
}

/* ---------- RDW ---------- */
function renderVehicle() {
  const box = $("#vehicle");
  const v = state.vehicle;
  if (!v) return;

  const apk = v.apkVervalt ? new Date(v.apkVervalt) : null;
  const apkDays = apk ? daysBetween(new Date(), apk) : null;
  const apkClass = apkDays == null ? "" : apkDays < 0 ? "is-overdue" : apkDays <= 60 ? "is-soon" : "is-ok";
  const apkText =
    apkDays == null
      ? "Onbekend"
      : apkDays < 0
        ? `${nf.format(-apkDays)} dagen verlopen`
        : `nog ${nf.format(apkDays)} dagen`;

  const built = v.eersteToelating ? new Date(v.eersteToelating) : null;
  const ageYears = built ? Math.floor(daysBetween(built, new Date()) / 365.25) : null;
  const pk = v.vermogenKw ? Math.round(v.vermogenKw * 1.35962) : null;
  const tellerOk = (v.tellerstandOordeel || "").toLowerCase() === "logisch";

  box.innerHTML = `
    <div class="vehicle__title">
      <h2>${esc(v.merk)} ${esc(v.model)}</h2>
      <span class="muted">${esc(formatPlate(v.plate))} · ${esc((v.kleur || "").toLowerCase())} · ${esc(v.inrichting || "")}</span>
      ${!v.isBmw ? `<p class="warn">Dit kenteken is geen BMW. De onderhoudsintervallen zijn bedoeld voor de F30.</p>` : ""}
    </div>
    <div class="apk ${apkClass}">
      <span class="eyebrow">APK verloopt</span>
      <strong>${apk ? fmtDate(apk) : "—"}</strong>
      <span>${apkText}</span>
    </div>
    <dl class="specs">
      <div><dt>Eerste toelating</dt><dd>${fmtDate(built)}${ageYears != null ? ` <span class="muted">(${ageYears} jr)</span>` : ""}</dd></div>
      <div><dt>Brandstof</dt><dd>${esc(v.brandstof || "—")}${v.euroklasse ? ` <span class="muted">${esc(v.euroklasse)}</span>` : ""}</dd></div>
      <div><dt>Vermogen</dt><dd>${v.vermogenKw ? `${v.vermogenKw} kW <span class="muted">(${pk} pk)</span>` : "—"}</dd></div>
      <div><dt>Cilinderinhoud</dt><dd>${v.cilinderinhoud ? `${nf.format(v.cilinderinhoud)} cc` : "—"}</dd></div>
      <div><dt>Tellerstand (RDW)</dt><dd class="${tellerOk ? "ok" : "bad"}">${esc(v.tellerstandOordeel || "—")}${v.tellerstandJaar ? ` <span class="muted">laatst ${esc(v.tellerstandJaar)}</span>` : ""}</dd></div>
      <div><dt>Terugroepactie</dt><dd class="${v.terugroepactie ? "bad" : "ok"}">${v.terugroepactie ? "Open actie" : "Geen open actie"}</dd></div>
    </dl>
  `;
}

async function onPlateSubmit(e) {
  e.preventDefault();
  const input = $("#plateInput");
  const btn = $("#plateBtn");
  btn.disabled = true;
  btn.textContent = "Ophalen…";
  try {
    const v = await lookupVehicle(input.value);
    state.plate = v.plate;
    state.vehicle = v;
    input.value = formatPlate(v.plate);
    guessEngine(v);
    persist();
  } catch (err) {
    toast(err.message || "Ophalen mislukt.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Ophalen bij RDW";
  }
}

// Kies een logische motor op basis van brandstof en vermogen uit de RDW.
function guessEngine(v) {
  if (!v.vermogenKw || !v.brandstof) return;
  const fuel = v.brandstof.toLowerCase();
  const kw = v.vermogenKw;
  let id = null;
  if (fuel.includes("diesel")) {
    id = kw < 90 ? "316d" : kw < 115 ? "318d" : kw < 150 ? "320d" : kw < 170 ? "325d" : kw < 220 ? "330d" : "335d";
  } else if (v.hybride) {
    id = "330e";
  } else if (fuel.includes("benzine")) {
    id = kw < 110 ? "316i" : kw < 150 ? "320i" : kw < 190 ? "330i" : kw < 245 ? "335i" : "340i";
  }
  if (id) state.engine = id;
}

/* ---------- Kilometers ---------- */
function renderOdometer() {
  const est = estimateToday(state);
  const digits = $("#odoDigits");
  const tag = $("#kmTag");
  const hint = $("#odoHint");

  if (est.km == null) {
    digits.textContent = "——————";
    tag.textContent = "geen data";
    hint.textContent = state.vehicle
      ? "De RDW deelt geen kilometerstanden. Vul hieronder je huidige stand in, dan rekent de site vanaf nu door."
      : "Voeg een kilometerstand toe om te beginnen.";
    $("#spark").innerHTML = "";
    return est;
  }

  digits.textContent = String(est.km).padStart(6, "0");
  const isLive = est.daysSince === 0;
  tag.textContent = isLive ? "vandaag gemeten" : "geschat voor vandaag";
  tag.classList.toggle("tag--live", isLive);
  const perYear = Math.round((est.rate * 365) / 100) * 100;
  hint.innerHTML = isLive
    ? `Gemiddeld ${nf.format(perYear)} km per jaar${est.rateEstimated ? " (aanname, voeg meer standen toe)" : ""}.`
    : `Laatste meting ${nf.format(est.lastReading.km)} km op ${fmtDate(toDate(est.lastReading.date))}. Doorgerekend met ${nf.format(perYear)} km/jaar${est.rateEstimated ? " (aanname)" : ""}.`;

  renderSpark(est.readings);
  return est;
}

function renderSpark(readings) {
  const svg = $("#spark");
  if (readings.length < 2) {
    svg.innerHTML = "";
    return;
  }
  const xs = readings.map((r) => toDate(r.date).getTime());
  const ys = readings.map((r) => r.km);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x) => ((x - x0) / (x1 - x0 || 1)) * 296 + 2;
  const sy = (y) => 56 - ((y - y0) / (y1 - y0 || 1)) * 52;
  const pts = readings.map((r, i) => `${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`);
  svg.innerHTML = `
    <polyline points="2,58 ${pts.join(" ")} 298,58" class="spark__area"/>
    <polyline points="${pts.join(" ")}" class="spark__line"/>
    ${pts.map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="2.2" class="spark__dot"/>`).join("")}
  `;
}

function onKmSubmit(e) {
  e.preventDefault();
  const data = new FormData(e.target);
  const km = Math.round(+data.get("km"));
  const date = data.get("date");
  const est = estimateToday(state);
  const prev = est.readings.filter((r) => r.date <= date).pop();
  if (prev && km < prev.km) {
    toast(`Lager dan je stand van ${fmtDate(toDate(prev.date))} (${nf.format(prev.km)} km).`);
    return;
  }
  state.odometer = state.odometer.filter((r) => r.date !== date).concat({ date, km });
  e.target.km.value = "";
  persist();
  toast("Kilometerstand opgeslagen.");
}

/* ---------- Status ---------- */
function renderStatus(est) {
  const grid = $("#statusGrid");
  const statuses = activeItems().map((item) => itemStatus(item, state, est));
  const order = { overdue: 0, soon: 1, ok: 2, unknown: 3 };
  statuses.sort((a, b) => order[a.state] - order[b.state] || (b.pct ?? 0) - (a.pct ?? 0));

  grid.innerHTML = statuses
    .map((s) => {
      const { item, interval } = s;
      const intervalText = [
        interval.km ? `${nf.format(interval.km)} km` : null,
        interval.months ? `${interval.months} mnd` : null,
      ]
        .filter(Boolean)
        .join(" of ");
      const custom = state.intervalOverrides[item.id]
        ? `<span class="custom" title="Aangepast interval">aangepast</span>`
        : "";

      if (s.state === "unknown") {
        return `
        <article class="card is-unknown">
          <header><h3>${esc(item.name)}</h3><button class="icon-btn" data-edit="${item.id}" aria-label="Interval aanpassen voor ${esc(item.name)}">⚙</button></header>
          <p class="card__main">Nog niet gelogd</p>
          <p class="card__meta">Elke ${intervalText} ${custom}</p>
          <p class="card__tip">${esc(item.tip)}</p>
        </article>`;
      }

      const pct = Math.min(s.pct, 1.15);
      const lines = [];
      if (s.kmLeft != null)
        lines.push(s.kmLeft < 0 ? `${nf.format(-s.kmLeft)} km over tijd` : `nog ${nf.format(s.kmLeft)} km`);
      if (s.daysLeft != null)
        lines.push(s.daysLeft < 0 ? `${nf.format(-s.daysLeft)} dagen over tijd` : `nog ${nf.format(s.daysLeft)} dagen`);

      return `
      <article class="card is-${s.state}">
        <header><h3>${esc(item.name)}</h3><button class="icon-btn" data-edit="${item.id}" aria-label="Interval aanpassen voor ${esc(item.name)}">⚙</button></header>
        <p class="card__main">${lines.join(" · ")}</p>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(s.pct * 100)}" aria-label="${Math.round(s.pct * 100)}% van interval gebruikt">
          <span style="width:${(pct / 1.15) * 100}%"></span><i style="left:${(1 / 1.15) * 100}%"></i>
        </div>
        <p class="card__meta">
          Laatst ${fmtDate(toDate(s.done.date))}${s.done.km ? ` bij ${nf.format(s.done.km)} km` : ""}<br>
          ${s.state === "overdue" ? "Nu aan de beurt" : `Verwacht rond ${fmtDate(s.dueDate)}`} · elke ${intervalText} ${custom}
        </p>
        <p class="card__tip">${esc(item.tip)}</p>
      </article>`;
    })
    .join("");

  const overdue = statuses.filter((s) => s.state === "overdue").length;
  const soon = statuses.filter((s) => s.state === "soon").length;
  const unknown = statuses.filter((s) => s.state === "unknown").length;
  $("#summary").innerHTML = `
    <div class="sum is-overdue"><strong>${overdue}</strong><span>verlopen</span></div>
    <div class="sum is-soon"><strong>${soon}</strong><span>binnenkort</span></div>
    <div class="sum is-unknown"><strong>${unknown}</strong><span>niet gelogd</span></div>
  `;
}

/* ---------- Logboek ---------- */
function renderChips() {
  const box = $("#itemChips");
  const checked = new Set([...box.querySelectorAll("input:checked")].map((i) => i.value));
  box.innerHTML =
    `<legend>Wat is er gedaan?</legend>` +
    activeItems()
      .map(
        (i) => `
    <label class="chip"><input type="checkbox" name="items" value="${i.id}" ${checked.has(i.id) ? "checked" : ""}><span>${esc(i.name)}</span></label>
  `,
      )
      .join("");
}

function renderLog() {
  const body = $("#logBody");
  const all = itemsForEngine(state.engine);
  const nameOf = (id) => all.find((i) => i.id === id)?.name || id;
  const rows = [...state.services].sort((a, b) => b.date.localeCompare(a.date));

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5" class="muted empty-row">Nog geen beurten gelogd.</td></tr>`;
    $("#costTotal").textContent = "";
    return;
  }
  body.innerHTML = rows
    .map(
      (s) => `
    <tr>
      <td>${fmtDate(toDate(s.date))}</td>
      <td class="num">${s.km ? nf.format(s.km) : "—"}</td>
      <td>${s.items.map((id) => `<span class="pill">${esc(nameOf(id))}</span>`).join("")}${s.note ? `<div class="muted small">${esc(s.note)}</div>` : ""}</td>
      <td class="num">${s.cost ? eur.format(s.cost) : "—"}</td>
      <td><button class="icon-btn" data-del="${s.id}" aria-label="Verwijder beurt van ${fmtDate(toDate(s.date))}">✕</button></td>
    </tr>`,
    )
    .join("");
  const total = rows.reduce((sum, s) => sum + (+s.cost || 0), 0);
  $("#costTotal").textContent = total ? `Totaal ${eur.format(total)}` : "";
}

function onServiceSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  const items = data.getAll("items");
  if (!items.length) {
    toast("Kies minstens één onderdeel.");
    return;
  }
  state.services.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: data.get("date"),
    km: Math.round(+data.get("km")) || null,
    cost: data.get("cost") ? +data.get("cost") : null,
    note: String(data.get("note") || "").trim(),
    items,
  });
  form.reset();
  form.date.value = todayIso();
  persist();
  toast("Beurt opgeslagen.");
}

/* ---------- Interval-dialoog ---------- */
let editingId = null;
function openInterval(id) {
  const item = itemsForEngine(state.engine).find((i) => i.id === id);
  if (!item) return;
  editingId = id;
  const cur = { km: item.km, months: item.months, ...(state.intervalOverrides[id] || {}) };
  const form = $("#intervalForm");
  $("#intervalTitle").textContent = item.name;
  form.km.value = cur.km ?? "";
  form.months.value = cur.months ?? "";
  $("#intervalDialog").showModal();
}

function onIntervalClose() {
  const dlg = $("#intervalDialog");
  const form = $("#intervalForm");
  if (dlg.returnValue === "save") {
    const km = form.km.value ? +form.km.value : null;
    const months = form.months.value ? +form.months.value : null;
    if (!km && !months) {
      toast("Vul minstens km of maanden in.");
      return;
    }
    state.intervalOverrides[editingId] = { km, months };
    persist();
  } else if (dlg.returnValue === "reset") {
    delete state.intervalOverrides[editingId];
    persist();
  }
}

/* ---------- Demo ---------- */
function loadDemo() {
  const d = (monthsAgo) => {
    const x = new Date();
    x.setMonth(x.getMonth() - monthsAgo);
    return x.toISOString().slice(0, 10);
  };
  state = {
    ...structuredClone(DEFAULT_STATE),
    engine: "320d",
    automatic: true,
    vehicle: {
      plate: "XX999X",
      merk: "BMW",
      model: "3ER REIHE (voorbeeld)",
      type: "3L",
      kleur: "BLAUW",
      inrichting: "sedan",
      cilinderinhoud: 1995,
      massa: 1550,
      eersteToelating: "2016-03-14",
      apkVervalt: (() => {
        const x = new Date();
        x.setDate(x.getDate() + 41);
        return x.toISOString().slice(0, 10);
      })(),
      tellerstandOordeel: "Logisch",
      tellerstandJaar: String(new Date().getFullYear()),
      terugroepactie: false,
      wamVerzekerd: true,
      brandstof: "Diesel",
      vermogenKw: 140,
      euroklasse: "EURO 6",
      isBmw: true,
    },
    odometer: [
      { date: d(20), km: 128400 },
      { date: d(14), km: 136900 },
      { date: d(9), km: 143200 },
      { date: d(4), km: 149800 },
      { date: d(1), km: 153600 },
    ],
    services: [
      {
        id: "d1",
        date: d(22),
        km: 126100,
        cost: 389,
        note: "BMW dealer, kleine beurt",
        items: ["olie", "interieurfilter", "remvloeistof"],
      },
      { id: "d2", date: d(30), km: 115000, cost: 210, note: "Eigen garage", items: ["luchtfilter", "brandstoffilter"] },
      { id: "d3", date: d(11), km: 141000, cost: 165, note: "Olie zelf gedaan, Castrol 5W-30 LL-04", items: ["olie"] },
      { id: "d4", date: d(6), km: 146900, cost: 540, note: "M-sport blokken + schijven voor", items: ["remmen"] },
      { id: "d5", date: d(50), km: 92000, cost: 120, note: "", items: ["koelvloeistof"] },
    ],
  };
  $("#plateInput").value = "";
  persist();
  toast("Voorbeelddata geladen. Wis het via ‘Wissen’.");
}

/* ---------- Render ---------- */
function render() {
  renderVehicle();
  const est = renderOdometer();
  renderStatus(est);
  renderChips();
  renderLog();
  $("#engineSelect").value = state.engine;
  $("#autoToggle").checked = state.automatic;
  if (state.plate && !$("#plateInput").value) $("#plateInput").value = formatPlate(state.plate);
}

function init() {
  $("#engineSelect").innerHTML = ENGINES.map((e) => `<option value="${e.id}">${esc(e.label)}</option>`).join("");
  $("#kmForm").date.value = todayIso();
  $("#serviceForm").date.value = todayIso();
  $("#kmForm").date.max = todayIso();
  $("#serviceForm").date.max = todayIso();

  $("#plateForm").addEventListener("submit", onPlateSubmit);
  $("#plateInput").addEventListener("input", (e) => {
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase();
    e.target.setSelectionRange(pos, pos);
  });
  $("#kmForm").addEventListener("submit", onKmSubmit);
  $("#serviceForm").addEventListener("submit", onServiceSubmit);
  $("#engineSelect").addEventListener("change", (e) => {
    state.engine = e.target.value;
    persist();
  });
  $("#autoToggle").addEventListener("change", (e) => {
    state.automatic = e.target.checked;
    persist();
  });
  $("#statusGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit]");
    if (btn) openInterval(btn.dataset.edit);
  });
  $("#logBody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn || !confirm("Deze beurt verwijderen?")) return;
    state.services = state.services.filter((s) => s.id !== btn.dataset.del);
    persist();
  });
  $("#intervalDialog").addEventListener("close", onIntervalClose);
  $("#demoBtn").addEventListener("click", loadDemo);
  $("#exportBtn").addEventListener("click", () => exportState(state));
  $("#importInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      state = await importState(file);
      persist();
      toast("Logboek geïmporteerd.");
    } catch (err) {
      toast(err.message || "Importeren mislukt.");
    }
    e.target.value = "";
  });
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Alle gegevens in deze browser wissen?")) return;
    state = structuredClone(DEFAULT_STATE);
    $("#plateInput").value = "";
    $("#vehicle").innerHTML =
      `<div class="empty"><p>Vul je kenteken in voor APK-datum, bouwjaar, vermogen en het oordeel over je tellerstand.</p></div>`;
    persist();
  });

  render();
}

init();
