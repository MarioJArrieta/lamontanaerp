import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { toast } from 'sonner';
import { CheckCircle, DollarSign, AlertTriangle, Clock, Search, ArrowUpDown, ArrowUp, ArrowDown, History, Eye, Package, FileText } from 'lucide-react';
import { Pagination, paginate } from '@/components/ui/pagination';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SubmitButton } from '@/components/ui/submit-button';
import api from '@/lib/api';
import { bogotaDaysAgo, bogotaToday, sv } from '@/lib/helpers';
import type { Sale, Client, Employee, Product } from '@/types';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

const methodLabel: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata' };
const paymentLabel: Record<string, string> = { cash: 'Contado', credit: 'Credito' };

export default function Receivables() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const today = bogotaToday();
  const monthAgo = bogotaDaysAgo(30);
  const [filterFrom, setFilterFrom] = usePersistedState('receivables_from', monthAgo);
  const [filterTo, setFilterTo] = usePersistedState('receivables_to', today);

  const [payOpen, setPayOpen] = useState(false);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('');
  const [payPartial, setPayPartial] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<Sale[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/sales?from_date=${filterFrom}&to_date=${filterTo}&status=pending,partial`),
      api.get('/clients'),
      api.get('/employees'),
      api.get('/products'),
    ]).then(([salesRes, clientsRes, empRes, prodRes]) => {
      setSales(salesRes.data);
      setClients(clientsRes.data);
      setEmployees(empRes.data);
      setProducts(prodRes.data);
    }).finally(() => setLoading(false));
  };
  useEffect(fetchData, [filterFrom, filterTo]);

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get('/sales/collections/today');
      setHistoryData(res.data);
    } catch {
      toast.error('Error al cargar historial');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openDetail = (sale: Sale) => {
    setDetailSale(sale);
    setDetailOpen(true);
  };

  const openPayDialog = (saleId: string) => {
    setPaySaleId(saleId);
    setPayMethod('');
    setPayPartial(false);
    setPayAmount('');
    setPayOpen(true);
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!paySaleId || !payMethod) return;
    setSaving(true);
    try {
      const payload: { payment_method: string; amount?: number } = { payment_method: payMethod };
      if (payPartial && payAmount) {
        payload.amount = Number(payAmount);
      }
      await api.post(`/sales/${paySaleId}/pay`, payload);
      toast.success(payPartial ? 'Abono registrado' : 'Pago registrado');
      setPayOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const productMap = new Map(products.map(p => [p.id, p]));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return sales;
    const q = search.toLowerCase();
    return sales.filter(s => {
      const client = clientMap.get(s.client_id);
      return client?.name.toLowerCase().includes(q);
    });
  }, [sales, search, clientMap]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let va: string | number = '';
      let vb: string | number = '';
      switch (sortCol) {
        case 'date': va = a.date; vb = b.date; break;
        case 'client': va = clientMap.get(a.client_id)?.name || ''; vb = clientMap.get(b.client_id)?.name || ''; break;
        case 'total': va = Number(a.total); vb = Number(b.total); break;
        case 'paid': va = Number(a.paid_amount); vb = Number(b.paid_amount); break;
        case 'balance': va = Number(a.balance); vb = Number(b.balance); break;
        case 'status': va = a.status; vb = b.status; break;
        case 'type': va = a.payment_type; vb = b.payment_type; break;
        case 'employee': {
          va = employees.find(e => e.id === a.delivery_employee_id)?.name || '';
          vb = employees.find(e => e.id === b.delivery_employee_id)?.name || '';
          break;
        }
      }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtered, sortCol, sortDir, clientMap, employees]);

  const pg = paginate(sorted, page);
  const cashSales = filtered.filter(s => s.payment_type === 'cash');
  const creditSales = filtered.filter(s => s.payment_type === 'credit');
  const totalPending = filtered.reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div>
      <PageHeader
        title="Cuentas por Cobrar"
        description="Ventas pendientes de pago"
        action={
          <Button variant="outline" onClick={openHistory}>
            <History className="w-4 h-4 mr-2" />Cobros de hoy
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 w-60"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Desde</Label>
          <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Hasta</Label>
          <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total por cobrar" value={formatMoney(totalPending)} icon={DollarSign} subtitle={`${sales.length} ventas`} />
        <StatCard title="Contado pendiente" value={formatMoney(cashSales.reduce((s, r) => s + Number(r.balance), 0))} icon={Clock} subtitle={`${cashSales.length} ventas`} />
        <StatCard title="Credito pendiente" value={formatMoney(creditSales.reduce((s, r) => s + Number(r.balance), 0))} icon={AlertTriangle} subtitle={`${creditSales.length} ventas`} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('date')}>Fecha<SortIcon col="date" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('client')}>Cliente<SortIcon col="client" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('total')}>Total<SortIcon col="total" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('paid')}>Abonado<SortIcon col="paid" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('balance')}>Saldo<SortIcon col="balance" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>Estado<SortIcon col="status" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('type')}>Tipo pago<SortIcon col="type" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('employee')}>Repartidor<SortIcon col="employee" /></TableHead>
                  <TableHead>Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay ventas pendientes</p>
                    </TableCell>
                  </TableRow>
                ) : pg.data.map(s => {
                  const daysOld = Math.floor((Date.now() - new Date(s.date + 'T00:00:00').getTime()) / 86400000);
                  const overdue = daysOld > 7;
                  return (
                  <TableRow key={s.id} className={overdue ? 'bg-red-50' : ''}>
                    <TableCell>{s.date}</TableCell>
                    <TableCell className="font-medium">{clientMap.get(s.client_id)?.name || '-'}</TableCell>
                    <TableCell className="font-semibold">{formatMoney(s.total)}</TableCell>
                    <TableCell>{Number(s.paid_amount) > 0 ? formatMoney(s.paid_amount) : '-'}</TableCell>
                    <TableCell className="text-destructive font-semibold">{formatMoney(s.balance)}</TableCell>
                    <TableCell><Badge variant={s.status === 'partial' ? 'outline' : 'secondary'}>{s.status === 'partial' ? 'Parcial' : 'Pendiente'}</Badge></TableCell>
                    <TableCell><Badge variant={s.payment_type === 'credit' ? 'destructive' : 'outline'}>{paymentLabel[s.payment_type]}</Badge></TableCell>
                    <TableCell>{s.delivery_employee_id ? (employees.find(e => e.id === s.delivery_employee_id)?.name || '-') : <span className="text-muted-foreground">Sin asignar</span>}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openDetail(s)}>
                          <Eye className="w-4 h-4 mr-1" />Ver detalle
                        </Button>
                        <Button size="sm" variant="default" onClick={() => openPayDialog(s.id)}>Registrar pago</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <Pagination page={pg.page} totalPages={pg.totalPages} totalItems={pg.totalItems} pageSize={pg.pageSize} onPageChange={setPage} />
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detalle de la venta
            </DialogTitle>
          </DialogHeader>
          {detailSale && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{clientMap.get(detailSale.client_id)?.name || '-'}</span>
                <span className="text-muted-foreground">{detailSale.date}</span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <Package className="w-4 h-4" />Productos
                </div>
                {detailSale.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin productos</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailSale.items.map(it => (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">{productMap.get(it.product_id)?.name || 'Producto'}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right">{formatMoney(it.unit_price)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatMoney(it.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg text-sm">
                <span>Total</span>
                <span className="font-bold">{formatMoney(detailSale.total)}</span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <FileText className="w-4 h-4" />Notas
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {detailSale.notes?.trim() ? detailSale.notes : 'Sin notas'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-[95vw] max-w-4xl sm:max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-green-600" />
              Cobros de hoy (ventas anteriores)
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando...</div>
          ) : historyData.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-muted-foreground">No hay cobros registrados hoy</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total cobrado hoy</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatMoney(historyData.reduce((sum, s) => sum + Number(s.paid_amount), 0))}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{historyData.length} cobro{historyData.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Total venta</TableHead>
                      <TableHead>Cobrado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Medio</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{clientMap.get(s.client_id)?.name || '-'}</TableCell>
                        <TableCell>{formatMoney(s.total)}</TableCell>
                        <TableCell className="font-semibold text-green-600">{formatMoney(s.paid_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'paid' ? 'default' : 'outline'}>
                            {s.status === 'paid' ? 'Pagado' : 'Parcial'}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.payment_method ? methodLabel[s.payment_method] || s.payment_method : '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => { setHistoryOpen(false); openDetail(s); }}>
                            <Eye className="w-4 h-4 mr-1" />Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          {(() => {
            const sale = sales.find(s => s.id === paySaleId);
            const balance = sale ? Number(sale.balance) : 0;
            return (
              <form onSubmit={handlePay} className="space-y-4">
                {sale && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                    <div className="flex justify-between"><span>Total:</span><span className="font-semibold">{formatMoney(sale.total)}</span></div>
                    {Number(sale.paid_amount) > 0 && <div className="flex justify-between"><span>Abonado:</span><span>{formatMoney(sale.paid_amount)}</span></div>}
                    <div className="flex justify-between"><span>Saldo:</span><span className="font-bold text-destructive">{formatMoney(balance)}</span></div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Tipo de pago</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={!payPartial ? 'default' : 'outline'} className="flex-1" onClick={() => { setPayPartial(false); setPayAmount(''); }}>Pago total</Button>
                    <Button type="button" size="sm" variant={payPartial ? 'default' : 'outline'} className="flex-1" onClick={() => setPayPartial(true)}>Abono parcial</Button>
                  </div>
                </div>
                {payPartial && (
                  <div className="space-y-2">
                    <Label>Monto del abono</Label>
                    <Input type="number" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} min={1} max={balance} required />
                  </div>
                )}
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
                <SubmitButton loading={saving} className="w-full" disabled={!payMethod || (payPartial && !payAmount)}>
                  {payPartial ? `Abonar ${payAmount ? formatMoney(Number(payAmount)) : ''}` : `Pagar ${formatMoney(balance)}`}
                </SubmitButton>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
