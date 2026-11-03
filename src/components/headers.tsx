"use client";

import type { ReactNode } from "react";

import { AppBar } from "@/components/Shell";
import { useI18n } from "@/components/Providers";

export function HomeHeader() {
  const { t } = useI18n();
  return <AppBar title={t.feed.title} subtitle={t.appTagline} />;
}

export function MapHeader() {
  const { t } = useI18n();
  return <AppBar title={t.map.title} subtitle={t.appTagline} />;
}

export function WaterHeader() {
  const { t } = useI18n();
  return <AppBar title={t.water.title} subtitle={t.water.subtitle} />;
}

export function ProfileHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useI18n();
  return <AppBar title={t.profile.title} actions={actions} />;
}

export function LeaderboardHeader() {
  const { t } = useI18n();
  return <AppBar title={t.leaderboard.title} back="/profile" />;
}

export function ModHeader() {
  const { t } = useI18n();
  return <AppBar title={t.mod.title} back="/profile" />;
}

export function LoginHeader() {
  const { t } = useI18n();
  return <AppBar title={t.login.title} back="/" />;
}

export function StatusHeader() {
  return <AppBar title="Status" subtitle="Daet Watch health" back="/" />;
}
