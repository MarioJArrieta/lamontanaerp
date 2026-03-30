import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, Factory, Package, AlertTriangle, BarChart3 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';
import { sv } from '@/lib/helpers';
import type { Production as ProductionType, ProductionSummary, Employee, Bobina } from '@/types';

export default function Production() {
  const [productions, setProductions] = useState<ProductionType[]>([]);
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bobinas, setBobinas] = useState<Bobina[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = useState(monthAgo);
  const [filterTo, setFilterTo] = useState(today);

  const [form, setForm] = useState({
    date: today, employee_id: '', pacas_produced: '', botellones_produced: '0',
    waste_pacas: '0', bobina_id: '', notes: '',
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/production?from_date=${filterFrom}&to_date=${filterTo}`),
      api.get(`/production/summary?from_date=${filterFrom}&to_date=${filterTo}`),
      api.get('/employees'),
      api.get('/bobinas?available_only=true'),
    ]).then(([prodRes, sumRes, empRes, bobRes]) => {
      setProductions(prodRes.data);
      setSummary(sumRes.data);
      setEmployees(empRes.data);
      setBobinas(bobRes.data);
    }).finally(() => setLoading(false));
  };
  useEffect(fetchData, [filterFrom, filterTo]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/production', {
        date: form.date,
        employee_id: form.employee_id,
        pacas_produced: Number(form.pacas_produced),
        botellones_produced: Number(form.botellones_produced),
        waste_pacas: Number(form.waste_pacas),
        bobina_id: form.bobina_id || null,
        notes: form.notes || null,
      });
      toast.success('Produccion registrada');
      setOpen(false);
      setForm({ date: today, employee_id: '', pacas_produced: '', botellones_produced: '0', waste_pacas: '0', bobina_id: '', notes: '' });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const empMap = new Map(employees.map(e => [e.id, e]));

  return (
    <div>
      <PageHeader
        title="Produccion"
        description="Registro de produccion diaria"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <Button><Plus className="w-4 h-4 mr-2" />Registrar produccion</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar produccion</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Empleado</Label>
                    <Select value={form.employee_id || null} onValueChange={v => setForm({...form, employee_id: sv(v)})}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar">{(v: string) => employees.find(e => e.id === v)?.name || 'Seleccionar'}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {employees.filter(e => e.role === 'packer').map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Pacas producidas</Label>
                    <Input type="number" value={form.pacas_produced} onChange={e => setForm({...form, pacas_produced: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Botellones</Label>
                    <Input type="number" value={form.botellones_produced} onChange={e => setForm({...form, botellones_produced: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Desperdicio</Label>
                    <Input type="number" value={form.waste_pacas} onChange={e => setForm({...form, waste_pacas: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bobina (opcional)</Label>
                  <Select value={form.bobina_id || null} onValueChange={v => setForm({...form, bobina_id: sv(v)})}>
                    <SelectTrigger><SelectValue placeholder="Ninguna">{(v: string) => { const b = bobinas.find(b => b.id === v); return b ? `${b.weight_kg}kg - ${b.remaining_pacas} restantes` : 'Ninguna'; }}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {bobinas.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.weight_kg}kg - {b.remaining_pacas} pacas restantes</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
                <Button type="submit" className="w-full">Registrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

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

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total pacas" value={summary.total_pacas} icon={Package} />
          <StatCard title="Total botellones" value={summary.total_botellones} icon={Factory} />
          <StatCard title="Desperdicio" value={summary.total_waste} icon={AlertTriangle} />
          <StatCard title="Registros" value={summary.total_records} icon={BarChart3} />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Pacas</TableHead>
                  <TableHead>Botellones</TableHead>
                  <TableHead>Desperdicio</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Factory className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay produccion registrada</p>
                    </TableCell>
                  </TableRow>
                ) : productions.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date}</TableCell>
                    <TableCell className="font-medium">{empMap.get(p.employee_id)?.name || p.employee_id.slice(0, 8)}</TableCell>
                    <TableCell className="font-semibold">{p.pacas_produced}</TableCell>
                    <TableCell>{p.botellones_produced}</TableCell>
                    <TableCell>{p.waste_pacas}</TableCell>
                    <TableCell className="text-muted-foreground">{p.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
