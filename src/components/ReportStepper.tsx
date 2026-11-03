"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MapView } from "@/components/MapView";
import { useFeedback } from "@/components/Feedback";
import { useI18n } from "@/components/Providers";
import { CameraIcon, ChevronLeftIcon, CloseIcon, PinIcon, SpinnerIcon } from "@/components/icons";
import { apiGet, apiSend } from "@/lib/api-client";
import type { PublicIssue } from "@/lib/dto";
import { compressToDraftPhoto } from "@/lib/image";
import { newDraftId, saveDraft, countPendingDrafts, type DraftPhoto, type DraftReport } from "@/lib/offline/db";
import { flushQueue } from "@/lib/offline/queue";
import { CATEGORIES, distanceMeters, DEDUPE_RADIUS_M, type Category } from "@/lib/rules";

interface BarangayOption {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

const DAET_CENTRE = { lat: 14.10793, lng: 122.95393 };
const STEPS = 6;

export function ReportStepper({
  barangays,
  signedIn,
}: {
  barangays: BarangayOption[];
  signedIn: boolean;
}) {
  const { t, tr } = useI18n();
  const { notify } = useFeedback();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [barangayId, setBarangayId] = useState<string>("");
  const [addressText, setAddressText] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [outageStartedAt, setOutageStartedAt] = useState("");
  const [households, setHouseholds] = useState("");
  const [nearby, setNearby] = useState<PublicIssue[]>([]);
  const [queued, setQueued] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [locating, setLocating] = useState(false);

  const draftId = useRef(newDraftId());

  const nearestBarangay = useMemo(() => {
    if (!position || barangays.length === 0) return null;
    let best: { id: string; name: string; distance: number } | null = null;
    for (const b of barangays) {
      const distance = distanceMeters([position.lng, position.lat], [b.lng, b.lat]);
      if (!best || distance < best.distance) best = { id: b.id, name: b.name, distance };
    }
    return best;
  }, [position, barangays]);

  // The nearest barangay is a suggestion, never a silent decision: it is the
  // default the picker shows until the resident chooses one themselves.
  const effectiveBarangayId = barangayId || nearestBarangay?.id || "";

  useEffect(() => {
    void countPendingDrafts().then(setQueued);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setPosition((prev) => prev ?? { lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const persistDraft = useCallback(async () => {
    const barangay = barangays.find((b) => b.id === effectiveBarangayId);
    const draft: DraftReport = {
      id: draftId.current,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "pending",
      lastError: null,
      title,
      description,
      category: category ?? "other",
      barangayId: effectiveBarangayId,
      barangayName: barangay?.name ?? "",
      addressText,
      lat: position?.lat ?? DAET_CENTRE.lat,
      lng: position?.lng ?? DAET_CENTRE.lng,
      photos,
      waterDetails:
        category === "water"
          ? {
              outageStartedAt: outageStartedAt ? new Date(outageStartedAt).toISOString() : null,
              householdsAffectedEstimate: households ? Number(households) : null,
            }
          : null,
    };
    await saveDraft(draft);
  }, [
    addressText,
    effectiveBarangayId,
    barangays,
    category,
    description,
    households,
    outageStartedAt,
    photos,
    position,
    title,
  ]);

  // Every step boundary is a save point, so a dead battery costs one step.
  useEffect(() => {
    if (step < 3) return;
    const timer = window.setTimeout(() => void persistDraft(), 600);
    return () => window.clearTimeout(timer);
  }, [step, persistDraft]);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    setBusy("photo");
    try {
      const next: DraftPhoto[] = [];
      for (const file of Array.from(files).slice(0, 4 - photos.length)) {
        next.push(await compressToDraftPhoto(file));
      }
      setPhotos((prev) => [...prev, ...next].slice(0, 4));
    } catch {
      notify(t.common.error, { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        notify(t.report.gpsDenied, { tone: "error" });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const checkDuplicates = async () => {
    if (!position || !category) return;
    setBusy("dupe");
    try {
      const data = await apiGet<{ items: PublicIssue[] }>(
        `/api/issues/nearby?lat=${position.lat}&lng=${position.lng}&radius=${DEDUPE_RADIUS_M}&category=${category}`,
      );
      setNearby(data.items);
    } catch {
      setNearby([]);
    } finally {
      setBusy(null);
    }
  };

  const joinExisting = async (issue: PublicIssue) => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/issue/${issue.slug}`)}`);
      return;
    }
    setBusy("join");
    try {
      await apiSend(`/api/issues/${issue.slug}/confirm`, "POST", {});
      router.push(`/issue/${issue.slug}`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t.common.error, { tone: "error" });
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!signedIn) {
      await persistDraft();
      router.push(`/login?next=${encodeURIComponent("/report")}`);
      return;
    }
    setBusy("submit");

    if (!navigator.onLine) {
      await persistDraft();
      setSavedOffline(true);
      setBusy(null);
      setQueued(await countPendingDrafts());
      return;
    }

    try {
      await persistDraft();
      const result = await flushQueue();
      if (result.sent > 0) {
        router.push("/");
        return;
      }
      setSavedOffline(true);
      setQueued(result.remaining);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t.common.error, { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const canAdvance = () => {
    if (step === 1) return Boolean(category);
    if (step === 2) return photos.length > 0;
    if (step === 3) return Boolean(position && effectiveBarangayId);
    if (step === 4) return title.trim().length >= 6 && description.trim().length >= 15;
    return true;
  };

  const next = async () => {
    if (step === 1 && !category) return notify(t.report.selectCategory, { tone: "error" });
    if (step === 2 && photos.length === 0) return notify(t.report.needPhoto, { tone: "error" });
    if (step === 3 && (!position || !effectiveBarangayId))
      return notify(t.report.needLocation, { tone: "error" });
    if (step === 4 && title.trim().length < 6) return notify(t.report.needTitle, { tone: "error" });

    if (step === 4) {
      setStep(5);
      void checkDuplicates();
      return;
    }
    setStep((prev) => Math.min(STEPS, prev + 1));
  };

  const categoryLabels: Record<Category, string> = t.categories;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* progress */}
      <div className="sticky top-0 z-30 safe-top bg-paper/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => (step === 1 ? router.back() : setStep(step - 1))}
            aria-label={t.report.back}
            className="press grid size-10 place-items-center rounded-full text-ink"
          >
            <ChevronLeftIcon size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted">
              {tr(t.report.step, { n: step, total: STEPS })}
            </p>
            <p className="truncate text-sm font-bold text-ink">
              {step === 1 && t.report.stepCategory}
              {step === 2 && t.report.stepPhoto}
              {step === 3 && t.report.stepLocation}
              {step === 4 && t.report.stepDetails}
              {step === 5 && t.report.stepDuplicate}
              {step === 6 && t.report.stepReview}
            </p>
          </div>
        </div>
        <div className="h-1 w-full bg-surface-2">
          <div
            className="h-full bg-accent transition-[width]"
            style={{ width: `${(step / STEPS) * 100}%` }}
          />
        </div>
      </div>

      {queued > 0 ? (
        <p className="mx-3 mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold text-body">
          {tr(t.report.offlineQueue, { n: queued })}
        </p>
      ) : null}

      <div className="flex-1 px-3 py-3">
        {step === 1 ? (
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                aria-pressed={category === key}
                className={`press flex min-h-20 flex-col items-start justify-between rounded-xl border p-3 text-left ${
                  category === key
                    ? "border-accent bg-accent/10"
                    : "border-line bg-surface"
                }`}
              >
                <span className="text-sm font-bold text-ink">{categoryLabels[key]}</span>
                <span className="text-[11px] text-muted">{t.report.categoryHint}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo) => (
                <div key={photo.dataUrl.slice(-24)} className="relative overflow-hidden rounded-xl">
                  <img src={photo.dataUrl} alt="" className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((p) => p !== photo))}
                    aria-label={t.common.cancel}
                    className="press absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-black/60 text-white"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
              ))}
              {photos.length < 4 ? (
                <label className="press flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong text-muted">
                  {busy === "photo" ? <SpinnerIcon size={22} /> : <CameraIcon size={26} />}
                  <span className="text-xs font-semibold">{t.report.takePhoto}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      void addPhotos(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted">{t.report.photoHint}</p>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="overflow-hidden rounded-xl border border-line">
              <MapView
                points={[]}
                center={position ?? DAET_CENTRE}
                zoom={position ? 16 : 13}
                draggable={position}
                onDrag={(lat, lng) => setPosition({ lat, lng })}
                onPick={(lat, lng) => setPosition({ lat, lng })}
                className="h-72 w-full"
              />
            </div>
            <button
              type="button"
              onClick={locate}
              className="press mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-bold text-body"
            >
              {locating ? <SpinnerIcon size={16} /> : <PinIcon size={18} />}
              {locating ? t.report.locating : t.report.useGps}
            </button>

            <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-muted">
              {t.report.barangay}
            </label>
            <select
              value={effectiveBarangayId}
              onChange={(event) => setBarangayId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-body"
            >
              <option value="">—</option>
              {barangays.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {nearestBarangay ? (
              <p className="mt-1 text-[11px] text-muted">
                Nearest: {nearestBarangay.name} · {Math.round(nearestBarangay.distance)} m
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted" htmlFor="title">
                {t.report.titlePlaceholder}
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder={t.report.titlePlaceholder}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-body"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted" htmlFor="description">
                {t.report.descriptionPlaceholder}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={t.report.descriptionPlaceholder}
                className="mt-1 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-body"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted" htmlFor="address">
                {t.report.addressPlaceholder}
              </label>
              <input
                id="address"
                value={addressText}
                onChange={(event) => setAddressText(event.target.value)}
                maxLength={160}
                placeholder={t.report.addressPlaceholder}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-body"
              />
            </div>

            {category === "water" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-muted" htmlFor="outage">
                    {t.report.waterStarted}
                  </label>
                  <input
                    id="outage"
                    type="date"
                    value={outageStartedAt}
                    onChange={(event) => setOutageStartedAt(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-body"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-muted" htmlFor="households">
                    {t.report.households}
                  </label>
                  <input
                    id="households"
                    type="number"
                    inputMode="numeric"
                    value={households}
                    onChange={(event) => setHouseholds(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-body"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 5 ? (
          <div>
            <p className="text-sm font-semibold text-ink">{t.report.duplicateIntro}</p>
            {busy === "dupe" ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                <SpinnerIcon size={16} /> {t.common.loading}
              </div>
            ) : nearby.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t.report.nearbyNone}</p>
            ) : (
              <div className="mt-2 space-y-2">
                {nearby.map((issue) => (
                  <div key={issue.id} className="flex gap-2 rounded-xl border border-line bg-surface p-2">
                    {issue.photos[0] ? (
                      <img
                        src={issue.photos[0].url}
                        alt=""
                        className="size-16 shrink-0 rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-ink">{issue.title}</p>
                      <p className="text-[11px] text-muted">
                        {issue.barangay?.name} · {issue.days} {t.issue.days}
                      </p>
                      <button
                        type="button"
                        onClick={() => joinExisting(issue)}
                        disabled={busy !== null}
                        className="press mt-1 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-bold text-paper"
                      >
                        {t.report.sameIssue}
                      </button>
                    </div>
                  </div>
                ))}
                <Link
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setStep(6);
                  }}
                  className="press block rounded-xl border border-line bg-surface px-3 py-3 text-center text-sm font-bold text-body"
                >
                  {t.report.differentIssue}
                </Link>
              </div>
            )}
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {photos[0] ? (
                <img src={photos[0].dataUrl} alt="" className="aspect-[16/10] w-full object-cover" />
              ) : null}
              <div className="p-3">
                <p className="text-sm font-bold text-ink">{title}</p>
                <p className="mt-1 text-xs text-muted">
                  {category ? categoryLabels[category] : ""} ·{" "}
                  {barangays.find((b) => b.id === effectiveBarangayId)?.name}
                </p>
                <p className="mt-2 line-clamp-4 text-sm text-body">{description}</p>
              </div>
            </div>

            {savedOffline ? (
              <p className="rounded-xl bg-surface-2 p-3 text-sm font-semibold text-body">
                {t.report.offlineSaved}
              </p>
            ) : null}
            <p className="text-[11px] leading-relaxed text-muted">
              {t.issue.disclaimer} Your name stays hidden unless you turn it on in Profile.
            </p>
          </div>
        ) : null}
      </div>

      {/* footer */}
      <div className="sticky bottom-0 border-t border-line bg-paper/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur">
        {step < STEPS ? (
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance() || busy !== null}
            className="press min-h-12 w-full rounded-xl bg-ink text-sm font-bold text-paper disabled:opacity-40"
          >
            {step === 5 ? t.report.differentIssue : t.report.next}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={busy !== null || savedOffline}
            className="press min-h-12 w-full rounded-xl bg-accent text-sm font-bold text-accent-ink disabled:opacity-50"
          >
            {busy === "submit" ? <SpinnerIcon size={16} /> : t.report.submit}
          </button>
        )}
      </div>
    </div>
  );
}
