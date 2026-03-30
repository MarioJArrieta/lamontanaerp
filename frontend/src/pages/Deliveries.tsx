import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Truck, CheckCircle2, Clock, MapPin, CircleDollarSign } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LocationMap from '@/components/shared/LocationMap';
import { SubmitButton } from '@/components/ui/submit-button';
import api from '@/lib/api';
import { sv } from '@/lib/helpers';
import type { Delivery, Employee, Sale, Client } from '@/types';

const statusLabel: Record<string, string> = { pending: 'Pendiente', in_route: 'En ruta', delivered: 'Entregado' };
const statusVariant = (s: string) => s === 'delivered' ? 'default' as const : s === 'in_route' ? 'secondary' as const : 'outline' as const;
const methodLabel: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata' };

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = useState(weekAgo);
  const [filterTo, setFilterTo] = useState(today);
  const [filterEmployee, setFilterEmployee] = useState('all');

  // Map dialog
  const [mapOpen, setMapOpen] = useState(false);
  const [mapClient, setMapClient] = useState<Client | null>(null);

  // Pay dialog
  const [payOpen, setPayOpen] = useState(false);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/deliveries?from_date=${filterFrom}&to_date=${filterTo}`).catch(() => ({ data: [] })),
      api.get('/employees').catch(() => ({ data: [] })),
      api.get(`/sales?from_date=${filterFrom}&to_date=${filterTo}`).catch(() => ({ data: [] })),
      api.get('/clients').catch(() => ({ data: [] })),
    ]).then(([delRes, empRes, salesRes, clientsRes]) => {
      setDeliveries(delRes.data);
      setEmployees(empRes.data);
      setSales(salesRes.data);
      setClients(clientsRes.data);
    }).finally(() => setLoading(false));
  };
  useEffect(fetchData, [filterFrom, filterTo]);

  const handleToggleInRoute = async (delivery: Delivery) => {
    try {
      await api.post(`/deliveries/${delivery.id}/in-route`);
      toast.success('Marcado en ruta');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const handleMarkDelivered = async (deliveryId: string) => {
    try {
      await api.post(`/deliveries/${deliveryId}/delivered`);
      toast.success('Marcado como entregado');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const openMapDialog = (client: Client) => {
    setMapClient(client);
    setMapOpen(true);
  };

  const openPayDialog = (saleId: string) => {
    setPaySaleId(saleId);
    setPayMethod('');
    setPayOpen(true);
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!paySaleId || !payMethod) return;
    setSaving(true);
    try {
      await api.post(`/sales/${paySaleId}/pay`, { payment_method: payMethod });
      toast.success('Pago registrado');
      setPayOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const empMap = new Map(employees.map(e => [e.id, e]));
  const saleMap = new Map(sales.map(s => [s.id, s]));
  const clientMap = new Map(clients.map(c => [c.id, c]));
  const deliveryEmployees = employees.filter(e => e.role === 'delivery' && e.is_active);

  const filtered = filterEmployee === 'all'
    ? deliveries
    : deliveries.filter(d => d.delivery_employee_id === filterEmployee);

  const pendingDels = filtered.filter(d => d.status === 'pending');
  const inRouteDels = filtered.filter(d => d.status === 'in_route');
  const deliveredDels = filtered.filter(d => d.status === 'delivered');
  const sumMoney = (dels: Delivery[]) => dels.reduce((sum, d) => {
    const sale = saleMap.get(d.sale_id);
    return sum + (sale ? Number(sale.total) : 0);
  }, 0);
  const pendingMoney = sumMoney(pendingDels);
  const inRouteMoney = sumMoney(inRouteDels);
  const deliveredMoney = sumMoney(deliveredDels);
  const totalMoney = sumMoney(filtered);

  return (
    <div>
      <PageHeader title="Repartos" description="Control de entregas por repartidor" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Desde</Label>
          <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Hasta</Label>
          <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Repartidor</Label>
          <Select value={filterEmployee} onValueChange={v => setFilterEmployee(sv(v))}>
            <SelectTrigger className="w-[200px]">
              <SelectValue>{(v: string) => v === 'all' ? 'Todos' : empMap.get(v)?.name || 'Todos'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {deliveryEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-yellow-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Pendientes</p>
                <p className="text-sm font-bold truncate">{formatMoney(pendingMoney)}</p>
                <p className="text-xs text-muted-foreground">{pendingDels.length} entregas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">En ruta</p>
                <p className="text-sm font-bold truncate">{formatMoney(inRouteMoney)}</p>
                <p className="text-xs text-muted-foreground">{inRouteDels.length} entregas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Entregados</p>
                <p className="text-sm font-bold truncate">{formatMoney(deliveredMoney)}</p>
                <p className="text-xs text-muted-foreground">{deliveredDels.length} entregas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CircleDollarSign className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-bold truncate">{formatMoney(totalMoney)}</p>
                <p className="text-xs text-muted-foreground">{filtered.length} entregas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Repartidor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ubicacion</TableHead>
                  <TableHead>Pacas</TableHead>
                  <TableHead>Botellones</TableHead>
                  <TableHead>Total venta</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Truck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay repartos</p>
                    </TableCell>
                  </TableRow>
                ) : filtered.map(d => {
                  const sale = saleMap.get(d.sale_id);
                  const client = sale ? clientMap.get(sale.client_id) : undefined;
                  const hasLocation = client && client.latitude && client.longitude;
                  return (
                    <TableRow key={d.id} className={d.status === 'delivered' ? 'opacity-60' : ''}>
                      <TableCell>{d.date}</TableCell>
                      <TableCell className="font-medium">{empMap.get(d.delivery_employee_id)?.name || '-'}</TableCell>
                      <TableCell>{client?.name || '-'}</TableCell>
                      <TableCell>
                        {hasLocation ? (
                          <Button size="sm" variant="outline" onClick={() => openMapDialog(client!)}>
                            <MapPin className="w-3.5 h-3.5 mr-1" />Ver mapa
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">{client?.address || 'Sin ubicacion'}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{d.pacas_delivered}</TableCell>
                      <TableCell>{d.botellones_delivered}</TableCell>
                      <TableCell>{sale ? formatMoney(sale.total) : '-'}</TableCell>
                      <TableCell>
                        {sale?.status === 'paid' ? (
                          <Badge variant="default">{sale.payment_method ? methodLabel[sale.payment_method] || sale.payment_method : 'Pagada'}</Badge>
                        ) : sale ? (
                          <Button size="sm" variant="outline" onClick={() => openPayDialog(sale.id)}>
                            <CircleDollarSign className="w-3.5 h-3.5 mr-1" />Cobrar
                          </Button>
                        ) : '-'}
                      </TableCell>
                      <TableCell><Badge variant={statusVariant(d.status)}>{statusLabel[d.status]}</Badge></TableCell>
                      <TableCell>
                        {d.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleToggleInRoute(d)}>
                              <Truck className="w-3.5 h-3.5 mr-1" />En ruta
                            </Button>
                            <Button size="sm" variant="default" onClick={() => handleMarkDelivered(d.id)}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Entregado
                            </Button>
                          </div>
                        )}
                        {d.status === 'in_route' && (
                          <Button size="sm" variant="default" onClick={() => handleMarkDelivered(d.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Entregado
                          </Button>
                        )}
                        {d.status === 'delivered' && (
                          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Listo
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Map dialog */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ubicacion de {mapClient?.name}</DialogTitle>
          </DialogHeader>
          {mapClient && (
            <div className="space-y-2">
              {mapClient.address && <p className="text-sm text-muted-foreground">{mapClient.address}</p>}
              <LocationMap
                lat={mapClient.latitude ? Number(mapClient.latitude) : null}
                lng={mapClient.longitude ? Number(mapClient.longitude) : null}
                onLocationSelect={() => {}}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar cobro</DialogTitle></DialogHeader>
          <form onSubmit={handlePay} className="space-y-4">
            <div className="space-y-2">
              <Label>Medio de pago</Label>
              <Select value={payMethod || null} onValueChange={v => setPayMethod(sv(v))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar">{(v: string) => methodLabel[v] || 'Seleccionar'}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="nequi">Nequi</SelectItem>
                  <SelectItem value="daviplata">Daviplata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SubmitButton loading={saving} className="w-full" disabled={!payMethod}>Confirmar cobro</SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
