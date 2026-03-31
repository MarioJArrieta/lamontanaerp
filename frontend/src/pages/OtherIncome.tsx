import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, HandCoins, Trash2 } from 'lucide-react';
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
import type { OtherIncome as OtherIncomeType } from '@/types';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

const categoryLabel: Record<string, string> = {
  rental: 'Alquiler',
  interest: 'Intereses',
  refund: 'Reembolso',
  subsidy: 'Subsidio',
  other: 'Otro',
};

export default function OtherIncome() {
  const [incomes, setIncomes] = useState<OtherIncomeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = useState(monthAgo);
  const [filterTo, setFilterTo] = useState(today);

  const [form, setForm] = useState({
    date: today, category: '', description: '', amount: '', notes: '',
  });

  const fetchData = () => {
    setLoading(true);
    api.get(`/finance/income?from_date=${filterFrom}&to_date=${filterTo}`)
      .then(res => setIncomes(res.data))
      .catch(() => toast.error('Error al cargar ingresos'))
      .finally(() => setLoading(false));
  };
  useEffect(fetchData, [filterFrom, filterTo]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/finance/income', {
        date: form.date,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        notes: form.notes || null,
      });
      toast.success('Ingreso registrado');
      setOpen(false);
      setForm({ date: today, category: '', description: '', amount: '', notes: '' });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/finance/income/${id}`);
      toast.success('Ingreso eliminado');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const [page, setPage] = useState(1);
  const pg = paginate(incomes, page);

  return (
    <div>
      <PageHeader
        title="Otros Ingresos"
        description="Ingresos que no son por ventas"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <Button><Plus className="w-4 h-4 mr-2" />Nuevo ingreso</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar ingreso</DialogTitle></DialogHeader>
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
                        <SelectItem value="rental">Alquiler</SelectItem>
                        <SelectItem value="interest">Intereses</SelectItem>
                        <SelectItem value="refund">Reembolso</SelectItem>
                        <SelectItem value="subsidy">Subsidio</SelectItem>
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
                <SubmitButton loading={saving} className="w-full">Registrar ingreso</SubmitButton>
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
            <p className="text-xs text-muted-foreground">Total ingresos</p>
            <p className="text-lg font-bold text-green-600">{formatMoney(totalIncome)}</p>
            <p className="text-xs text-muted-foreground">{incomes.length} registros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Por categoria</p>
            <div className="mt-1 space-y-0.5">
              {Object.entries(
                incomes.reduce<Record<string, number>>((acc, i) => {
                  acc[i.category] = (acc[i.category] || 0) + Number(i.amount);
                  return acc;
                }, {})
              ).map(([cat, total]) => (
                <p key={cat} className="text-xs">
                  <span className="font-medium">{categoryLabel[cat] || cat}:</span> {formatMoney(total)}
                </p>
              ))}
              {incomes.length === 0 && <p className="text-xs text-muted-foreground">-</p>}
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
                {pg.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <HandCoins className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay ingresos registrados</p>
                    </TableCell>
                  </TableRow>
                ) : pg.data.map(inc => (
                  <TableRow key={inc.id}>
                    <TableCell>{inc.date}</TableCell>
                    <TableCell><Badge variant="secondary">{categoryLabel[inc.category] || inc.category}</Badge></TableCell>
                    <TableCell className="font-medium">{inc.description}</TableCell>
                    <TableCell className="font-semibold text-green-600">{formatMoney(inc.amount)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inc.notes || '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(inc.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
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
