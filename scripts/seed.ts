/**
 * Seed Daet Watch with real geography and clearly-marked demo content.
 *
 *   npm run seed            # wipe + reseed every seeded collection
 *
 * Everything it writes is demo data except the 25 barangays, which come from
 * PSA PSGC 2023 boundaries (see src/data/daet-barangays.json). Photos are
 * placeholder cards uploaded to Cloudinary under `daet-watch/seed/`; when
 * Cloudinary is not configured the seed falls back to a public placeholder
 * service so the UI still has images to lay out.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { Category } from "@/lib/rules";
import type { UpdateType } from "@/models/engagement";
import type { UserDoc } from "@/models/user";
import type { IssueDoc } from "@/models/issue";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const { connectDb } = await import("@/lib/db/mongoose");
const { Barangay } = await import("@/models/barangay");
const { Issue } = await import("@/models/issue");
const { User } = await import("@/models/user");
const { Confirmation, FixVote, IssueUpdate, ReopenVote, ShareEvent, Flag } = await import(
  "@/models/engagement"
);
const { WaterSource, WaterTruckReport } = await import("@/models/water");
const { RateLimit } = await import("@/models/system");
const { makeSlug } = await import("@/lib/slug");
const { FIX_THRESHOLD } = await import("@/lib/rules");

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY);

interface BarangayFile {
  barangayCount: number;
  source: { publisher: string; file: string };
  barangays: { name: string; psgcCode: string; areaSqkm: number | null; lng: number; lat: number }[];
}

const barangayFile = JSON.parse(
  readFileSync("src/data/daet-barangays.json", "utf8"),
) as BarangayFile;

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const KEY = process.env.CLOUDINARY_API_KEY ?? "";
const SECRET = process.env.CLOUDINARY_API_SECRET ?? "";
const FOLDER = `${process.env.CLOUDINARY_FOLDER ?? "daet-watch"}/seed`;
const CLOUDINARY_READY = Boolean(CLOUD && KEY && SECRET);

const CATEGORY_COLOURS: Record<string, string> = {
  water: "#1d6fd0",
  road: "#3b3f46",
  drainage: "#5b6470",
  garbage: "#2f7d4f",
  streetlight: "#8a6d00",
  electricity: "#a8541b",
  health: "#9c2b52",
  other: "#4a4a4a",
};

function placeholderSvg(category: string, index: number): string {
  const bg = CATEGORY_COLOURS[category] ?? "#4a4a4a";
  // Deliberately quiet: a huge category word here bleeds through the share card
  // and reads as a rendering bug. The demo marking lives in one small chip, and
  // every seeded description already opens with "Demo data."
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="${bg}"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.13" stroke-width="16">
    <path d="M-80 640 L520 -40"/><path d="M120 880 L760 120"/><path d="M360 880 L1000 120"/>
  </g>
  <g opacity="0.9">
    <rect x="48" y="686" width="196" height="52" rx="12" fill="#000000" fill-opacity="0.28"/>
    <text x="68" y="720" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="3.5" fill="#ffffff" fill-opacity="0.85">DEMO PHOTO ${index}</text>
  </g>
</svg>`;
}

interface SeedPhoto {
  url: string;
  width: number;
  height: number;
}

const photoCache = new Map<string, SeedPhoto>();

async function photoFor(category: string, index: number): Promise<SeedPhoto> {
  const key = `${category}-${index}`;
  const cached = photoCache.get(key);
  if (cached) return cached;

  let photo: SeedPhoto;
  if (CLOUDINARY_READY) {
    const publicId = `${FOLDER}/${key}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha1")
      .update(`overwrite=true&public_id=${publicId}&timestamp=${timestamp}${SECRET}`)
      .digest("hex");

    const form = new FormData();
    form.set(
      "file",
      new Blob([placeholderSvg(category, index)], { type: "image/svg+xml" }),
      `${key}.svg`,
    );
    form.set("api_key", KEY);
    form.set("timestamp", String(timestamp));
    form.set("public_id", publicId);
    form.set("overwrite", "true");
    form.set("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: "POST",
      body: form,
    });
    const body = (await res.json()) as { secure_url?: string; error?: { message: string } };
    if (res.ok && body.secure_url) {
      // Delivered as a normal rasters so every consumer (browser, satori) can read it.
      photo = {
        url: body.secure_url.replace("/image/upload/", "/image/upload/f_png,q_auto,w_1200/"),
        width: 1200,
        height: 800,
      };
    } else {
      console.warn(`  ! Cloudinary rejected ${key}: ${body.error?.message ?? res.status}`);
      photo = fallbackPhoto(category, index);
    }
  } else {
    photo = fallbackPhoto(category, index);
  }

  photoCache.set(key, photo);
  return photo;
}

function fallbackPhoto(category: string, index: number): SeedPhoto {
  return {
    url: `https://placehold.co/1200x800/${(CATEGORY_COLOURS[category] ?? "#4a4a4a").slice(1)}/ffffff/png?text=${encodeURIComponent(
      `DEMO PHOTO - ${category} ${index}`,
    )}`,
    width: 1200,
    height: 800,
  };
}

interface SeedIssue {
  category: Category;
  title: string;
  description: string;
  barangay: string;
  reportedDaysAgo: number;
  confirmations: number;
  status: "reported" | "confirmed" | "unfixed" | "fixed" | "reopened" | "hidden";
  fixedDaysAgo?: number;
  reopenedDaysAgo?: number;
  address: string;
  water?: { outageDaysAgo: number; households: number };
  photos?: number;
}

const SEED_ISSUES: SeedIssue[] = [
  {
    category: "water",
    title: "No water since Monday in Lag-On",
    description:
      "Demo data. Walang tubig sa buong purok simula Lunes ng umaga. Wala ring advisory mula sa water district. Mga bata ang unang apektado.",
    barangay: "Lag-On",
    reportedDaysAgo: 47,
    confirmations: 42,
    status: "confirmed",
    address: "Purok 3, near Lag-On Elementary School",
    water: { outageDaysAgo: 47, households: 80 },
    photos: 2,
  },
  {
    category: "road",
    title: "Pothole the size of a tricycle tire on Bagasbas Road",
    description:
      "Demo data. Malalim na lubak sa may kanto papuntang Bagasbas. Dalawang motorsiklo na ang nadisgrasya dito noong gabi.",
    barangay: "Bagasbas",
    reportedDaysAgo: 63,
    confirmations: 27,
    status: "confirmed",
    address: "Bagasbas Road, 200m before the beach entrance",
  },
  {
    category: "drainage",
    title: "Clogged canal floods the corner every rain",
    description:
      "Demo data. Barado ang kanal kaya umaabot sa tuhod ang baha tuwing malakas ang ulan. May tindahan sa kanto na laging binabaha.",
    barangay: "Barangay II (Pob.)",
    reportedDaysAgo: 88,
    confirmations: 61,
    status: "unfixed",
    address: "Corner of Zamora St. and Vinzons Ave.",
  },
  {
    category: "streetlight",
    title: "Whole stretch dark from the plaza to the bridge",
    description:
      "Demo data. Walang ilaw sa buong stretch. Madilim at delikado para sa mga babaeng umuuwi ng gabi.",
    barangay: "Barangay V (Pob.)",
    reportedDaysAgo: 31,
    confirmations: 18,
    status: "confirmed",
    address: "Plaza Rizal to Daet Bridge",
  },
  {
    category: "garbage",
    title: "Uncollected garbage piling near the market",
    description:
      "Demo data. Isang linggo nang hindi nakolekta ang basura sa likod ng palengke. Mabaho na at may langaw na.",
    barangay: "Barangay IV (Pob.)",
    reportedDaysAgo: 9,
    confirmations: 12,
    status: "confirmed",
    address: "Behind Daet Public Market, east side",
  },
  {
    category: "water",
    title: "Deep well pump broken, 30 households affected",
    description:
      "Demo data. Sira ang pump ng deep well. Kailangang maglakad ng 500m papunta sa kabilang purok para makakuha ng tubig.",
    barangay: "Gubat",
    reportedDaysAgo: 22,
    confirmations: 30,
    status: "confirmed",
    address: "Purok 2 deep well, Gubat",
    water: { outageDaysAgo: 25, households: 30 },
  },
  {
    category: "road",
    title: "Unpaved road turns to mud after rain",
    description:
      "Demo data. Walang semento ang kalsada. Kapag umulan, putik at hindi madaanan ng tricycle.",
    barangay: "Alawihao",
    reportedDaysAgo: 120,
    confirmations: 22,
    status: "unfixed",
    address: "Sitio Malinaw Road, Alawihao",
  },
  {
    category: "drainage",
    title: "Manhole cover missing near elementary school",
    description:
      "Demo data. Nawala ang takip ng manhole. Delikado sa mga bata tuwing uwian.",
    barangay: "Magang",
    reportedDaysAgo: 14,
    confirmations: 9,
    status: "confirmed",
    address: "In front of Magang Elementary School gate",
  },
  {
    category: "electricity",
    title: "Frequent brownouts every evening",
    description:
      "Demo data. Nagsisimula ang brownout bandang 6pm halos araw-araw. Isang oras hanggang dalawa.",
    barangay: "Mambalite",
    reportedDaysAgo: 5,
    confirmations: 16,
    status: "reported",
    address: "Purok 1, Mambalite",
  },
  {
    category: "health",
    title: "Health center has no medicines for two months",
    description:
      "Demo data. Walang stock ng maintenance medicines sa health center. Pinapapunta kami sa provincial hospital.",
    barangay: "San Isidro",
    reportedDaysAgo: 75,
    confirmations: 34,
    status: "unfixed",
    address: "San Isidro Barangay Health Station",
  },
  {
    category: "streetlight",
    title: "Broken lamp post leaning over the sidewalk",
    description:
      "Demo data. Nakatagilid ang poste ng ilaw at nakabitin sa sidewalk. Puwedeng matumba kapag malakas ang hangin.",
    barangay: "Cobangbang (Carumpit)",
    reportedDaysAgo: 38,
    confirmations: 11,
    status: "confirmed",
    address: "National road, Cobangbang",
  },
  {
    category: "garbage",
    title: "Illegal dumping in the creek",
    description:
      "Demo data. May nagtatapon ng basura sa sapa tuwing gabi. Bumabara sa ilalim ng tulay.",
    barangay: "Pamorangon",
    reportedDaysAgo: 52,
    confirmations: 19,
    status: "confirmed",
    address: "Creek beside Pamorangon covered court",
  },
  {
    category: "water",
    title: "Water restored after 12 days",
    description:
      "Demo data. Naayos din ang linya pagkatapos ng 12 araw. Salamat sa mga kapitbahay na nag-confirm.",
    barangay: "Awitan",
    reportedDaysAgo: 40,
    fixedDaysAgo: 28,
    confirmations: 24,
    status: "fixed",
    address: "Purok 4, Awitan",
    water: { outageDaysAgo: 40, households: 15 },
  },
  {
    category: "road",
    title: "Road patched near the church",
    description: "Demo data. Nasemento na ang butas sa harap ng simbahan. Maayos na ang daan.",
    barangay: "Barangay VIII (Pob.)",
    reportedDaysAgo: 95,
    fixedDaysAgo: 60,
    confirmations: 15,
    status: "fixed",
    address: "Church Street, Barangay VIII",
  },
  {
    category: "drainage",
    title: "Canal desilted before the rainy season",
    description: "Demo data. Nilinis ang kanal noong bakasyon. Wala nang baha sa kanto.",
    barangay: "Calasgasan",
    reportedDaysAgo: 30,
    fixedDaysAgo: 22,
    confirmations: 8,
    status: "fixed",
    address: "Calasgasan barangay road",
  },
  {
    category: "streetlight",
    title: "Streetlight 'fixed' but dark again",
    description:
      "Demo data. Naayos noong nakaraan pero nawawala ulit ang ilaw. Bumalik ang dilim sa buong kalye.",
    barangay: "Bibirao",
    reportedDaysAgo: 70,
    fixedDaysAgo: 40,
    reopenedDaysAgo: 32,
    confirmations: 21,
    status: "reopened",
    address: "Bibirao national road, near the chapel",
  },
  {
    category: "other",
    title: "Stray dogs near the school gate",
    description:
      "Demo data. May mga ligaw na aso malapit sa gate tuwing umaga. Kinabahan ang mga magulang.",
    barangay: "Barangay I (Pob.)",
    reportedDaysAgo: 3,
    confirmations: 4,
    status: "reported",
    address: "Barangay I Elementary School",
  },
  {
    category: "road",
    title: "Sidewalk cracked and uneven",
    description:
      "Demo data. Malaking bitak sa sidewalk. Madulas kapag umuulan at may matatanda na nadapa na.",
    barangay: "Borabod",
    reportedDaysAgo: 11,
    confirmations: 7,
    status: "confirmed",
    address: "Borabod corner road",
  },
];

const RESIDENT_SEEDS = [
  { name: "Maria Reyes", email: "maria@example.com", barangay: "Lag-On", alias: "Neighbor from Lag-On", show: true },
  { name: "Jomar Dela Cruz", email: "jomar@example.com", barangay: "Bagasbas", alias: "Kapitbahay 2F", show: false },
  { name: "Ana Villanueva", email: "ana@example.com", barangay: "Barangay II (Pob.)", alias: "Neighbor 7K", show: false },
  { name: "Rafael Santos", email: "rafael@example.com", barangay: "Gubat", alias: "Neighbor from Gubat", show: true },
  { name: "Liza Mercado", email: "liza@example.com", barangay: "Magang", alias: "Kapitbahay 4M", show: false },
  { name: "Paolo Aquino", email: "paolo@example.com", barangay: "Mambalite", alias: "Neighbor 9Q", show: false },
  { name: "Grace Ocampo", email: "grace@example.com", barangay: "San Isidro", alias: "Neighbor 3B", show: false },
];

const MODERATOR = {
  name: "Daet Watch Moderator",
  email: process.env.SEED_MODERATOR_EMAIL ?? "moderator@daet.watch",
  phone: process.env.SEED_MODERATOR_PHONE ?? "09000000000",
  barangay: "Barangay I (Pob.)",
  alias: "Moderator",
};

async function main() {
  const started = Date.now();
  console.log("Daet Watch seed");
  console.log(`  cluster db: ${process.env.MONGODB_DB ?? "daet-watch"}`);
  console.log(`  photos: ${CLOUDINARY_READY ? "Cloudinary" : "placeholder service (Cloudinary not configured)"}`);

  await connectDb();

  // Indexes are part of the schema contract: a stale sparse index from an earlier
  // shape keeps failing writes that the current schema allows.
  await Promise.all([User.syncIndexes(), Issue.syncIndexes()]);

  console.log("  clearing seeded collections…");
  await Promise.all([
    Issue.deleteMany({}),
    IssueUpdate.deleteMany({}),
    Confirmation.deleteMany({}),
    FixVote.deleteMany({}),
    ReopenVote.deleteMany({}),
    Flag.deleteMany({}),
    ShareEvent.deleteMany({}),
    WaterSource.deleteMany({}),
    WaterTruckReport.deleteMany({}),
    RateLimit.deleteMany({}),
    Barangay.deleteMany({}),
    User.deleteMany({}),
  ]);

  // 1. Barangays ────────────────────────────────────────────────────────────
  const barangayDocs = await Barangay.insertMany(
    barangayFile.barangays.map((b) => ({
      name: b.name,
      psgcCode: b.psgcCode,
      municipality: "Daet",
      province: "Camarines Norte",
      centroid: { type: "Point", coordinates: [b.lng, b.lat] },
      areaSqkm: b.areaSqkm,
      verified: false,
    })),
    { timestamps: true },
  );
  const barangayByName = new Map(barangayDocs.map((b) => [b.name, b]));
  console.log(`  barangays: ${barangayDocs.length} (${barangayFile.source.publisher})`);

  // 2. People ───────────────────────────────────────────────────────────────
  const moderator = await User.create({
    name: MODERATOR.name,
    email: MODERATOR.email,
    phone: MODERATOR.phone,
    role: "moderator",
    barangayId: barangayByName.get(MODERATOR.barangay)?._id ?? null,
    displayAlias: MODERATOR.alias,
    showName: true,
    trustScore: 25,
  });

  const residents: UserDoc[] = [];
  for (const seed of RESIDENT_SEEDS) {
    const user = await User.create({
      name: seed.name,
      email: seed.email,
      role: "resident",
      barangayId: barangayByName.get(seed.barangay)?._id ?? null,
      displayAlias: seed.alias,
      showName: seed.show,
      trustScore: 4 + Math.floor(Math.random() * 18),
    });
    residents.push(user);
  }
  const residentAt = (index: number): UserDoc => {
    const found = residents[index % residents.length];
    if (!found) throw new Error("seed produced no residents");
    return found;
  };

  console.log(`  users: ${residents.length + 1} (1 moderator, ${residents.length} residents)`);

  // 3. Issues ───────────────────────────────────────────────────────────────
  const createdIssues: IssueDoc[] = [];

  for (const seed of SEED_ISSUES) {
    const barangay = barangayByName.get(seed.barangay);
    if (!barangay) {
      console.warn(`  ! unknown barangay "${seed.barangay}" — skipped`);
      continue;
    }

    const photoCount = seed.photos ?? 1;
    const photos: SeedPhoto[] = [];
    for (let i = 1; i <= photoCount; i += 1) {
      photos.push(await photoFor(seed.category, i));
    }

    const reporter = residentAt(createdIssues.length);

    // Jitter the pin inside the barangay so the map does not show a perfect grid.
    const [blng, blat] = barangay.centroid.coordinates;
    const jitter = () => (Math.random() - 0.5) * 0.008;

    const reportedAt = daysAgo(seed.reportedDaysAgo);
    const fixedAt = seed.fixedDaysAgo !== undefined ? daysAgo(seed.fixedDaysAgo) : null;
    const reopenedAt = seed.reopenedDaysAgo !== undefined ? daysAgo(seed.reopenedDaysAgo) : null;

    const issue = await Issue.create({
      slug: makeSlug(seed.category as never),
      title: seed.title,
      description: seed.description,
      category: seed.category,
      barangayId: barangay._id,
      location: { type: "Point", coordinates: [blng + jitter(), blat + jitter()] },
      addressText: seed.address,
      photos,
      reporterId: reporter._id,
      reportedAt,
      status: seed.status,
      confirmations: seed.confirmations,
      fixVotes: seed.status === "fixed" || seed.status === "reopened" ? FIX_THRESHOLD : 0,
      fixThreshold: FIX_THRESHOLD,
      fixedAt,
      reopenedAt,
      reopenCount: seed.status === "reopened" ? 1 : 0,
      flagCount: 0,
      waterDetails: seed.water
        ? {
            outageStartedAt: daysAgo(seed.water.outageDaysAgo),
            householdsAffectedEstimate: seed.water.households,
          }
        : null,
    });
    createdIssues.push(issue);

    // 4. Confirmations ─────────────────────────────────────────────────────
    const confirmers = residents.filter((r) => String(r._id) !== String(reporter._id)).slice(0, 3);
    const confirmationDocs = confirmers.map((u, i) => ({
      issueId: issue._id,
      userId: u._id,
      createdAt: daysAgo(Math.max(1, seed.reportedDaysAgo - i - 1)),
    }));
    if (confirmationDocs.length > 0) {
      await Confirmation.insertMany(confirmationDocs, { timestamps: false });
    }

    // 5. Fix votes + reopen votes ──────────────────────────────────────────
    if (seed.status === "fixed" || seed.status === "reopened") {
      await FixVote.insertMany(
        residents.slice(0, FIX_THRESHOLD).map((u, i) => ({
          issueId: issue._id,
          userId: u._id,
          round: 0,
          photoUrl: null,
          createdAt: new Date((fixedAt ?? reportedAt).getTime() - i * 3_600_000),
        })),
        { timestamps: false },
      );
    }
    if (seed.status === "reopened") {
      await ReopenVote.insertMany(
        residents.slice(0, FIX_THRESHOLD).map((u) => ({
          issueId: issue._id,
          userId: u._id,
          round: 1,
          reason: "Madilim pa rin — bumalik ang sira pagkatapos ng ilang araw.",
          photoUrl: null,
          createdAt: reopenedAt ?? daysAgo(1),
        })),
        { timestamps: false },
      );
    }

    // 6. Timeline ─────────────────────────────────────────────────────────
    const timeline: { issueId: unknown; authorId: unknown; type: UpdateType; text: string; photos: SeedPhoto[]; createdAt: Date }[] = [
      {
        issueId: issue._id,
        authorId: reporter._id,
        type: "reported" as const,
        text: seed.description,
        photos,
        createdAt: reportedAt,
      },
    ];
    if (seed.confirmations > 0) {
      timeline.push({
        issueId: issue._id,
        authorId: confirmers[0]?._id ?? reporter._id,
        type: "confirmed" as const,
        text: "Apektado rin kami dito. Kinukumpirma ko.",
        photos: [],
        createdAt: daysAgo(Math.max(1, seed.reportedDaysAgo - 2)),
      });
    }
    if (seed.status === "fixed" || seed.status === "reopened") {
      timeline.push({
        issueId: issue._id,
        authorId: residentAt(2)._id,
        type: "fixed" as const,
        text: "Naayos na. Tatlong kapitbahay ang nag-confirm.",
        photos: [],
        createdAt: fixedAt ?? reportedAt,
      });
    }
    if (seed.status === "reopened" && reopenedAt) {
      timeline.push({
        issueId: issue._id,
        authorId: residentAt(3)._id,
        type: "reopened" as const,
        text: "Bumalik ang problema. Binuksan muli ng komunidad.",
        photos: [],
        createdAt: reopenedAt,
      });
    }
    await IssueUpdate.insertMany(timeline, { timestamps: false });

    await Issue.updateOne({ _id: issue._id }, { $set: { createdAt: reportedAt, updatedAt: reopenedAt ?? fixedAt ?? reportedAt } });
  }

  console.log(`  issues: ${createdIssues.length}`);

  // 7. Water sources ────────────────────────────────────────────────────────
  const waterSeeds = [
    { name: "Lag-On Refill Station", type: "refill_station", barangay: "Lag-On", status: "has_water", hoursAgo: 2 },
    { name: "Gubat Deep Well 2", type: "deep_well", barangay: "Gubat", status: "empty", hoursAgo: 6 },
    { name: "Magang Public Tap", type: "public_tap", barangay: "Magang", status: "low", hoursAgo: 30 },
    { name: "Awitan Spring", type: "spring", barangay: "Awitan", status: "has_water", hoursAgo: 54 },
    { name: "Bagasbas Road Refilling", type: "refill_station", barangay: "Bagasbas", status: "has_water", hoursAgo: 1 },
    { name: "Barangay II Artesian Well", type: "deep_well", barangay: "Barangay II (Pob.)", status: "low", hoursAgo: 12 },
    { name: "Calasgasan Public Tap", type: "public_tap", barangay: "Calasgasan", status: "unknown", hoursAgo: null },
    { name: "San Isidro Deep Well", type: "deep_well", barangay: "San Isidro", status: "has_water", hoursAgo: 20 },
  ];

  const waterDocs = [];
  for (const seed of waterSeeds) {
    const barangay = barangayByName.get(seed.barangay);
    if (!barangay) continue;
    const [blng, blat] = barangay.centroid.coordinates;
    waterDocs.push({
      name: seed.name,
      type: seed.type,
      loc: {
        type: "Point",
        coordinates: [blng + (Math.random() - 0.5) * 0.006, blat + (Math.random() - 0.5) * 0.006],
      },
      barangayId: barangay._id,
      status: seed.status,
      lastConfirmedAt: seed.hoursAgo === null ? null : new Date(now - seed.hoursAgo * 3_600_000),
      confirmations:
        seed.hoursAgo === null
          ? []
          : [
              {
                userId: residentAt(0)._id,
                status: seed.status,
                at: new Date(now - seed.hoursAgo * 3_600_000),
              },
            ],
      createdBy: moderator._id,
    });
  }

  await WaterSource.insertMany(
    waterDocs.map(({ loc, ...rest }) => ({ ...rest, location: loc })),
  );

  await WaterTruckReport.insertMany(
    [
      { barangayId: barangayByName.get("Gubat")?._id, spottedAt: daysAgo(0), note: "Dalawang truck sa covered court, 9am", reportedBy: residentAt(3)._id },
      { barangayId: barangayByName.get("Lag-On")?._id, spottedAt: daysAgo(1), note: "Isang truck lang, ubos agad", reportedBy: residentAt(0)._id },
    ].filter((r) => Boolean(r.barangayId)),
  );

  console.log(`  water sources: ${waterDocs.length}, truck reports: 2`);

  // A moderator queue with nothing in it is a screen nobody has tested. Two
  // unresolved flags put one seeded issue in front of a moderator without hiding
  // it (auto-hide needs three).
  const flaggedIssue = createdIssues.find((issue) => issue.title.startsWith("Illegal dumping"));
  if (flaggedIssue) {
    await Flag.insertMany([
      { issueId: flaggedIssue._id, userId: residentAt(4)._id, reason: "duplicate", note: "May existing report sa creek." },
      { issueId: flaggedIssue._id, userId: residentAt(5)._id, reason: "other", note: "Hindi sure kung dito talaga." },
    ]);
    await Issue.updateOne({ _id: flaggedIssue._id }, { $set: { flagCount: 2 } });
    console.log("  moderator queue: 1 seeded issue with 2 unresolved flags");
  }
  console.log(`  moderator sign-in (demo phone login): ${MODERATOR.email}`);
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  const { default: mongoose } = await import("mongoose");
  await mongoose.connection.close();
}

await main();
