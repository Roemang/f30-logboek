// RDW Open Data (opendata.rdw.nl) — gratis, geen API-sleutel nodig, CORS toegestaan.
const BASE = "https://opendata.rdw.nl/resource";
const VOERTUIGEN = `${BASE}/m9d7-ebf2.json`;
const BRANDSTOF = `${BASE}/8ys7-d773.json`;

export function normalizePlate(input) {
  return String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Zet "12ABC3" om naar het gangbare streepjesformaat (bv. "12-ABC-3").
export function formatPlate(plate) {
  const p = normalizePlate(plate);
  const groups = p.match(/[A-Z]+|[0-9]+/g) || [p];
  if (groups.length >= 3) return groups.join("-");
  // Formaten als XX-99-XX hebben 3 groepen; 99-XX-XX ook. Bij 2 groepen splitsen we op 2-2-2.
  if (p.length === 6) return `${p.slice(0, 2)}-${p.slice(2, 4)}-${p.slice(4)}`;
  return p;
}

function parseDate(yyyymmdd) {
  if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return null;
  const y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6) - 1, d = +yyyymmdd.slice(6, 8);
  return new Date(y, m, d);
}

async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Kan de RDW niet bereiken. Controleer je internetverbinding.");
  }
  if (!res.ok) throw new Error(`RDW gaf status ${res.status}`);
  return res.json();
}

export async function lookupVehicle(plateInput) {
  const plate = normalizePlate(plateInput);
  if (plate.length < 4) throw new Error("Vul een geldig kenteken in.");

  const q = `?kenteken=${encodeURIComponent(plate)}`;
  const [vehicles, fuels] = await Promise.all([
    getJson(VOERTUIGEN + q),
    getJson(BRANDSTOF + q).catch(() => []),
  ]);

  if (!vehicles.length) throw new Error("Geen voertuig gevonden bij de RDW voor dit kenteken.");
  const v = vehicles[0];
  const f = fuels[0] || {};

  return {
    plate,
    merk: v.merk,
    model: v.handelsbenaming,
    type: v.type,
    kleur: v.eerste_kleur,
    inrichting: v.inrichting,
    cilinderinhoud: v.cilinderinhoud ? +v.cilinderinhoud : null,
    massa: v.massa_rijklaar ? +v.massa_rijklaar : null,
    eersteToelating: parseDate(v.datum_eerste_toelating),
    apkVervalt: parseDate(v.vervaldatum_apk),
    tellerstandOordeel: v.tellerstandoordeel || null,
    tellerstandJaar: v.jaar_laatste_registratie_tellerstand || null,
    terugroepactie: v.openstaande_terugroepactie_indicator === "Ja",
    wamVerzekerd: v.wam_verzekerd === "Ja",
    catalogusprijs: v.catalogusprijs ? +v.catalogusprijs : null,
    brandstof: f.brandstof_omschrijving || null,
    vermogenKw: f.nettomaximumvermogen ? Math.round(+f.nettomaximumvermogen) : null,
    euroklasse: f.uitlaatemissieniveau || null,
    hybride: fuels.some((x) => /elektr/i.test(x.brandstof_omschrijving || "")),
    isBmw: (v.merk || "").toUpperCase() === "BMW",
  };
}
