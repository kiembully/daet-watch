import { describe, expect, it } from "vitest";

import {
  canReopen,
  daysToFix,
  daysUnfixed,
  dayTone,
  distanceMeters,
  fixProgress,
  mergeReportedAt,
  milestoneFor,
  shouldAutoHide,
  waterIsStale,
} from "@/lib/rules";

const DAY = 86_400_000;
const now = new Date("2026-11-03T08:00:00+08:00");

describe("daysUnfixed", () => {
  it("counts whole 24h periods", () => {
    expect(daysUnfixed(new Date(now.getTime() - 7 * DAY), now)).toBe(7);
    expect(daysUnfixed(new Date(now.getTime() - 7 * DAY + 3_600_000), now)).toBe(6);
  });

  it("never returns a negative number for a future timestamp", () => {
    expect(daysUnfixed(new Date(now.getTime() + 5 * DAY), now)).toBe(0);
  });

  it("is monotonic with reportedAt, which is why 'longest' can sort on it", () => {
    const older = daysUnfixed(new Date(now.getTime() - 40 * DAY), now);
    const newer = daysUnfixed(new Date(now.getTime() - 2 * DAY), now);
    expect(older).toBeGreaterThan(newer);
  });

  it("freezes once fixed: the fixed counter is reportedAt → fixedAt", () => {
    const reportedAt = new Date(now.getTime() - 47 * DAY);
    const fixedAt = new Date(now.getTime() - 2 * DAY);
    expect(daysToFix(reportedAt, fixedAt)).toBe(45);
  });
});

describe("dayTone", () => {
  it("uses the published bands: 0–7 neutral, 8–30 amber, 31+ red", () => {
    expect(dayTone(0)).toBe("neutral");
    expect(dayTone(7)).toBe("neutral");
    expect(dayTone(8)).toBe("amber");
    expect(dayTone(30)).toBe("amber");
    expect(dayTone(31)).toBe("red");
    expect(dayTone(365)).toBe("red");
  });
});

describe("fixProgress", () => {
  it("flips only at the threshold of distinct votes", () => {
    expect(fixProgress(2, 3)).toMatchObject({ reached: false, remaining: 1, votes: 2, target: 3 });
    expect(fixProgress(3, 3)).toMatchObject({ reached: true, remaining: 0 });
  });

  it("one vote is never enough", () => {
    expect(fixProgress(1, 3).reached).toBe(false);
  });

  it("clamps a vote count above the threshold instead of overflowing the bar", () => {
    expect(fixProgress(9, 3)).toMatchObject({ votes: 3, ratio: 1, reached: true });
  });
});

describe("reopening", () => {
  const fixedAt = new Date(now.getTime() - 10 * DAY);

  it("is allowed inside the 60-day window", () => {
    expect(canReopen(fixedAt, "fixed", now)).toBe(true);
  });

  it("is refused once the window has closed", () => {
    const oldFix = new Date(now.getTime() - 61 * DAY);
    expect(canReopen(oldFix, "fixed", now)).toBe(false);
  });

  it("is refused for an issue that is not fixed", () => {
    expect(canReopen(fixedAt, "reopened", now)).toBe(false);
  });
});

describe("mergeReportedAt", () => {
  it("keeps the OLDEST report date so merging never resets the counter", () => {
    const older = new Date(now.getTime() - 90 * DAY);
    const newer = new Date(now.getTime() - 5 * DAY);
    expect(mergeReportedAt(newer, older).getTime()).toBe(older.getTime());
    expect(mergeReportedAt(older, newer).getTime()).toBe(older.getTime());
  });
});

describe("dedupe distance", () => {
  it("measures two points ~100m apart as within the suggestion radius", () => {
    const a: [number, number] = [122.95393, 14.10793];
    const b: [number, number] = [122.95483, 14.10793];
    const metres = distanceMeters(a, b);
    expect(metres).toBeGreaterThan(90);
    expect(metres).toBeLessThan(110);
  });

  it("does not confuse two barangays for the same pin", () => {
    const pin: [number, number] = [122.95393, 14.10793];
    const bagasbas: [number, number] = [122.9999, 14.1296];
    expect(distanceMeters(pin, bagasbas)).toBeGreaterThan(5000);
  });
});

describe("flags and staleness", () => {
  it("auto-hides at exactly three community flags", () => {
    expect(shouldAutoHide(2)).toBe(false);
    expect(shouldAutoHide(3)).toBe(true);
  });

  it("marks a water report stale after 48 hours", () => {
    expect(waterIsStale(new Date(now.getTime() - 47 * 3_600_000), now)).toBe(false);
    expect(waterIsStale(new Date(now.getTime() - 49 * 3_600_000), now)).toBe(true);
    expect(waterIsStale(null, now)).toBe(true);
  });
});

describe("milestones", () => {
  it("only nudges on the published days", () => {
    expect(milestoneFor(7)).toBe(7);
    expect(milestoneFor(30)).toBe(30);
    expect(milestoneFor(31)).toBeNull();
  });
});
