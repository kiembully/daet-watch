"use client";

import imageCompression from "browser-image-compression";

import type { DraftPhoto } from "@/lib/offline/db";

const MAX_EDGE = 1600;
const TARGET_MB = 0.6;

/**
 * Compress before anything leaves the phone. Daet's mobile data is metered and
 * a 6 MB camera JPEG is a rude thing to spend it on; 1600px at ~0.7 quality is
 * plenty for a civic report and stays under Cloudinary's free transform limits.
 */
export async function compressToDraftPhoto(file: File): Promise<DraftPhoto> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: MAX_EDGE,
    maxSizeMB: TARGET_MB,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.82,
  });

  const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
  const { width, height } = await imageDimensions(dataUrl);

  return {
    dataUrl,
    width,
    height,
    name: file.name?.replace(/\.[^.]+$/, "") + ".jpg",
  };
}

function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1200, height: 900 });
    img.src = dataUrl;
  });
}

export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, body] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head ?? "")?.[1] ?? "image/jpeg";
  const binary = atob(body ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}
