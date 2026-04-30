import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, UserCircle, Search, MapPin, Map, Navigation, Droplets, Tag, Trash2, KeyRound, Cloud } from 'lucide-react';
import { Pagination, paginate } from '@/components/ui/pagination';
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
import type { Client, Product, LoyaltyTransaction, LoyaltyConfig, DianIdType } from '@/types';
import { DIAN_ID_TYPES } from '@/types';
import LocationMap from '@/components/shared/LocationMap';
import ClientsMap from '@/components/shared/ClientsMap';

const clientTypeLabel: Record<string, string> = { person: 'Persona', company: 'Empresa' };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
  const [page, setPage] = useState(1);
  const [puntosClient, setPuntosClient] = useState<Client | null>(null);
  const [puntosHistory, setPuntosHistory] = useState<LoyaltyTransaction[]>([]);
  const [puntosConfig, setPuntosConfig] = useState<LoyaltyConfig | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [priceClient, setPriceClient] = useState<Client | null>(null);
  const [priceProductId, setPriceProductId] = useState('');
  const [priceValue, setPriceValue] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    client_type: string;
    cedula_nit: string;
    dian_id_type: DianIdType | '';
    address: string;
    delivery_zone: string;
    phone: string;
    email: string;
    electronic_invoicing_enabled: boolean;
  }>({
    name: '', client_type: 'person', cedula_nit: '', dian_id_type: '',
    address: '', delivery_zone: '', phone: '', email: '',
    electronic_invoicing_enabled: false,
  });

  const emptyForm = {
    name: '', client_type: 'person', cedula_nit: '', dian_id_type: '' as DianIdType | '',
    address: '', delivery_zone: '', phone: '', email: '',
    electronic_invoicing_enabled: false,
  };

  const fetchData = () => {
    Promise.all([
      api.get('/clients'),
      api.get('/products'),
    ]).then(([clientsRes, productsRes]) => {
      setClients(clientsRes.data);
      setProducts(productsRes.data);
    }).finally(() => setLoading(false));
  };
  useEffect(fetchData, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.dian_id_type) {
      toast.error('Selecciona el tipo de documento');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      client_type: form.client_type,
      cedula_nit: form.cedula_nit,
      dian_id_type: form.dian_id_type,
      address: form.address || null,
      delivery_zone: form.delivery_zone || null,
      phone: form.phone || null,
      email: form.email || null,
      electronic_invoicing_enabled: form.electronic_invoicing_enabled,
    };
    try {
      if (editId) {
        await api.put(`/clients/${editId}`, payload);
        toast.success('Cliente actualizado');
      } else {
        const res = await api.post('/clients', payload);
        const pwd = res.data?.generated_password;
        if (pwd) {
          toast.success(`Cliente creado. Password: ${pwd}`, { duration: 15000 });
        } else {
          toast.success('Cliente creado');
        }
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
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
      dian_id_type: c.dian_id_type || '',
      address: c.address || '', delivery_zone: c.delivery_zone || '',
      phone: c.phone || '', email: c.email || '',
      electronic_invoicing_enabled: c.electronic_invoicing_enabled ?? false,
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

  const handleResetPassword = async (c: Client) => {
    try {
      const res = await api.post(`/clients/${c.id}/password/reset`);
      const pwd = res.data?.generated_password;
      toast.success(`Nueva password para ${c.name}: ${pwd}`, { duration: 15000 });
    } catch {
      toast.error('Error al resetear password');
    }
  };

  const openPuntos = async (c: Client) => {
    setPuntosClient(c);
    setRedeemAmount('');
    try {
      const [histRes, cfgRes] = await Promise.all([
        api.get(`/loyalty/${c.id}/history`),
        api.get('/loyalty/config'),
      ]);
      setPuntosHistory(histRes.data);
      setPuntosConfig(cfgRes.data);
    } catch {
      toast.error('Error al cargar puntos');
    }
  };

  const handleRedeem = async () => {
    if (!puntosClient || !redeemAmount) return;
    setRedeeming(true);
    try {
      await api.post(`/loyalty/${puntosClient.id}/redeem`, { points: Number(redeemAmount) });
      toast.success('Puntos canjeados');
      openPuntos({ ...puntosClient, loyalty_points: puntosClient.loyalty_points - Number(redeemAmount) });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setRedeeming(false);
    }
  };

  const productMap: Record<string, Product> = {};
  for (const p of products) productMap[p.id] = p;

  const openPrices = (c: Client) => {
    setPriceClient(c);
    setPriceProductId('');
    setPriceValue('');
  };

  const handleSavePrice = async () => {
    if (!priceClient || !priceProductId || !priceValue) return;
    setSavingPrice(true);
    try {
      await api.put(`/clients/${priceClient.id}/prices`, {
        product_id: priceProductId,
        price: Number(priceValue),
      });
      toast.success('Precio guardado');
      fetchData();
      // Refresh the client data in the dialog
      const res = await api.get(`/clients/${priceClient.id}`);
      setPriceClient(res.data);
      setPriceProductId('');
      setPriceValue('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSavingPrice(false);
    }
  };

  const handleDeletePrice = async (productId: string) => {
    if (!priceClient) return;
    try {
      await api.delete(`/clients/${priceClient.id}/prices/${productId}`);
      toast.success('Precio eliminado');
      fetchData();
      const res = await api.get(`/clients/${priceClient.id}`);
      setPriceClient(res.data);
    } catch {
      toast.error('Error al eliminar precio');
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
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de documento <span className="text-red-500">*</span></Label>
                    <Select value={form.dian_id_type || null} onValueChange={v => setForm({...form, dian_id_type: sv(v) as DianIdType})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo">
                          {(v: string) => DIAN_ID_TYPES.find(t => t.code === v)?.label || 'Seleccionar tipo'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {DIAN_ID_TYPES.map(t => (
                          <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Numero de documento</Label>
                    <Input value={form.cedula_nit} onChange={e => setForm({...form, cedula_nit: e.target.value})} required />
                  </div>
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

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-emerald-600" />
                      <div>
                        <Label className="cursor-pointer">Habilitar factura electronica</Label>
                        <p className="text-xs text-muted-foreground">Permite emitir facturas DIAN para este cliente</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.electronic_invoicing_enabled}
                      onClick={() => setForm({ ...form, electronic_invoicing_enabled: !form.electronic_invoicing_enabled })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.electronic_invoicing_enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${form.electronic_invoicing_enabled ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
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
                  <TableHead className="w-24">Zona</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Puntos</TableHead>
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
                  const pg = paginate(filtered, page);
                  return pg.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <UserCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay clientes</p>
                    </TableCell>
                  </TableRow>
                ) : pg.data.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="secondary">{c.client_type === 'person' ? 'Persona' : 'Empresa'}</Badge></TableCell>
                    <TableCell>{c.cedula_nit}</TableCell>
                    <TableCell>{c.delivery_zone || '-'}</TableCell>
                    <TableCell>{c.phone || '-'}</TableCell>
                    <TableCell>
                      <button onClick={() => openPuntos(c)} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm">
                        <Droplets className="w-3.5 h-3.5" />{c.loyalty_points}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => openPrices(c)} className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-800 font-medium text-sm">
                        <Tag className="w-3.5 h-3.5" />{c.prices.length > 0 ? `${c.prices.length} precios` : 'Asignar'}
                      </button>
                    </TableCell>
                    <TableCell><Badge variant={c.is_active ? 'default' : 'destructive'}>{c.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openMap(c)} className={c.latitude && c.longitude ? 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100' : 'text-muted-foreground'}>
                          <MapPin className="w-3.5 h-3.5 mr-1" />Ubicacion
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleResetPassword(c)} title="Resetear password">
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        {c.is_active && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}>Eliminar</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ));
                })()}
              </TableBody>
            </Table>
          )}
          {(() => {
            const q = search.toLowerCase();
            const filtered = q ? clients.filter(c =>
              c.name.toLowerCase().includes(q) ||
              c.cedula_nit.toLowerCase().includes(q) ||
              (c.delivery_zone || '').toLowerCase().includes(q) ||
              (c.phone || '').includes(q)
            ) : clients;
            const pg = paginate(filtered, page);
            return <Pagination page={pg.page} totalPages={pg.totalPages} totalItems={pg.totalItems} pageSize={pg.pageSize} onPageChange={setPage} />;
          })()}
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
              <>
                <Button variant="outline" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${mapLat},${mapLng}`, '_blank')}>
                  <Navigation className="w-4 h-4 mr-1" />Calcular ruta
                </Button>
                <Button variant="outline" onClick={() => { setMapLat(null); setMapLng(null); }}>
                  Limpiar
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!priceClient} onOpenChange={() => setPriceClient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-500" />
              Precios especiales - {priceClient?.name}
            </DialogTitle>
          </DialogHeader>
          {priceClient && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Asigna precios personalizados por producto. Si no tiene precio especial, se usa el precio base.
              </p>

              {priceClient.prices.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Precio base</TableHead>
                      <TableHead>Precio especial</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceClient.prices.map(cp => {
                      const prod = productMap[cp.product_id];
                      return (
                        <TableRow key={cp.id}>
                          <TableCell className="font-medium">{prod?.name || 'Producto'}</TableCell>
                          <TableCell className="text-muted-foreground">${Number(prod?.base_price || 0).toLocaleString('es-CO')}</TableCell>
                          <TableCell className="font-semibold text-orange-600">${Number(cp.price).toLocaleString('es-CO')}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => handleDeletePrice(cp.product_id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Producto</Label>
                  <Select value={priceProductId || null} onValueChange={v => setPriceProductId(sv(v))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar producto">{(v: string) => productMap[v]?.name || 'Seleccionar'}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} (${Number(p.base_price).toLocaleString('es-CO')})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-xs">Precio</Label>
                  <Input type="number" placeholder="Precio" value={priceValue} onChange={e => setPriceValue(e.target.value)} />
                </div>
                <SubmitButton loading={savingPrice} onClick={handleSavePrice} disabled={!priceProductId || !priceValue} type="button" size="sm">
                  Guardar
                </SubmitButton>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setPriceClient(null)}>Cerrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!puntosClient} onOpenChange={() => setPuntosClient(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-500" />
              Puntos de {puntosClient?.name}
            </DialogTitle>
          </DialogHeader>
          {puntosClient && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Balance actual</p>
                  <p className="text-2xl font-bold text-blue-600">{puntosClient.loyalty_points} puntos</p>
                </div>
                {puntosConfig && (
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{puntosConfig.puntos_per_paca} punto/paca</p>
                    <p>{puntosConfig.puntos_to_redeem_paca} puntos = 1 paca gratis</p>
                  </div>
                )}
              </div>

              {puntosConfig && puntosClient.loyalty_points >= puntosConfig.puntos_to_redeem_paca && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Canjear puntos</Label>
                    <Input
                      type="number"
                      placeholder={`Min. ${puntosConfig.puntos_to_redeem_paca}`}
                      value={redeemAmount}
                      onChange={e => setRedeemAmount(e.target.value)}
                      min={puntosConfig.puntos_to_redeem_paca}
                      max={puntosClient.loyalty_points}
                      step={puntosConfig.puntos_to_redeem_paca}
                    />
                  </div>
                  <SubmitButton
                    loading={redeeming}
                    onClick={handleRedeem}
                    disabled={!redeemAmount || Number(redeemAmount) < puntosConfig.puntos_to_redeem_paca || Number(redeemAmount) > puntosClient.loyalty_points}
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Canjear
                  </SubmitButton>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Historial</p>
                {puntosHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin movimientos</p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {puntosHistory.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/50">
                        <div>
                          <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('es-CO')}</p>
                          <p className="text-xs">{tx.description}</p>
                        </div>
                        <span className={`font-bold text-sm ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {tx.points > 0 ? '+' : ''}{tx.points}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setPuntosClient(null)}>Cerrar</Button>
            </div>
          )}
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
