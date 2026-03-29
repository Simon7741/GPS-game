<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet-arrowheads';
  
  import type { Point } from '../types';
  import { MAPY_CZ_API_KEY } from '../pb';

  interface Props {
    points: Point[];
    editable?: boolean;
    userPosition?: { lat: number, lon: number } | null;
    center?: { lat: number, lon: number };
    routeGeometry?: L.LatLngExpression[][]; 
    onMapClick?: (lat: number, lng: number) => void;
    onPointClick?: (point: Point) => void;
    onPointMove?: (point: Point, lat: number, lng: number) => void;
  }

  let { 
    points = [], 
    editable = false, 
    userPosition = null, 
    center = { lat: 50.0755, lon: 14.4378 }, 
    routeGeometry = [],
    onMapClick,
    onPointClick,
    onPointMove
  }: Props = $props();

  let mapContainer: HTMLElement;
  let map: L.Map;
  let pointMarkers: L.Marker[] = [];
  let userMarker: L.CircleMarker | null = null;
  let pathLine: L.Polyline | null = null;
  let routeLines: L.Polyline[] = []; 
  let initialFitDone = false;
  
  let mapType: 'outdoor' | 'aerial' = $state('outdoor');
  let currentLayer: L.TileLayer | null = null;

  onMount(() => {
    if (!mapContainer) return;

    map = L.map(mapContainer).setView([center.lat, center.lon], 13);

    if (editable && onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 100);
  });

  onDestroy(() => {
    if (map) {
      map.remove();
    }
  });

  // Tile Layer reactive update
  $effect(() => {
      if (!map) return;
      if (currentLayer) currentLayer.remove();

      if (MAPY_CZ_API_KEY) {
          console.log(`Using Mapy.cz tiles: ${mapType}`);
          currentLayer = L.tileLayer(`https://api.mapy.cz/v1/maptiles/${mapType}/256/{z}/{x}/{y}?apikey=${MAPY_CZ_API_KEY}`, {
              minZoom: 0,
              maxZoom: mapType === 'aerial' ? 20 : 19,
              attribution: '<a href="https://api.mapy.cz/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
          }).addTo(map);
      } else {
          console.warn("Mapy.cz API Key NOT found, falling back to OSM.");
          currentLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(map);
      }
      
      // Keep tile layer at the bottom
      currentLayer.setZIndex(0);
  });

  function toggleMapType() {
      mapType = mapType === 'outdoor' ? 'aerial' : 'outdoor';
      console.log('Map type toggled to:', mapType);
  }

  function createNumberedIcon(index: number) {
    return L.divIcon({
      className: 'custom-marker-container',
      html: `
        <div class="marker-shadow"></div>
        <div class="marker-pin">
            <span class="num">${index + 1}</span>
        </div>
      `,
      iconSize: [40, 56],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50]
    });
  }

  // Unified Reactive update for points, route, and fitBounds
  $effect(() => {
    if (!map) return;

    // Clear existing layers
    pointMarkers.forEach(m => m.remove());
    pointMarkers = [];
    if (pathLine) pathLine.remove();
    routeLines.forEach(l => l.remove());
    routeLines = [];

    const latlngs: L.LatLngExpression[] = [];
    points.forEach((p, index) => {
      const latlng: L.LatLngExpression = [p.latitude, p.longitude];
      latlngs.push(latlng);

      const marker = L.marker(latlng, { 
        draggable: editable,
        icon: createNumberedIcon(index)
      })
        .addTo(map)
        .bindPopup(`<strong>${p.name || ('Point ' + (index + 1))}</strong>`);
      
      if (onPointClick) {
        marker.on('click', () => onPointClick(p));
      }
      
      if (onPointMove && editable) {
        marker.on('dragend', (e) => {
            const { lat, lng } = e.target.getLatLng();
            onPointMove(p, lat, lng);
        });
      }

      pointMarkers.push(marker);
    });

    // Draw Route
    if (routeGeometry && routeGeometry.length > 0) {
        console.log(`Drawing ${routeGeometry.length} route segments.`);
        routeGeometry.forEach(segment => {
            const poly = L.polyline(segment, { 
                color: '#3388ff', 
                weight: 6, 
                opacity: 0.8, 
                dashArray: '10, 10' 
            }).addTo(map);
            routeLines.push(poly);
        });
    } else if (latlngs.length > 1) {
      console.log("No route geometry, drawing straight lines.");
      pathLine = L.polyline(latlngs, { color: 'blue', weight: 4, opacity: 0.7 }).addTo(map);
      (pathLine as any).arrowheads({
        size: '12px',
        fill: true,
        frequency: '80px',
        yawn: 60
      });
    }

    // Auto-fit bounds (only once or when in non-editable mode)
    if (points.length > 0 && !userPosition && (!editable || !initialFitDone)) {
        map.fitBounds(L.latLngBounds(latlngs as L.LatLngTuple[]), { padding: [50, 50] });
        if (editable) initialFitDone = true;
    }
  });

  // User position tracking
  $effect(() => {
    if (!map) return;

    if (userPosition) {
      const latlng: L.LatLngExpression = [userPosition.lat, userPosition.lon];
      
      if (!userMarker) {
        userMarker = L.circleMarker(latlng, {
          radius: 8,
          fillColor: '#3388ff',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(map);
      } else {
        userMarker.setLatLng(latlng);
      }
    }
  });

  // Center update (only if manually changed)
  $effect(() => {
      if(map && center && !editable) {
          map.setView([center.lat, center.lon], map.getZoom());
      }
  })

</script>

<div class="map-container" bind:this={mapContainer}>
    {#if MAPY_CZ_API_KEY}
        <div class="map-controls">
            <button class="layer-toggle-btn" onclick={toggleMapType} title="Switch Map View">
                {#if mapType === 'outdoor'}
                    🛰️
                {:else}
                    🗺️
                {/if}
            </button>
        </div>
    {/if}
</div>

<style>
  .map-container {
    height: 100%;
    width: 100%;
    min-height: 400px;
    background: #e0e0e0;
    z-index: 1;
    position: relative;
  }

  .map-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
  }

  .layer-toggle-btn {
      background: white;
      border: 2px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1.2rem;
      box-shadow: 0 1px 5px rgba(0,0,0,0.4);
  }

  .layer-toggle-btn:hover {
      background: #f4f4f4;
  }

  :global(.custom-marker-container) {
    /* pointer-events: none; removed to allow clicking markers */
  }
  
  :global(.marker-pin) {
    width: 36px;
    height: 36px;
    background: #ff3e00;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    position: absolute;
    left: 2px;
    top: 2px;
    box-shadow: 0 0 4px rgba(0,0,0,0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2;
  }

  :global(.marker-pin::after) {
      content: '';
      width: 24px;
      height: 24px;
      background: #fff;
      position: absolute;
      border-radius: 50%;
      top: 6px;
      left: 6px;
  }

  :global(.num) {
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      transform: rotate(45deg);
      font-weight: bold;
      font-size: 14px;
      color: #333;
      z-index: 3;
      font-family: sans-serif;
  }

  :global(.marker-shadow) {
    width: 16px;
    height: 6px;
    background: rgba(0,0,0,0.3);
    border-radius: 50%;
    position: absolute;
    bottom: 0;
    left: 12px;
    filter: blur(2px);
    z-index: 1;
  }
</style>
