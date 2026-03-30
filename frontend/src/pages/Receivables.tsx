import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { CheckCircle, DollarSign, AlertTriangle, Clock } from 'lucide-react';
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
  const [filterFrom, setFilterFrom] = useState(monthAgo);
  const [filterTo, setFilterTo] = useState(today);

  const [payOpen, setPayOpen] = useState(false);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/sales?from_date=${filterFrom}&to_date=${filterTo}&status=pending`),
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
    setPayOpen(true);
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!paySaleId || !payMethod) return;
    try {
      await api.post(`/sales/${paySaleId}/pay`, { payment_method: payMethod });
      toast.success('Pago registrado');
      setPayOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const cashSales = sales.filter(s => s.payment_type === 'cash');
  const creditSales = sales.filter(s => s.payment_type === 'credit');
  const totalPending = sales.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div>
      <PageHeader title="Cuentas por Cobrar" description="Ventas pendientes de pago" />

      <div className="flex items-center gap-3 mb-6">
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
        <StatCard title="Contado pendiente" value={formatMoney(cashSales.reduce((s, r) => s + Number(r.total), 0))} icon={Clock} subtitle={`${cashSales.length} ventas`} />
        <StatCard title="Credito pendiente" value={formatMoney(creditSales.reduce((s, r) => s + Number(r.total), 0))} icon={AlertTriangle} subtitle={`${creditSales.length} ventas`} />
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
                  <TableHead>Tipo pago</TableHead>
                  <TableHead>Repartidor</TableHead>
                  <TableHead>Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay ventas pendientes</p>
                    </TableCell>
                  </TableRow>
                ) : sales.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.date}</TableCell>
                    <TableCell className="font-medium">{clientMap.get(s.client_id)?.name || '-'}</TableCell>
                    <TableCell className="font-semibold">{formatMoney(s.total)}</TableCell>
                    <TableCell><Badge variant={s.payment_type === 'credit' ? 'destructive' : 'outline'}>{paymentLabel[s.payment_type]}</Badge></TableCell>
                    <TableCell>{s.delivery_employee_id ? (employees.find(e => e.id === s.delivery_employee_id)?.name || '-') : <span className="text-muted-foreground">Sin asignar</span>}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="default" onClick={() => openPayDialog(s.id)}>Registrar pago</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
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
            <Button type="submit" className="w-full" disabled={!payMethod}>Confirmar pago</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
