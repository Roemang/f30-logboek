// Alle gegevens blijven in de browser van de bezoeker (localStorage).
// Er gaat niets naar een server, dus de site kan gewoon op GitHub Pages draaien.
const KEY = "f30-logboek-v1";

export const DEFAULT_STATE = {
  plate: "",
  vehicle: null,          // laatste RDW-resultaat
  engine: "320d",
  automatic: true,
  odometer: [],           // [{ date: "2026-10-18", km: 154000 }]
  services: [],           // [{ id, date, km, items: ["olie"], cost, note }]
  intervalOverrides: {},  // { olie: { km: 10000, months: 12 } }
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `f30-logboek-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importState(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (typeof data !== "object" || !Array.isArray(data.services)) {
    throw new Error("Dit lijkt geen F30-logboek bestand.");
  }
  return { ...structuredClone(DEFAULT_STATE), ...data };
}
