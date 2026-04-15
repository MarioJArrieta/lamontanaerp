import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { toast } from 'sonner';
import { CheckCircle, DollarSign, AlertTriangle, Clock, Search } from 'lucide-react';
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
import { sv } from '@/lib/helpers';
import type { Sale, Client, Employee } from '@/types';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

const methodLabel: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata' };
const paymentLabel: Record<string, string> = { cash: 'Contado', credit: 'Credito' };

export default function Receivables() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = usePersistedState('receivables_from', monthAgo);
  const [filterTo, setFilterTo] = usePersistedState('receivables_to', today);

  const [payOpen, setPayOpen] = useState(false);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('');
  const [payPartial, setPayPartial] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/sales?from_date=${filterFrom}&to_date=${filterTo}&status=pending,partial`),
      api.get('/clients'),
      api.get('/employees'),
    ]).then(([salesRes, clientsRes, empRes]) => {
      setSales(salesRes.data);
      setClients(clientsRes.data);
      setEmployees(empRes.data);
    }).finally(() => setLoading(false));
  };
  useEffect(fetchData, [filterFrom, filterTo]);

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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return sales;
    const q = search.toLowerCase();
    return sales.filter(s => {
      const client = clientMap.get(s.client_id);
      return client?.name.toLowerCase().includes(q);
    });
  }, [sales, search, clientMap]);

  const pg = paginate(filtered, page);
  const cashSales = filtered.filter(s => s.payment_type === 'cash');
  const creditSales = filtered.filter(s => s.payment_type === 'credit');
  const totalPending = filtered.reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div>
      <PageHeader title="Cuentas por Cobrar" description="Ventas pendientes de pago" />

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
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Abonado</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tipo pago</TableHead>
                  <TableHead>Repartidor</TableHead>
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
                      <Button size="sm" variant="default" onClick={() => openPayDialog(s.id)}>Registrar pago</Button>
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
