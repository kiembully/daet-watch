"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";

import type { Map as LeafletMap, LayerGroup, Marker } from "leaflet";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  tone: "neutral" | "amber" | "red" | "fixed" | "water";
  label?: string;
}

const TONE_COLOUR: Record<MapPoint["tone"], string> = {
  neutral: "#5b6470",
  amber: "#f5b301",
  red: "#d92b1f",
  fixed: "#087a4d",
  water: "#1d6fd0",
};

/**
 * Leaflet, driven imperatively.
 *
 * Deliberately not react-leaflet: the map is a canvas Leaflet owns, and wrapping
 * it in a React component tree makes every marker update a reconciliation
 * question. One effect creates the map, one effect reconciles the markers.
 *
 * Clustering is a grid bucket, not a plugin: at this scale (a single
 * municipality) a 0.004° cell is ~450 m, which is exactly the right grain for
 * "three reports on this street".
 */
export function MapView({
  points,
  center,
  zoom = 13,
  draggable,
  onDrag,
  onSelect,
  onPick,
  className = "h-64 w-full",
}: {
  points: MapPoint[];
  center: { lat: number; lng: number };
  zoom?: number;
  draggable?: { lat: number; lng: number } | null;
  onDrag?: (lat: number, lng: number) => void;
  onSelect?: (id: string) => void;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const pin = useRef<Marker | null>(null);
  const callbacks = useRef({ onDrag, onSelect, onPick });

  // Written in an effect, never during render: the map's event handlers read the
  // latest props without needing the map to be rebuilt when a callback changes.
  useEffect(() => {
    callbacks.current = { onDrag, onSelect, onPick };
  });

  useEffect(() => {
    let disposed = false;

    const boot = async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !container.current || map.current) return;

      const instance = L.map(container.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(
        process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            process.env.NEXT_PUBLIC_TILE_ATTRIBUTION || "&copy; OpenStreetMap contributors",
        },
      ).addTo(instance);

      layer.current = L.layerGroup().addTo(instance);
      map.current = instance;

      instance.on("click", (event: { latlng: { lat: number; lng: number } }) => {
        callbacks.current.onPick?.(event.latlng.lat, event.latlng.lng);
      });
    };

    void boot();

    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      pin.current = null;
    };
    // The map is created once; centre/zoom are honoured by the second effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the viewport in sync when the caller moves us (GPS fix, deep link).
  useEffect(() => {
    if (!map.current) return;
    map.current.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom]);

  // Reconcile markers.
  useEffect(() => {
    let cancelled = false;

    const draw = async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !layer.current) return;

      layer.current.clearLayers();

      const clusters = new Map<string, MapPoint[]>();
      for (const point of points) {
        const key = `${Math.round(point.lat / 0.004)}:${Math.round(point.lng / 0.004)}`;
        const bucket = clusters.get(key);
        if (bucket) bucket.push(point);
        else clusters.set(key, [point]);
      }

      for (const bucket of clusters.values()) {
        const first = bucket[0];
        if (!first) continue;

        if (bucket.length > 1) {
          const lat = bucket.reduce((sum, p) => sum + p.lat, 0) / bucket.length;
          const lng = bucket.reduce((sum, p) => sum + p.lng, 0) / bucket.length;
          const icon = L.divIcon({
            className: "",
            html: `<div style="display:flex;align-items:center;justify-content:center;min-width:34px;height:34px;padding:0 6px;border-radius:999px;background:#0b0f14;color:#fff;font:700 13px/1 'Inter',system-ui,sans-serif;border:2px solid #f7f5f0;box-shadow:0 2px 8px rgba(0,0,0,.35)">${bucket.length}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });
          L.marker([lat, lng], { icon })
            .addTo(layer.current)
            .on("click", () => {
              map.current?.setView([lat, lng], Math.min(18, (map.current?.getZoom() ?? 13) + 2));
            });
          continue;
        }

        const colour = TONE_COLOUR[first.tone];
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:999px;background:${colour};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        L.marker([first.lat, first.lng], { icon })
          .addTo(layer.current)
          .on("click", () => callbacks.current.onSelect?.(first.id));
      }
    };

    void draw();
    return () => {
      cancelled = true;
    };
  }, [points]);

  // Draggable pin for the report flow.
  useEffect(() => {
    let cancelled = false;

    const draw = async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !map.current) return;

      if (!draggable) {
        pin.current?.remove();
        pin.current = null;
        return;
      }

      if (!pin.current) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:26px;height:26px;border-radius:999px 999px 999px 2px;transform:rotate(45deg);background:#d92b1f;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.45)"></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });
        pin.current = L.marker([draggable.lat, draggable.lng], {
          icon,
          draggable: true,
          autoPan: true,
        }).addTo(map.current);
        pin.current.on("dragend", () => {
          const position = pin.current?.getLatLng();
          if (position) callbacks.current.onDrag?.(position.lat, position.lng);
        });
      } else {
        pin.current.setLatLng([draggable.lat, draggable.lng]);
      }
    };

    void draw();
    return () => {
      cancelled = true;
    };
  }, [draggable]);

  return <div ref={container} className={className} role="application" aria-label="Map" />;
}
