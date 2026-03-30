import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  lat: number | null;
  lng: number | null;
  onLocationSelect: (lat: number, lng: number) => void;
}

function ClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef<string>('');
  useEffect(() => {
    const key = `${lat},${lng}`;
    if (key !== prevRef.current) {
      prevRef.current = key;
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

export default function LocationMap({ lat, lng, onLocationSelect }: Props) {
  // Default center: San Pedro, Sucre, Colombia
  const centerLat = lat ?? 9.39647;
  const centerLng = lng ?? -75.06395;
  const zoom = lat ? 17 : 15;

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={zoom}
      style={{ height: '400px', width: '100%', borderRadius: '8px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onLocationSelect={onLocationSelect} />
      {lat && lng && (
        <>
          <Marker position={[lat, lng]} />
          <RecenterMap lat={lat} lng={lng} />
        </>
      )}
    </MapContainer>
  );
}
