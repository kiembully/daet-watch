"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ChevronLeftIcon, HomeIcon, MapIcon, DropletIcon, PlusIcon, UserIcon } from "@/components/icons";
import { useI18n } from "@/components/Providers";

/** Sticky app bar. Each screen renders its own, so the title and the context
 *  actions belong to the screen rather than to a shared guess from the path. */
export function AppBar({
  title,
  subtitle,
  back,
  actions,
  transparent = false,
}: {
  title: string;
  subtitle?: string;
  back?: string | false;
  actions?: ReactNode;
  transparent?: boolean;
}) {
  return (
    <header
      className={`sticky top-0 z-30 safe-top ${
        transparent
          ? "bg-paper/80 supports-[backdrop-filter]:bg-paper/60 backdrop-blur-md"
          : "bg-paper/95 backdrop-blur-md border-b border-line"
      }`}
    >
      <div className="flex min-h-14 items-center gap-2 px-3">
        {back ? (
          <Link
            href={back}
            aria-label="Back"
            className="press -ml-1 grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2"
          >
            <ChevronLeftIcon size={22} />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1 py-2">
          <h1 className="truncate text-[17px] font-bold leading-tight tracking-tight text-ink">
            {title}
          </h1>
          {subtitle ? (
            <p className="truncate text-xs text-muted">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
    </header>
  );
}

const TABS: { href: string; key: "home" | "map" | "report" | "water" | "profile"; Icon: typeof HomeIcon; primary?: boolean }[] = [
  { href: "/", key: "home", Icon: HomeIcon },
  { href: "/map", key: "map", Icon: MapIcon },
  { href: "/report", key: "report", Icon: PlusIcon, primary: true },
  { href: "/water", key: "water", Icon: DropletIcon },
  { href: "/profile", key: "profile", Icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  // The report flow is full-screen; it has its own footer controls.
  if (pathname.startsWith("/report")) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="grid grid-cols-5 items-end px-1 pt-1">
        {TABS.map(({ href, key, Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const label = t.nav[key];

          if (primary) {
            return (
              <li key={href} className="flex justify-center">
                <Link
                  href={href}
                  aria-label={label}
                  className="press -mt-5 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg shadow-accent/25 ring-4 ring-paper"
                >
                  <PlusIcon size={26} />
                </Link>
              </li>
            );
          }

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`press flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                <Icon size={22} />
                <span className="leading-none">{label}</span>
                <span
                  className={`mt-0.5 h-0.5 w-6 rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
