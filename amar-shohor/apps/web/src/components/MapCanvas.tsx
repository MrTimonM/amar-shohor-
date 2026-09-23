import { useEffect, useRef } from 'react';
import L from 'leaflet';
// Reads the global `L` that Leaflet's own UMD publishes on import.
import 'leaflet.markercluster';
import { DHAKA_CENTER, type IssueSummary } from '@amar/shared';
import { iconMarkup } from './Icon';
import { useUi } from '../lib/ui-context';

/**
 * Phase 07 — the live map.
 *
 * Leaflet is driven imperatively here on purpose. The map owns real mutable
 * state — viewport, cluster layer, marker instances — and re-creating markers
 * on every React render is what makes map UIs feel slow.
 *
 * Markers encode two things at a glance: the category as a glyph and the
 * priority band as colour, with the report count as a badge. That is the
 * information a citizen scans for before opening anything.
 */

/**
 * Esri's Gray Canvas pair, keyless.
 *
 * CARTO's basemaps moved behind an API key and now stamp every tile with a
 * diagonal "API KEY REQUIRED" watermark — the map still drew, so a build and a
 * type check both stayed green while the product's front door was covered in
 * someone else's billing notice.
 *
 * Gray Canvas is the right replacement rather than merely an available one:
 * the base is deliberately desaturated, so the priority colours on the pins
 * are the only saturated thing on screen, and the light and dark variants are
 * a designed pair rather than one map with a filter over it. Labels ride in a
 * separate transparent overlay above the pins' shadow but below the pins.
 */
const TILES = {
  light: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labels:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  },
  dark: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labels:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  },
} as const;

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://www.esri.com/">Esri</a>';

/**
 * Gray Canvas is published to z16; past that Esri serves a grey "Map data not
 * yet available" placeholder. Leaflet upscales the last real tile instead, so
 * the ceiling is two levels above native — blurry but continuous, and still
 * about a metre per pixel, which is finer than a dropped pin needs.
 *
 * Do NOT add `detectRetina` to these layers. It increments `zoomOffset` but
 * leaves `maxNativeZoom` alone, so Leaflet clamps the tile zoom to 16 and then
 * asks for 17 anyway — which is exactly how the placeholder tiles appeared.
 */
const MAX_NATIVE_ZOOM = 16;

/** Shared by the map options and the tile layer, so they cannot disagree. */
const MAX_ZOOM = MAX_NATIVE_ZOOM + 2;

export interface WardShape {
  id: string;
  name: string;
  boundary?: { type: 'Polygon'; coordinates: number[][][] };
}

interface Props {
  issues: IssueSummary[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onBoundsChange?: (bbox: string) => void;
  wards?: WardShape[];
  showWards?: boolean;
  /**
   * Draggable pin mode, used by the report flow to correct the GPS fix.
   *
   * `placed` is false while the position is only a guess — GPS was refused or
   * has not answered yet — so the pin can be shown as waiting to be put
   * somewhere rather than as an assertion about where the problem is.
   */
  pickMode?: { lat: number; lng: number; placed?: boolean; onMove: (lat: number, lng: number) => void };
  focus?: { lat: number; lng: number; zoom?: number };
}

export function MapCanvas({ issues, selectedId, onSelect, onBoundsChange, wards, showWards, pickMode, focus }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const labels = useRef<L.TileLayer | null>(null);
  const cluster = useRef<L.MarkerClusterGroup | null>(null);
  const wardLayer = useRef<L.LayerGroup | null>(null);
  const pickMarker = useRef<L.Marker | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);
  const onBoundsRef = useRef(onBoundsChange);
  const pickRef = useRef(pickMode);
  const { resolved, categoryLabel } = useUi();

  onSelectRef.current = onSelect;
  onBoundsRef.current = onBoundsChange;
  pickRef.current = pickMode;

  // --- create once --------------------------------------------------------
  useEffect(() => {
    const wrapper = holder.current;
    if (!wrapper || map.current) return;

    /**
     * Leaflet is handed a div created here, not the React-rendered wrapper.
     * Leaflet mutates its container's children directly; when React later
     * unmounts the subtree — which StrictMode does on every mount in
     * development — it tries to remove children Leaflet has already taken
     * away and throws `removeChild: node is not a child of this node`,
     * killing the whole app. Owning a node React has never seen keeps the two
     * out of each other's way.
     */
    const canvas = document.createElement('div');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    wrapper.appendChild(canvas);

    const instance = L.map(canvas, {
      center: [focus?.lat ?? DHAKA_CENTER.lat, focus?.lng ?? DHAKA_CENTER.lng],
      zoom: focus?.zoom ?? 13,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      /**
       * Required, not cosmetic. The cluster layer is added below, before the
       * tile layer exists (that lives in the theme effect), and
       * MarkerClusterGroup asks the map for getMaxZoom() as it attaches. With
       * no tile layer to infer it from, Leaflet throws "Map has no maxZoom
       * specified" — which took down the entire app, not just the map.
       */
      maxZoom: MAX_ZOOM,
    });
    // Bottom-right on desktop, where nothing else lives. On a phone the
    // thumb-reachable camera button occupies exactly that corner, so the
    // stylesheet hides these buttons below 900px and leaves zooming to pinch
    // and double-tap, which Leaflet handles natively on touch.
    L.control.zoom({ position: 'bottomright' }).addTo(instance);

    cluster.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 46,
      iconCreateFunction: (group) => {
        const count = group.getChildCount();
        const size = count < 10 ? 32 : count < 50 ? 38 : 46;
        return L.divIcon({
          html: `<div class="cluster" style="width:${size}px;height:${size}px">${count}</div>`,
          className: '',
          iconSize: [size, size],
        });
      },
    });
    instance.addLayer(cluster.current);

    wardLayer.current = L.layerGroup().addTo(instance);

    const report = () => {
      const b = instance.getBounds();
      onBoundsRef.current?.(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(','),
      );
    };
    instance.on('moveend', report);
    report();

    map.current = instance;

    return () => {
      instance.remove();
      canvas.remove();
      map.current = null;
      tiles.current = null;
      labels.current = null;
      cluster.current = null;
      wardLayer.current = null;
      pickMarker.current = null;
      markers.current.clear();
    };
    // Deliberately empty: the map is created once and then updated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- tiles follow the theme --------------------------------------------
  useEffect(() => {
    if (!map.current) return;
    const config = TILES[resolved];
    if (tiles.current) map.current.removeLayer(tiles.current);
    if (labels.current) map.current.removeLayer(labels.current);

    tiles.current = L.tileLayer(config.base, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: MAX_ZOOM,
      maxNativeZoom: MAX_NATIVE_ZOOM,
    }).addTo(map.current);

    // Street and place names, so a citizen can tell which road they are
    // looking at. Its own pane keeps it above the base but under the pins.
    labels.current = L.tileLayer(config.labels, {
      maxZoom: MAX_ZOOM,
      maxNativeZoom: MAX_NATIVE_ZOOM,
      pane: 'shadowPane',
    }).addTo(map.current);

    // Tiles must sit under the markers, which Leaflet does by pane order.
    tiles.current.bringToBack();
  }, [resolved]);

  // --- markers ------------------------------------------------------------
  useEffect(() => {
    const group = cluster.current;
    if (!group) return;

    const wanted = new Set(issues.map((i) => i.id));

    // Remove only what left the viewport, keep the rest — re-adding every
    // marker on each fetch makes the map flicker and lose the open popup.
    for (const [id, marker] of markers.current) {
      if (!wanted.has(id)) {
        group.removeLayer(marker);
        markers.current.delete(id);
      }
    }

    for (const issue of issues) {
      const [lng, lat] = issue.location.coordinates;
      const existing = markers.current.get(issue.id);
      if (existing) {
        existing.setIcon(buildPin(issue, issue.id === selectedId));
        continue;
      }
      const marker = L.marker([lat, lng], {
        icon: buildPin(issue, issue.id === selectedId),
        title: `${categoryLabel(issue.category)} — ${issue.ref}`,
        keyboard: true,
        riseOnHover: true,
      });
      marker.on('click', () => onSelectRef.current(issue.id));
      marker.on('keypress', () => onSelectRef.current(issue.id));
      group.addLayer(marker);
      markers.current.set(issue.id, marker);
    }
  }, [issues, selectedId, categoryLabel]);

  // --- ward overlay -------------------------------------------------------
  useEffect(() => {
    const layer = wardLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showWards || !wards) return;

    for (const ward of wards) {
      if (!ward.boundary) continue;
      L.geoJSON({ type: 'Feature', geometry: ward.boundary, properties: { name: ward.name } } as GeoJSON.Feature, {
        interactive: false,
        // The overlay is styled in map.css so it follows the theme tokens
        // rather than carrying hardcoded colours here.
        style: () => ({ className: 'ward-shape' }),
      }).addTo(layer);
    }
  }, [wards, showWards]);

  // --- pick mode ----------------------------------------------------------
  useEffect(() => {
    if (!map.current) return;
    if (!pickMode) {
      if (pickMarker.current) {
        map.current.removeLayer(pickMarker.current);
        pickMarker.current = null;
      }
      return;
    }

    const icon = (placed: boolean) =>
      L.divIcon({
        html: `<div class="pin pick${placed ? '' : ' unplaced'}">${iconMarkup('pin', 15)}</div>`,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 28],
      });

    if (!pickMarker.current) {
      pickMarker.current = L.marker([pickMode.lat, pickMode.lng], {
        draggable: true,
        autoPan: true,
        keyboard: true,
        icon: icon(pickMode.placed !== false),
      }).addTo(map.current);

      pickMarker.current.on('dragend', () => {
        const position = pickMarker.current?.getLatLng();
        if (position) pickRef.current?.onMove(position.lat, position.lng);
      });
    } else {
      pickMarker.current.setLatLng([pickMode.lat, pickMode.lng]);
      pickMarker.current.setIcon(icon(pickMode.placed !== false));
    }
  }, [pickMode]);

  /**
   * Tapping the map moves the pin. Registered once against the live map and
   * reading the handler from a ref, because it used to be attached inside the
   * marker-creation branch: if the pin did not exist yet — GPS refused, which
   * is the common case on a desktop browser — nothing was ever bound, so the
   * map ignored every tap while the caption promised otherwise.
   */
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      if (!pickRef.current) return;
      pickRef.current.onMove(e.latlng.lat, e.latlng.lng);
    };
    instance.on('click', onClick);
    return () => {
      instance.off('click', onClick);
    };
  }, []);

  // --- external focus -----------------------------------------------------
  useEffect(() => {
    if (!map.current || !focus) return;
    map.current.flyTo([focus.lat, focus.lng], focus.zoom ?? map.current.getZoom(), { duration: 0.6 });
  }, [focus]);

  return <div ref={holder} className="map-canvas" aria-label="Map of reported city problems" role="application" />;
}

function buildPin(issue: IssueSummary, selected: boolean): L.DivIcon {
  const done = issue.status === 'resolved';
  const classes = ['pin', done ? 'done' : issue.priority.band, selected ? 'selected' : ''].filter(Boolean).join(' ');
  const badge = issue.reportCount > 1 ? `<span class="pin-count">${issue.reportCount}</span>` : '';

  return L.divIcon({
    html: `<div class="pin-wrap"><div class="${classes}">${iconMarkup(issue.category, 15)}</div>${badge}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26],
  });
}
