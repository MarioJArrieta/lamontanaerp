import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Client } from '@/types';

// Fix default marker icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  clients: Client[];
}

function FitBounds({ clients }: { clients: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (clients.length === 0) return;
    if (clients.length === 1) {
      map.setView([clients[0].lat, clients[0].lng], 15);
      return;
    }
    const bounds = L.latLngBounds(clients.map(c => [c.lat, c.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [clients, map]);
  return null;
}

export default function ClientsMap({ clients }: Props) {
  const withLocation = clients
    .filter(c => c.latitude && c.longitude)
    .map(c => ({ ...c, lat: Number(c.latitude), lng: Number(c.longitude) }));

  return (
    <MapContainer
      center={[9.39647, -75.06395]}
      zoom={13}
      style={{ height: '500px', width: '100%', borderRadius: '8px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {withLocation.length > 0 && (
        <FitBounds clients={withLocation} />
      )}
      {withLocation.map(c => (
        <Marker key={c.id} position={[c.lat, c.lng]}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{c.name}</p>
              {c.address && <p>{c.address}</p>}
              {c.phone && <p>Tel: {c.phone}</p>}
              {c.delivery_zone && <p>Zona: {c.delivery_zone}</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
