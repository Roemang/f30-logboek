// Onderhoudsintervallen voor de BMW F30 (3-serie sedan, 2012–2019).
// Dit zijn adviesintervallen voor normaal gebruik, deels strenger dan BMW's
// Condition Based Service (CBS), die olie soms pas na 25–30.000 km vraagt.
// Elke waarde is in de app per auto aan te passen.

export const ENGINES = [
  { id: "316i",  label: "316i (N13 / B38)",       fuel: "benzine" },
  { id: "318i",  label: "318i (B38)",             fuel: "benzine" },
  { id: "320i",  label: "320i (N20 / B48)",       fuel: "benzine" },
  { id: "328i",  label: "328i (N20)",             fuel: "benzine" },
  { id: "330i",  label: "330i (B48)",             fuel: "benzine" },
  { id: "335i",  label: "335i (N55)",             fuel: "benzine" },
  { id: "340i",  label: "340i (B58)",             fuel: "benzine" },
  { id: "330e",  label: "330e (B48 plug-in)",     fuel: "hybride" },
  { id: "316d",  label: "316d (N47 / B47)",       fuel: "diesel" },
  { id: "318d",  label: "318d (N47 / B47)",       fuel: "diesel" },
  { id: "320d",  label: "320d (N47 / B47)",       fuel: "diesel" },
  { id: "325d",  label: "325d (N47 / B47)",       fuel: "diesel" },
  { id: "330d",  label: "330d (N57)",             fuel: "diesel" },
  { id: "335d",  label: "335d (N57)",             fuel: "diesel" },
];

// km: interval in kilometers (null = alleen tijd)
// months: interval in maanden (null = alleen km)
// fuels: voor welke brandstoffen dit onderdeel geldt
export const SERVICE_ITEMS = [
  {
    id: "olie",
    name: "Motorolie + oliefilter",
    km: 15000, months: 12,
    fuels: ["benzine", "diesel", "hybride"],
    tip: "BMW Longlife-01 of LL-04 (diesel met roetfilter). Veel F30-rijders verversen elke 10–15.000 km in plaats van de 25.000+ die CBS soms aangeeft.",
  },
  {
    id: "remvloeistof",
    name: "Remvloeistof",
    km: null, months: 24,
    fuels: ["benzine", "diesel", "hybride"],
    tip: "DOT 4 LV. Trekt vocht aan, daarom puur op tijd.",
  },
  {
    id: "interieurfilter",
    name: "Interieurfilter (microfilter)",
    km: 30000, months: 24,
    fuels: ["benzine", "diesel", "hybride"],
    tip: "Twee filters achter het dashboardkastje aan de passagierskant.",
  },
  {
    id: "luchtfilter",
    name: "Luchtfilter motor",
    km: 60000, months: 48,
    fuels: ["benzine", "diesel", "hybride"],
    tip: "Eerder bij veel stof of korte ritten in de stad.",
  },
  {
    id: "bougies",
    name: "Bougies",
    km: 60000, months: 72,
    fuels: ["benzine", "hybride"],
    tip: "Bij getunede 335i/340i vaak elke 30–40.000 km.",
  },
  {
    id: "brandstoffilter",
    name: "Brandstoffilter",
    km: 60000, months: 48,
    fuels: ["diesel"],
    tip: "Alleen diesel; benzinefilter zit in de tank en is levenslang.",
  },
  {
    id: "remmen",
    name: "Remblokken + schijven controleren",
    km: 30000, months: 24,
    fuels: ["benzine", "diesel", "hybride"],
    tip: "M-sport remmen (blauwe klauwen) slijten sneller dan standaard. Schijven meestal elke tweede blokkenwissel.",
  },
  {
    id: "koelvloeistof",
    name: "Koelvloeistof",
    km: null, months: 48,
    fuels: ["benzine", "diesel", "hybride"],
    tip: "BMW noemt het 'lifetime'; vervangen na ca. 4 jaar voorkomt problemen met waterpomp en thermostaat.",
  },
  {
    id: "automaat",
    name: "Automaatbakolie (ZF 8HP)",
    km: 80000, months: null,
    fuels: ["benzine", "diesel", "hybride"],
    tip: "ZF adviseert 80–120.000 km, ook al zegt BMW 'lifetime'. Alleen bij automaat.",
  },
  {
    id: "differentieel",
    name: "Differentieelolie",
    km: 100000, months: null,
    fuels: ["benzine", "diesel", "hybride"],
    tip: "Vooral relevant bij xDrive of veel sportief rijden.",
  },
];

export function itemsForEngine(engineId) {
  const engine = ENGINES.find((e) => e.id === engineId);
  const fuel = engine ? engine.fuel : "benzine";
  return SERVICE_ITEMS.filter((item) => item.fuels.includes(fuel));
}
