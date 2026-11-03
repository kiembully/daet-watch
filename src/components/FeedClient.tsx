"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IssueCard, IssueCardSkeleton } from "@/components/issue";
import { useI18n } from "@/components/Providers";
import { SpinnerIcon } from "@/components/icons";
import type { PublicIssue } from "@/lib/dto";
import { apiGet, type ListEnvelope } from "@/lib/api-client";
import { CATEGORIES, type Category } from "@/lib/rules";

type Sort = "longest" | "newest" | "fixed";

interface FeedResponse extends ListEnvelope<PublicIssue> {
  items: PublicIssue[];
}

export function FeedClient({
  initial,
  initialCursor,
  barangays,
}: {
  initial: PublicIssue[];
  initialCursor: string | null;
  barangays: { id: string; name: string }[];
}) {
  const { t } = useI18n();

  const [sort, setSort] = useState<Sort>("longest");
  const [category, setCategory] = useState<Category | null>(null);
  const [barangay, setBarangay] = useState<string | null>(null);

  const [items, setItems] = useState<PublicIssue[]>(initial);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(initialCursor === null);
  const [error, setError] = useState<string | null>(null);

  const sentinel = useRef<HTMLDivElement | null>(null);
  const firstRun = useRef(true);
  const pullStart = useRef<number | null>(null);
  const [pull, setPull] = useState(0);

  const query = useCallback(
    (nextCursor?: string | null) => {
      const params = new URLSearchParams({ sort, limit: "10" });
      params.set("status", sort === "fixed" ? "fixed" : "open");
      if (category) params.set("category", category);
      if (barangay) params.set("barangay", barangay);
      if (nextCursor) params.set("cursor", nextCursor);
      return apiGet<FeedResponse>(`/api/issues?${params.toString()}`);
    },
    [sort, category, barangay],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await query(null);
      setItems(data.items);
      setCursor(data.nextCursor);
      setDone(data.nextCursor === null);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [query, t.common.error]);

  // Refetch when the filters change — but not on the very first mount, where
  // the server already handed us the correct first page.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const data = await query(cursor);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(data.nextCursor);
      setDone(data.nextCursor === null);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, query, t.common.error]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, loadMore]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await query(null);
      setItems(data.items);
      setCursor(data.nextCursor);
      setDone(data.nextCursor === null);
    } catch {
      /* keep what is on screen; the offline banner is the explanation */
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [query]);

  const onTouchStart = (event: React.TouchEvent) => {
    if (window.scrollY <= 0) pullStart.current = event.touches[0]?.clientY ?? null;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (pullStart.current === null) return;
    const delta = (event.touches[0]?.clientY ?? 0) - pullStart.current;
    if (delta > 0 && window.scrollY <= 0) setPull(Math.min(90, delta * 0.55));
  };

  const onTouchEnd = () => {
    if (pull > 56) void refresh();
    else setPull(0);
    pullStart.current = null;
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden text-xs font-semibold text-muted transition-[height]"
        style={{ height: pull || (refreshing ? 40 : 0) }}
        aria-hidden
      >
        {refreshing ? <SpinnerIcon size={16} /> : pull > 56 ? t.feed.loadMore : t.feed.pull}
      </div>

      {/* sort tabs */}
      <div role="tablist" aria-label="Sort" className="sticky top-14 z-20 bg-paper/95 backdrop-blur">
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 pt-1">
          {([
            ["longest", t.feed.tabLongest],
            ["newest", t.feed.tabNewest],
            ["fixed", t.feed.tabFixed],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={sort === key}
              onClick={() => setSort(key)}
              className={`press shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold ${
                sort === key ? "bg-ink text-paper" : "bg-surface text-body border border-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* category chips */}
        <div className="relative">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2">
            <button
              onClick={() => setCategory(null)}
              className={`press shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                category === null ? "border-ink bg-ink text-paper" : "border-line bg-surface text-body"
              }`}
            >
              {t.feed.all}
            </button>
            {CATEGORIES.map((key) => (
              <button
                key={key}
                onClick={() => setCategory(category === key ? null : key)}
                aria-pressed={category === key}
                className={`press shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  category === key ? "border-ink bg-ink text-paper" : "border-line bg-surface text-body"
                }`}
              >
                {t.categories[key]}
              </button>
            ))}
          </div>
          {/* scroll affordance: the chips genuinely continue off-screen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper to-transparent"
          />
        </div>

        {/* barangay filter */}
        <div className="px-3 pb-2">
          <label className="sr-only" htmlFor="barangay-filter">
            {t.feed.filterBarangay}
          </label>
          <select
            id="barangay-filter"
            value={barangay ?? ""}
            onChange={(event) => setBarangay(event.target.value || null)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-body"
          >
            <option value="">{`${t.feed.filterBarangay}: ${t.feed.all}`}</option>
            {barangays.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 px-3 pt-1">
        {items.map((issue, index) => (
          <IssueCard key={issue.id} issue={issue} priority={index === 0} />
        ))}

        {loading && items.length === 0
          ? Array.from({ length: 3 }).map((_, i) => <IssueCardSkeleton key={i} />)
          : null}

        {items.length === 0 && !loading ? (
          <div className="card p-6 text-center">
            <p className="text-sm font-semibold text-ink">{t.feed.empty}</p>
            <a
              href="/report"
              className="press mt-3 inline-block rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink"
            >
              {t.report.title}
            </a>
          </div>
        ) : null}

        {error ? <p className="py-3 text-center text-xs text-muted">{error}</p> : null}

        {!done ? (
          <div ref={sentinel} className="flex justify-center py-4 text-muted">
            {loading ? <SpinnerIcon size={20} /> : null}
          </div>
        ) : items.length > 0 ? (
          <p className="py-4 text-center text-xs text-muted">{t.feed.end}</p>
        ) : null}
      </div>
    </div>
  );
}
