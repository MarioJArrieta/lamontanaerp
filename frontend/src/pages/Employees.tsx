import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, Users } from 'lucide-react';
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
import type { Employee } from '@/types';

function formatMoney(val: string | number | null) {
  if (!val) return '-';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    name: '', cedula: '', role: 'packer', pay_period: 'weekly',
    fixed_salary: '', rate_per_paca: '', rate_per_botellon: '', phone: '',
  });

  const fetchData = () => {
    api.get('/employees').then(r => setEmployees(r.data)).finally(() => setLoading(false));
  };
  useEffect(fetchData, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/employees/${editId}`, {
          name: form.name,
          phone: form.phone || null,
          fixed_salary: form.fixed_salary ? Number(form.fixed_salary) : null,
          rate_per_paca: form.rate_per_paca ? Number(form.rate_per_paca) : null,
          rate_per_botellon: form.rate_per_botellon ? Number(form.rate_per_botellon) : null,
        });
      } else {
        await api.post('/employees', {
          name: form.name,
          cedula: form.cedula,
          role: form.role,
          pay_period: form.pay_period,
          fixed_salary: form.fixed_salary ? Number(form.fixed_salary) : null,
          rate_per_paca: form.rate_per_paca ? Number(form.rate_per_paca) : null,
          rate_per_botellon: form.rate_per_botellon ? Number(form.rate_per_botellon) : null,
          phone: form.phone || null,
        });
      }
      toast.success(editId ? 'Empleado actualizado' : 'Empleado creado');
      setOpen(false);
      setEditId(null);
      setForm({ name: '', cedula: '', role: 'packer', pay_period: 'weekly', fixed_salary: '', rate_per_paca: '', rate_per_botellon: '', phone: '' });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error al crear';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (emp: Employee) => {
    setEditId(emp.id);
    setForm({
      name: emp.name, cedula: emp.cedula, role: emp.role, pay_period: emp.pay_period,
      fixed_salary: emp.fixed_salary || '', rate_per_paca: emp.rate_per_paca || '', rate_per_botellon: emp.rate_per_botellon || '', phone: emp.phone || '',
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.put(`/employees/${id}`, { is_active: false });
      toast.success('Empleado desactivado');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const roleLabel: Record<string, string> = { packer: 'Empacador', delivery: 'Repartidor', secretary: 'Secretaria' };
  const payPeriodLabel: Record<string, string> = { weekly: 'Semanal', monthly: 'Mensual' };
  const roleBadgeVariant = (role: string) => role === 'packer' ? 'default' as const : role === 'delivery' ? 'secondary' as const : 'outline' as const;
  const pg = paginate(employees, page);

  return (
    <div>
      <PageHeader
        title="Empleados"
        description="Gestion de empleados de La Montana"
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ name: '', cedula: '', role: 'packer', pay_period: 'weekly', fixed_salary: '', rate_per_paca: '', rate_per_botellon: '', phone: '' }); } }}>
            <DialogTrigger>
              <Button><Plus className="w-4 h-4 mr-2" />Nuevo empleado</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? 'Editar empleado' : 'Crear empleado'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Cedula</Label>
                    <Input value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} required disabled={!!editId} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select value={form.role} onValueChange={v => setForm({...form, role: sv(v), pay_period: sv(v) === 'secretary' ? 'monthly' : 'weekly'})} disabled={!!editId}>
                      <SelectTrigger><SelectValue>{(v: string) => roleLabel[v] || v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="packer">Empacador</SelectItem>
                        <SelectItem value="delivery">Repartidor</SelectItem>
                        <SelectItem value="secretary">Secretaria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Periodo de pago</Label>
                    <Select value={form.pay_period} onValueChange={v => setForm({...form, pay_period: sv(v)})} disabled={!!editId}>
                      <SelectTrigger><SelectValue>{(v: string) => payPeriodLabel[v] || v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.role === 'secretary' ? (
                  <div className="space-y-2">
                    <Label>Salario fijo</Label>
                    <Input type="number" value={form.fixed_salary} onChange={e => setForm({...form, fixed_salary: e.target.value})} placeholder="1500000" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tarifa por paca</Label>
                      <Input type="number" value={form.rate_per_paca} onChange={e => setForm({...form, rate_per_paca: e.target.value})} placeholder="200" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tarifa por botellon</Label>
                      <Input type="number" value={form.rate_per_botellon} onChange={e => setForm({...form, rate_per_botellon: e.target.value})} placeholder="200" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Telefono (opcional)</Label>
                  <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
                <SubmitButton loading={saving} className="w-full">{editId ? 'Guardar' : 'Crear'}</SubmitButton>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cedula</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Salario/Tarifa</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay empleados registrados</p>
                    </TableCell>
                  </TableRow>
                ) : pg.data.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.cedula}</TableCell>
                    <TableCell><Badge variant={roleBadgeVariant(emp.role)}>{roleLabel[emp.role]}</Badge></TableCell>
                    <TableCell>{emp.pay_period === 'weekly' ? 'Semanal' : 'Mensual'}</TableCell>
                    <TableCell>{emp.role === 'secretary' ? formatMoney(emp.fixed_salary) : (
                      <span>{emp.rate_per_paca ? `${formatMoney(emp.rate_per_paca)}/paca` : ''}{emp.rate_per_paca && emp.rate_per_botellon ? ', ' : ''}{emp.rate_per_botellon ? `${formatMoney(emp.rate_per_botellon)}/bot.` : ''}</span>
                    )}</TableCell>
                    <TableCell>{emp.phone || '-'}</TableCell>
                    <TableCell><Badge variant={emp.is_active ? 'default' : 'destructive'}>{emp.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(emp)}>Editar</Button>
                        {emp.is_active && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(emp.id)}>Eliminar</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination page={pg.page} totalPages={pg.totalPages} totalItems={pg.totalItems} pageSize={pg.pageSize} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
