"use client";

import Dexie, { type Table } from "dexie";

/**
 * Offline-first draft store. A report is written here BEFORE any network call,
 * including its compressed photos as data URLs — a phone that loses signal
 * mid-report must not lose the report.
 */

export type DraftStatus = "pending" | "uploading" | "error";

export interface DraftPhoto {
  dataUrl: string;
  width: number;
  height: number;
  name: string;
}

export interface DraftReport {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: DraftStatus;
  lastError: string | null;
  title: string;
  description: string;
  category: string;
  barangayId: string;
  barangayName: string;
  addressText: string;
  lat: number;
  lng: number;
  photos: DraftPhoto[];
  waterDetails: { outageStartedAt: string | null; householdsAffectedEstimate: number | null } | null;
}

class DaetWatchDb extends Dexie {
  drafts!: Table<DraftReport, string>;

  constructor() {
    super("daet-watch");
    this.version(1).stores({
      drafts: "id, createdAt, status",
    });
  }
}

let instance: DaetWatchDb | null = null;

export function db(): DaetWatchDb {
  if (!instance) instance = new DaetWatchDb();
  return instance;
}

export function newDraftId(): string {
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveDraft(draft: DraftReport): Promise<void> {
  await db().drafts.put(draft);
}

export async function deleteDraft(id: string): Promise<void> {
  await db().drafts.delete(id);
}

export async function listDrafts(): Promise<DraftReport[]> {
  return db().drafts.orderBy("createdAt").reverse().toArray();
}

export async function countPendingDrafts(): Promise<number> {
  return db().drafts.where("status").anyOf("pending", "error").count();
}
