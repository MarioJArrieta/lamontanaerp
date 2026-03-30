import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, UserCircle, Search, MapPin, Map } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SubmitButton } from '@/components/ui/submit-button';
import api from '@/lib/api';
import { sv } from '@/lib/helpers';
import type { Client } from '@/types';
import LocationMap from '@/components/shared/LocationMap';
import ClientsMap from '@/components/shared/ClientsMap';

const clientTypeLabel: Record<string, string> = { person: 'Persona', company: 'Empresa' };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapClient, setMapClient] = useState<Client | null>(null);
  const [mapLat, setMapLat] = useState<number | null>(null);
  const [mapLng, setMapLng] = useState<number | null>(null);
  const [allMapOpen, setAllMapOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', client_type: 'person', cedula_nit: '',
    address: '', delivery_zone: '', phone: '', email: '',
  });

  const fetchData = () => {
    api.get('/clients').then(r => setClients(r.data)).finally(() => setLoading(false));
  };
  useEffect(fetchData, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/clients/${editId}`, {
          name: form.name,
          address: form.address || null,
          delivery_zone: form.delivery_zone || null,
          phone: form.phone || null,
          email: form.email || null,
        });
        toast.success('Cliente actualizado');
      } else {
        await api.post('/clients', {
          ...form,
          address: form.address || null,
          delivery_zone: form.delivery_zone || null,
          phone: form.phone || null,
          email: form.email || null,
        });
        toast.success('Cliente creado');
      }
      setOpen(false);
      setEditId(null);
      setForm({ name: '', client_type: 'person', cedula_nit: '', address: '', delivery_zone: '', phone: '', email: '' });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: Client) => {
    setEditId(c.id);
    setForm({
      name: c.name, client_type: c.client_type, cedula_nit: c.cedula_nit,
      address: c.address || '', delivery_zone: c.delivery_zone || '',
      phone: c.phone || '', email: c.email || '',
    });
    setOpen(true);
  };

  const openMap = (c: Client) => {
    setMapClient(c);
    setMapLat(c.latitude ? Number(c.latitude) : null);
    setMapLng(c.longitude ? Number(c.longitude) : null);
    setMapOpen(true);
  };

  const [savingLocation, setSavingLocation] = useState(false);
  const handleSaveLocation = async () => {
    if (!mapClient || mapLat === null || mapLng === null) return;
    setSavingLocation(true);
    try {
      await api.put(`/clients/${mapClient.id}`, { latitude: mapLat, longitude: mapLng });
      toast.success('Ubicacion guardada');
      setMapOpen(false);
      fetchData();
    } catch {
      toast.error('Error al guardar ubicacion');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.put(`/clients/${id}`, { is_active: false });
      toast.success('Cliente desactivado');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Gestion de clientes y empresas"
        action={
          <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAllMapOpen(true)}>
            <Map className="w-4 h-4 mr-2" />Ver mapa
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ name: '', client_type: 'person', cedula_nit: '', address: '', delivery_zone: '', phone: '', email: '' }); } }}>
            <DialogTrigger>
              <Button><Plus className="w-4 h-4 mr-2" />Nuevo cliente</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? 'Editar cliente' : 'Crear cliente'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.client_type} onValueChange={v => setForm({...form, client_type: sv(v)})}>
                      <SelectTrigger><SelectValue>{(v: string) => clientTypeLabel[v] || v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="person">Persona</SelectItem>
                        <SelectItem value="company">Empresa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cedula / NIT</Label>
                  <Input value={form.cedula_nit} onChange={e => setForm({...form, cedula_nit: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Direccion</Label>
                    <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Zona de entrega</Label>
                    <Input value={form.delivery_zone} onChange={e => setForm({...form, delivery_zone: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefono</Label>
                    <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                  </div>
                </div>
                <SubmitButton loading={saving} className="w-full">{editId ? 'Guardar' : 'Crear'}</SubmitButton>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, cedula/NIT, zona o telefono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cedula/NIT</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Precios especiales</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const q = search.toLowerCase();
                  const filtered = q ? clients.filter(c =>
                    c.name.toLowerCase().includes(q) ||
                    c.cedula_nit.toLowerCase().includes(q) ||
                    (c.delivery_zone || '').toLowerCase().includes(q) ||
                    (c.phone || '').includes(q)
                  ) : clients;
                  return filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <UserCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay clientes</p>
                    </TableCell>
                  </TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="secondary">{c.client_type === 'person' ? 'Persona' : 'Empresa'}</Badge></TableCell>
                    <TableCell>{c.cedula_nit}</TableCell>
                    <TableCell>{c.delivery_zone || '-'}</TableCell>
                    <TableCell>{c.phone || '-'}</TableCell>
                    <TableCell>{c.prices.length > 0 ? <Badge>{c.prices.length} precios</Badge> : '-'}</TableCell>
                    <TableCell><Badge variant={c.is_active ? 'default' : 'destructive'}>{c.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openMap(c)}>
                          <MapPin className="w-3.5 h-3.5 mr-1" />Ubicacion
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Editar</Button>
                        {c.is_active && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}>Eliminar</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ));
                })()}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Ubicacion de {mapClient?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Haz click en el mapa para marcar la ubicacion del cliente.</p>
          <LocationMap
            lat={mapLat}
            lng={mapLng}
            onLocationSelect={(lat, lng) => { setMapLat(lat); setMapLng(lng); }}
          />
          {mapLat !== null && mapLng !== null && (
            <p className="text-xs text-muted-foreground text-center">
              Lat: {mapLat.toFixed(6)}, Lng: {mapLng.toFixed(6)}
            </p>
          )}
          <div className="flex gap-2">
            <SubmitButton loading={savingLocation} className="flex-1" onClick={handleSaveLocation} disabled={mapLat === null || mapLng === null} type="button">
              Guardar ubicacion
            </SubmitButton>
            {mapLat !== null && (
              <Button variant="outline" onClick={() => { setMapLat(null); setMapLng(null); }}>
                Limpiar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={allMapOpen} onOpenChange={setAllMapOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Map className="w-5 h-5" />
              Mapa de clientes
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {clients.filter(c => c.latitude && c.longitude).length} de {clients.length} clientes con ubicacion
          </p>
          <ClientsMap clients={clients} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
