/**
 * One-off extractor: PSA PSGC 2023 barangay boundaries (via BetterGov.ph,
 * NA MRIA geometry) clipped to Daet (ADM3_PCODE PH0501603) → the committed
 * barangay seed file.
 *
 * Run: node scripts/extract-barangays.mjs "D:/Github/betterlabo/data/sources"
 *
 * The output carries the source it came from so nobody has to guess later.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MUNI = "PH0501603";

function centroid(geometry) {
  let s = 0;
  let x = 0;
  let y = 0;
  const ring = (r) => {
    for (let i = 0; i < r.length - 1; i += 1) {
      const a = r[i];
      const b = r[i + 1];
      const c = a[0] * b[1] - b[0] * a[1];
      s += c;
      x += (a[0] + b[0]) * c;
      y += (a[1] + b[1]) * c;
    }
  };
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) ring(poly[0]);
  if (Math.abs(s) < 1e-12) return null;
  return [x / (3 * s), y / (3 * s)];
}

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/extract-barangays.mjs <path-to-betterlabo/data/sources>");
  process.exit(1);
}

const barangays = JSON.parse(readFileSync(join(source, "ph-barangays.geojson"), "utf8"));
const municipalities = JSON.parse(
  readFileSync(join(source, "ph-municipalities.geojson"), "utf8"),
);

const rows = barangays.features
  .filter((f) => f.properties.ADM3_PCODE === MUNI)
  .map((f) => {
    const pt = centroid(f.geometry);
    return {
      name: f.properties.ADM4_EN,
      psgcCode: f.properties.psgc_code,
      areaSqkm: Number(f.properties.AREA_SQKM) || null,
      lng: pt ? Number(pt[0].toFixed(6)) : null,
      lat: pt ? Number(pt[1].toFixed(6)) : null,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const muni = municipalities.features.find((f) => f.properties.ADM3_PCODE === MUNI);
if (!muni) throw new Error(`No municipality feature for ${MUNI}`);

const out = {
  municipality: "Daet",
  province: "Camarines Norte",
  region: "Region V (Bicol Region)",
  psgcCode: muni.properties.psgc_code,
  adm3Pcode: MUNI,
  areaSqkm: Number(muni.properties.AREA_SQKM) || null,
  centre: { lng: 122.95393, lat: 14.10793 },
  source: {
    publisher: "PSA PSGC 2023 (validOn 2023-11-06) + NAMRIA boundary layers via BetterGov.ph",
    file: "ph-barangays.geojson",
    note: "Centroids are polygon centroids, not official barangay hall locations.",
  },
  barangayCount: rows.length,
  barangays: rows,
};

const target = join(process.cwd(), "src", "data", "daet-barangays.json");
mkdirSync(join(process.cwd(), "src", "data"), { recursive: true });
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(`wrote ${target} — ${rows.length} barangays`);
