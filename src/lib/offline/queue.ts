"use client";

import { apiSend } from "@/lib/api-client";
import { listDrafts, saveDraft, deleteDraft, type DraftPhoto } from "@/lib/offline/db";

interface SignResponse {
  item: {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
  };
}

export interface UploadedPhoto {
  url: string;
  width: number;
  height: number;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head ?? "")?.[1] ?? "image/jpeg";
  const binary = atob(body ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Signed direct upload: the bytes never pass through a Vercel function, so the
 * platform's ~4.5 MB request cap cannot silently refuse a photo.
 */
export async function uploadPhoto(photo: DraftPhoto): Promise<UploadedPhoto> {
  const signed = await apiSend<SignResponse>("/api/uploads/sign", "POST", {});

  const form = new FormData();
  form.set("file", dataUrlToBlob(photo.dataUrl), photo.name || "report.jpg");
  form.set("api_key", signed.item.apiKey);
  form.set("timestamp", String(signed.item.timestamp));
  form.set("folder", signed.item.folder);
  form.set("signature", signed.item.signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.item.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed (${response.status}): ${text.slice(0, 160)}`);
  }

  const body = (await response.json()) as { secure_url?: string; width?: number; height?: number };
  if (!body.secure_url) throw new Error("Upload failed: no url returned");

  return {
    // Deliver a webp at a bounded width — the report card never needs the original.
    url: body.secure_url.replace("/image/upload/", "/image/upload/f_auto,q_auto,w_1200/"),
    width: body.width ?? photo.width,
    height: body.height ?? photo.height,
  };
}

let flushing = false;

/** Single-flight: a sync event, an `online` event and a focus event can all land
 *  at the same time, and three flushes would triple-post the same draft. */
export async function flushQueue(): Promise<{ sent: number; failed: number; remaining: number }> {
  if (flushing) return { sent: 0, failed: 0, remaining: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const drafts = await listDrafts();
    return { sent: 0, failed: 0, remaining: drafts.length };
  }

  flushing = true;
  let sent = 0;
  let failed = 0;

  try {
    const drafts = await listDrafts();
    for (const draft of drafts) {
      // A flush interrupted mid-upload leaves the draft marked "uploading"
      // forever, so an old one is retried rather than skipped for eternity.
      const stuck = Date.now() - new Date(draft.updatedAt).getTime() > 120_000;
      if (draft.status === "uploading" && !stuck) continue;
      try {
        await saveDraft({ ...draft, status: "uploading", updatedAt: new Date().toISOString() });

        const photos = [];
        for (const photo of draft.photos) {
          photos.push(await uploadPhoto(photo));
        }

        await apiSend("/api/issues", "POST", {
          title: draft.title,
          description: draft.description,
          category: draft.category,
          barangayId: draft.barangayId,
          location: { lat: draft.lat, lng: draft.lng },
          addressText: draft.addressText,
          photos,
          // Omit rather than send null: the schema treats the object as
          // meaningful only when it exists.
          ...(draft.waterDetails ? { waterDetails: draft.waterDetails } : {}),
        });

        await deleteDraft(draft.id);
        sent += 1;
      } catch (error) {
        failed += 1;
        await saveDraft({
          ...draft,
          status: "error",
          lastError: error instanceof Error ? error.message : "Could not post",
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } finally {
    flushing = false;
  }

  const remaining = (await listDrafts()).length;
  return { sent, failed, remaining };
}
