export function timeAgo(iso: string, locale: "en" | "fil" = "en", now = Date.now()): string {
  const then = new Date(iso).getTime();
  const minutes = Math.max(0, Math.round((now - then) / 60_000));

  if (minutes < 1) return locale === "fil" ? "ngayon lang" : "just now";
  if (minutes < 60) {
    return locale === "fil" ? `${minutes}m ang nakalipas` : `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) return locale === "fil" ? `${hours}h ang nakalipas` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return locale === "fil" ? `${days} araw` : `${days}d ago`;
  const months = Math.round(days / 30);
  return locale === "fil" ? `${months} buwan` : `${months}mo ago`;
}

export function shortDate(iso: string, locale: "en" | "fil" = "en"): string {
  return new Intl.DateTimeFormat(locale === "fil" ? "fil-PH" : "en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

export function hoursLabel(hours: number | null, locale: "en" | "fil" = "en"): string {
  if (hours === null) return locale === "fil" ? "hindi pa kumpirmado" : "unconfirmed";
  if (hours < 1) return locale === "fil" ? "ngayon lang" : "just now";
  if (hours < 24) return locale === "fil" ? `${hours}h ang nakalipas` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return locale === "fil" ? `${days} araw` : `${days}d ago`;
}

export function pluralDays(n: number, locale: "en" | "fil" = "en"): string {
  if (locale === "fil") return `${n} araw`;
  return `${n} ${n === 1 ? "day" : "days"}`;
}
