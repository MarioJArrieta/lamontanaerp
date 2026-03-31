import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Wallet, DollarSign, Calculator } from 'lucide-react';
import { Pagination, paginate } from '@/components/ui/pagination';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
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
import type { Payroll as PayrollType, Employee } from '@/types';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

const roleLabel: Record<string, string> = { packer: 'Empacador', delivery: 'Repartidor', secretary: 'Secretaria' };

export default function Payroll() {
  const [payrolls, setPayrolls] = useState<PayrollType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCalc, setOpenCalc] = useState(false);
  const [openAdv, setOpenAdv] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

  const now = new Date();
  const dayOfWeek = now.getDay();
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const thisSunday = new Date(lastMonday);
  thisSunday.setDate(lastMonday.getDate() + 6);

  const [calcForm, setCalcForm] = useState({
    employee_id: '',
    period_start: lastMonday.toISOString().split('T')[0],
    period_end: thisSunday.toISOString().split('T')[0],
    deductions: '0',
    notes: '',
  });

  const [advForm, setAdvForm] = useState({
    employee_id: '', amount: '', date: today, notes: '',
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/payroll?from_date=${threeMonthsAgo}&to_date=${today}`),
      api.get('/employees'),
    ]).then(([payRes, empRes]) => {
      setPayrolls(payRes.data);
      setEmployees(empRes.data);
    }).catch(() => {
      toast.error('Error al cargar nominas');
    }).finally(() => setLoading(false));
  };
  useEffect(fetchData, []);

  const handleCalculate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/payroll/calculate', {
        employee_id: calcForm.employee_id,
        period_start: calcForm.period_start,
        period_end: calcForm.period_end,
        deductions: Number(calcForm.deductions),
        notes: calcForm.notes || null,
      });
      toast.success('Nomina calculada');
      setOpenCalc(false);
      setCalcForm({ employee_id: '', period_start: lastMonday.toISOString().split('T')[0], period_end: thisSunday.toISOString().split('T')[0], deductions: '0', notes: '' });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/payroll/advances', {
        employee_id: advForm.employee_id,
        amount: Number(advForm.amount),
        date: advForm.date,
        notes: advForm.notes || null,
      });
      toast.success('Adelanto registrado');
      setOpenAdv(false);
      setAdvForm({ employee_id: '', amount: '', date: today, notes: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (id: string) => {
    try {
      await api.post(`/payroll/${id}/pay`);
      toast.success('Nomina marcada como pagada');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const empMap = new Map(employees.map(e => [e.id, e]));
  const [page, setPage] = useState(1);
  const pg = paginate(payrolls, page);
  const totalCalculated = payrolls.filter(p => p.status === 'calculated').reduce((s, p) => s + Number(p.net_pay), 0);
  const totalPaid = payrolls.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.net_pay), 0);

  return (
    <div>
      <PageHeader
        title="Nomina"
        description="Calculo y gestion de pagos"
        action={
          <div className="flex gap-2">
            <Dialog open={openAdv} onOpenChange={setOpenAdv}>
              <DialogTrigger>
                <Button variant="outline"><DollarSign className="w-4 h-4 mr-2" />Adelanto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar adelanto</DialogTitle></DialogHeader>
                <form onSubmit={handleAdvance} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Empleado</Label>
                    <Select value={advForm.employee_id || null} onValueChange={v => setAdvForm({...advForm, employee_id: sv(v)})}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar">{(v: string) => { const e = employees.find(e => e.id === v); return e ? `${e.name} (${roleLabel[e.role]})` : 'Seleccionar'; }}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({roleLabel[e.role]})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto</Label>
                      <Input type="number" value={advForm.amount} onChange={e => setAdvForm({...advForm, amount: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha</Label>
                      <Input type="date" value={advForm.date} onChange={e => setAdvForm({...advForm, date: e.target.value})} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Input value={advForm.notes} onChange={e => setAdvForm({...advForm, notes: e.target.value})} />
                  </div>
                  <SubmitButton loading={saving} className="w-full">Registrar adelanto</SubmitButton>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={openCalc} onOpenChange={setOpenCalc}>
              <DialogTrigger>
                <Button><Calculator className="w-4 h-4 mr-2" />Calcular nomina</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Calcular nomina</DialogTitle></DialogHeader>
                <form onSubmit={handleCalculate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Empleado</Label>
                    <Select value={calcForm.employee_id || null} onValueChange={v => setCalcForm({...calcForm, employee_id: sv(v)})}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar">{(v: string) => { const e = employees.find(e => e.id === v); return e ? `${e.name} (${roleLabel[e.role]})` : 'Seleccionar'; }}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({roleLabel[e.role]})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Inicio periodo</Label>
                      <Input type="date" value={calcForm.period_start} onChange={e => setCalcForm({...calcForm, period_start: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Fin periodo</Label>
                      <Input type="date" value={calcForm.period_end} onChange={e => setCalcForm({...calcForm, period_end: e.target.value})} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Deducciones adicionales</Label>
                    <Input type="number" value={calcForm.deductions} onChange={e => setCalcForm({...calcForm, deductions: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Input value={calcForm.notes} onChange={e => setCalcForm({...calcForm, notes: e.target.value})} />
                  </div>
                  <SubmitButton loading={saving} className="w-full">Calcular</SubmitButton>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Por pagar" value={formatMoney(totalCalculated)} icon={Calculator} subtitle={`${payrolls.filter(p => p.status === 'calculated').length} nominas`} />
        <StatCard title="Total pagado" value={formatMoney(totalPaid)} icon={DollarSign} subtitle={`${payrolls.filter(p => p.status === 'paid').length} nominas`} />
        <StatCard title="Total nominas" value={payrolls.length} icon={Wallet} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Adelantos</TableHead>
                  <TableHead>Neto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Wallet className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay nominas calculadas</p>
                    </TableCell>
                  </TableRow>
                ) : pg.data.map(p => {
                  const emp = empMap.get(p.employee_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{emp?.name || '-'}</TableCell>
                      <TableCell><Badge variant="secondary">{emp ? roleLabel[emp.role] : '-'}</Badge></TableCell>
                      <TableCell className="text-sm">{p.period_start} a {p.period_end}</TableCell>
                      <TableCell>
                        {p.units_in_period > 0 ? (
                          <span>{p.units_in_period} pacas {p.rate ? `x ${formatMoney(p.rate)}` : ''}</span>
                        ) : (
                          <span className="text-muted-foreground">Fijo</span>
                        )}
                      </TableCell>
                      <TableCell>{formatMoney(p.base_pay)}</TableCell>
                      <TableCell className={Number(p.advances_deducted) > 0 ? 'text-red-600' : ''}>
                        {Number(p.advances_deducted) > 0 ? `-${formatMoney(p.advances_deducted)}` : '-'}
                      </TableCell>
                      <TableCell className="font-semibold">{formatMoney(p.net_pay)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'paid' ? 'default' : 'secondary'}>
                          {p.status === 'paid' ? 'Pagada' : 'Calculada'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.status === 'calculated' && (
                          <Button size="sm" onClick={() => handlePay(p.id)}>Pagar</Button>
                        )}
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
    </div>
  );
}
