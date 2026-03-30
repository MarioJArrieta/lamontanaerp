import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';
import { sv } from '@/lib/helpers';
import type { Expense } from '@/types';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

const categoryLabel: Record<string, string> = {
  raw_material: 'Materia prima',
  services: 'Servicios',
  transport: 'Transporte',
  payroll: 'Nomina',
  other: 'Otro',
};

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = useState(monthAgo);
  const [filterTo, setFilterTo] = useState(today);

  const [form, setForm] = useState({
    date: today, category: '', description: '', amount: '', notes: '',
  });

  const fetchData = () => {
    setLoading(true);
    api.get(`/finance/expenses?from_date=${filterFrom}&to_date=${filterTo}`)
      .then(res => setExpenses(res.data))
      .catch(() => toast.error('Error al cargar gastos'))
      .finally(() => setLoading(false));
  };
  useEffect(fetchData, [filterFrom, filterTo]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/finance/expenses', {
        date: form.date,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        notes: form.notes || null,
      });
      toast.success('Gasto registrado');
      setOpen(false);
      setForm({ date: today, category: '', description: '', amount: '', notes: '' });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/finance/expenses/${id}`);
      toast.success('Gasto eliminado');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <PageHeader
        title="Gastos"
        description="Registro de gastos de la empresa"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <Button><Plus className="w-4 h-4 mr-2" />Nuevo gasto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar gasto</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.category || undefined} onValueChange={v => setForm({ ...form, category: sv(v) })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw_material">Materia prima</SelectItem>
                        <SelectItem value="services">Servicios</SelectItem>
                        <SelectItem value="transport">Transporte</SelectItem>
                        <SelectItem value="payroll">Nomina</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descripcion</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">Registrar gasto</Button>
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

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Total gastos</p>
            <p className="text-lg font-bold">{formatMoney(totalExpenses)}</p>
            <p className="text-xs text-muted-foreground">{expenses.length} registros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Por categoria</p>
            <div className="mt-1 space-y-0.5">
              {Object.entries(
                expenses.reduce<Record<string, number>>((acc, e) => {
                  acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
                  return acc;
                }, {})
              ).map(([cat, total]) => (
                <p key={cat} className="text-xs">
                  <span className="font-medium">{categoryLabel[cat] || cat}:</span> {formatMoney(total)}
                </p>
              ))}
              {expenses.length === 0 && <p className="text-xs text-muted-foreground">-</p>}
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
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Receipt className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay gastos registrados</p>
                    </TableCell>
                  </TableRow>
                ) : expenses.map(exp => (
                  <TableRow key={exp.id}>
                    <TableCell>{exp.date}</TableCell>
                    <TableCell><Badge variant="secondary">{categoryLabel[exp.category] || exp.category}</Badge></TableCell>
                    <TableCell className="font-medium">{exp.description}</TableCell>
                    <TableCell className="font-semibold text-red-600">{formatMoney(exp.amount)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{exp.notes || '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(exp.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
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
