import { useEffect, useState, type FormEvent } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { toast } from 'sonner';
import { Plus, Factory, Package, AlertTriangle, BarChart3, CheckCircle2, DollarSign, LoaderCircle, Pencil, Trash2, Search } from 'lucide-react';
import { Pagination, paginate } from '@/components/ui/pagination';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SubmitButton } from '@/components/ui/submit-button';
import api from '@/lib/api';
import { sv } from '@/lib/helpers';
import type { Production as ProductionType, ProductionSummary, Employee, Bobina } from '@/types';

function formatMoney(val: string | number) {
  return Number(val).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
}

export default function Production() {
  const [productions, setProductions] = useState<ProductionType[]>([]);
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bobinas, setBobinas] = useState<Bobina[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = usePersistedState('production_from', monthAgo);
  const [filterTo, setFilterTo] = usePersistedState('production_to', today);

  const [saving, setSaving] = useState(false);
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
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', date: '', employee_id: '', pacas_produced: '', botellones_produced: '', waste_pacas: '', notes: '' });

  const openEdit = (p: ProductionType) => {
    setEditForm({
      id: p.id, date: p.date, employee_id: p.employee_id,
      pacas_produced: String(p.pacas_produced), botellones_produced: String(p.botellones_produced),
      waste_pacas: String(p.waste_pacas), notes: p.notes || '',
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editForm.date) payload.date = editForm.date;
      if (editForm.employee_id) payload.employee_id = editForm.employee_id;
      if (editForm.pacas_produced !== '') payload.pacas_produced = Number(editForm.pacas_produced);
      if (editForm.botellones_produced !== '') payload.botellones_produced = Number(editForm.botellones_produced);
      if (editForm.waste_pacas !== '') payload.waste_pacas = Number(editForm.waste_pacas);
      payload.notes = editForm.notes || null;
      await api.put(`/production/${editForm.id}`, payload);
      toast.success('Produccion actualizada');
      setEditOpen(false);
      fetchData();
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { detail?: unknown } } })?.response?.data;
      const msg = typeof resp?.detail === 'string' ? resp.detail : JSON.stringify(resp?.detail) || 'Error';
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta produccion? Se revertira el inventario.')) return;
    try {
      await api.delete(`/production/${id}`);
      toast.success('Produccion eliminada');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const [payingId, setPayingId] = useState<string | null>(null);
  const handlePay = async (id: string) => {
    if (payingId) return;
    setPayingId(id);
    try {
      await api.post(`/production/${id}/pay`);
      toast.success('Produccion pagada');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error al pagar';
      toast.error(msg);
    } finally {
      setPayingId(null);
    }
  };

  const empMap = new Map(employees.map(e => [e.id, e]));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = productions.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    const empName = empMap.get(p.employee_id)?.name?.toLowerCase() || '';
    const paidLabel = p.is_paid ? 'pagado' : 'pendiente';
    return (
      p.date.includes(q) ||
      empName.includes(q) ||
      String(p.pacas_produced).includes(q) ||
      String(p.botellones_produced).includes(q) ||
      paidLabel.includes(q) ||
      (p.notes || '').toLowerCase().includes(q)
    );
  });

  const pg = paginate(filtered, page);

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
                    <Select value={form.employee_id || undefined} onValueChange={v => setForm({...form, employee_id: sv(v)})}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
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
                  <Select value={form.bobina_id || undefined} onValueChange={v => setForm({...form, bobina_id: sv(v)})}>
                    <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                    <SelectContent>
                      {bobinas.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.code || b.id.slice(0, 8)} - {b.weight_kg}kg - {b.remaining_pacas} pacas restantes</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
                <SubmitButton loading={saving} className="w-full">Registrar</SubmitButton>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Desde</Label>
          <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Hasta</Label>
          <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-auto" />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empleado, fecha, notas, estado..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8"
          />
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
                  <TableHead>Pago</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Factory className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay produccion registrada</p>
                    </TableCell>
                  </TableRow>
                ) : pg.data.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date}</TableCell>
                    <TableCell className="font-medium">{empMap.get(p.employee_id)?.name || p.employee_id.slice(0, 8)}</TableCell>
                    <TableCell className="font-semibold">{p.pacas_produced}</TableCell>
                    <TableCell>{p.botellones_produced}</TableCell>
                    <TableCell>{p.waste_pacas}</TableCell>
                    <TableCell>
                      {p.is_paid ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="w-3 h-3" />Pagado
                          </Badge>
                          {p.payment_amount && <span className="text-xs text-muted-foreground">{formatMoney(p.payment_amount)}</span>}
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => handlePay(p.id)} disabled={payingId === p.id}>
                          {payingId === p.id ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                          {payingId === p.id ? 'Pagando...' : 'Pagar'}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.notes || '-'}</TableCell>
                    <TableCell>
                      {!p.is_paid && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination page={pg.page} totalPages={pg.totalPages} totalItems={pg.totalItems} pageSize={pg.pageSize} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar produccion</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Empleado</Label>
                <select
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  value={editForm.employee_id}
                  onChange={e => setEditForm({...editForm, employee_id: e.target.value})}
                  required
                >
                  <option value="">Seleccionar</option>
                  {employees.filter(e => e.role === 'packer').map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Pacas producidas</Label>
                <Input type="number" value={editForm.pacas_produced} onChange={e => setEditForm({...editForm, pacas_produced: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Botellones</Label>
                <Input type="number" value={editForm.botellones_produced} onChange={e => setEditForm({...editForm, botellones_produced: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Desperdicio</Label>
                <Input type="number" value={editForm.waste_pacas} onChange={e => setEditForm({...editForm, waste_pacas: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
            </div>
            <SubmitButton loading={editSaving} className="w-full">Guardar cambios</SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
