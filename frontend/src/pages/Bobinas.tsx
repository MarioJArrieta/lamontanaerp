import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, Cylinder, Weight, Package, CircleDollarSign, CircleCheck } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SubmitButton } from '@/components/ui/submit-button';
import api from '@/lib/api';
import type { Bobina } from '@/types';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

export default function Bobinas() {
  const [bobinas, setBobinas] = useState<Bobina[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', purchase_date: today, weight_kg: '', cost: '', estimated_pacas: '250', supplier: '', notes: '' });

  const fetchData = () => {
    api.get('/bobinas').then(r => setBobinas(r.data)).finally(() => setLoading(false));
  };
  useEffect(fetchData, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/bobinas/${editId}`, {
          code: form.code || null,
          purchase_date: form.purchase_date || null,
          weight_kg: form.weight_kg,
          cost: form.cost,
          supplier: form.supplier || null,
          notes: form.notes || null,
        });
        toast.success('Bobina actualizada');
      } else {
        await api.post('/bobinas', {
          code: form.code || null,
          purchase_date: form.purchase_date || null,
          weight_kg: form.weight_kg,
          cost: form.cost,
          estimated_pacas: Number(form.estimated_pacas),
          supplier: form.supplier || null,
          notes: form.notes || null,
        });
        toast.success('Bobina registrada');
      }
      setOpen(false);
      setEditId(null);
      setForm({ code: '', purchase_date: today, weight_kg: '', cost: '', estimated_pacas: '250', supplier: '', notes: '' });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (b: Bobina) => {
    setEditId(b.id);
    setForm({
      code: b.code || '', purchase_date: b.purchase_date || today,
      weight_kg: String(b.weight_kg), cost: String(b.cost),
      estimated_pacas: String(b.estimated_pacas),
      supplier: b.supplier || '', notes: b.notes || '',
    });
    setOpen(true);
  };

  const handleMarkExhausted = async (id: string) => {
    try {
      await api.put(`/bobinas/${id}`, { is_exhausted: true });
      toast.success('Bobina marcada como agotada');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  return (
    <div>
      <PageHeader
        title="Bobinas"
        description="Control de materia prima"
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ code: '', purchase_date: today, weight_kg: '', cost: '', estimated_pacas: '250', supplier: '', notes: '' }); } }}>
            <DialogTrigger>
              <Button><Plus className="w-4 h-4 mr-2" />Nueva bobina</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? 'Editar bobina' : 'Registrar bobina'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Codigo / ID</Label>
                    <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="BOB-001" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de compra</Label>
                    <Input type="date" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Peso (kg)</Label>
                    <Input type="number" step="0.1" value={form.weight_kg} onChange={e => setForm({...form, weight_kg: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Costo</Label>
                    <Input type="number" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {!editId && (
                    <div className="space-y-2">
                      <Label>Pacas estimadas</Label>
                      <Input type="number" value={form.estimated_pacas} onChange={e => setForm({...form, estimated_pacas: e.target.value})} required />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Proveedor</Label>
                    <Input value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
                <SubmitButton loading={saving} className="w-full">{editId ? 'Guardar' : 'Registrar'}</SubmitButton>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {(() => {
        const available = bobinas.filter(b => !b.is_exhausted);
        const totalKg = bobinas.reduce((s, b) => s + Number(b.weight_kg), 0);
        const availableKg = available.reduce((s, b) => s + Number(b.weight_kg), 0);
        const totalPacasRemaining = available.reduce((s, b) => s + b.remaining_pacas, 0);
        const totalCost = bobinas.reduce((s, b) => s + Number(b.cost), 0);
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total kilos" value={`${totalKg.toLocaleString('es-CO')} kg`} icon={Weight} subtitle={`${availableKg.toLocaleString('es-CO')} kg disponibles`} />
            <StatCard title="Pacas restantes" value={totalPacasRemaining.toLocaleString('es-CO')} icon={Package} subtitle={`${available.length} bobinas activas`} />
            <StatCard title="Inversion total" value={formatMoney(totalCost)} icon={CircleDollarSign} subtitle={`${bobinas.length} bobinas`} />
            <StatCard title="Disponibles" value={available.length} icon={CircleCheck} subtitle={`${bobinas.filter(b => b.is_exhausted).length} agotadas`} />
          </div>
        );
      })()}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Fecha compra</TableHead>
                  <TableHead>Peso (kg)</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Pacas estimadas</TableHead>
                  <TableHead>Pacas restantes</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bobinas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Cylinder className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay bobinas registradas</p>
                    </TableCell>
                  </TableRow>
                ) : bobinas.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.code || '-'}</TableCell>
                    <TableCell>{b.purchase_date || '-'}</TableCell>
                    <TableCell>{b.weight_kg} kg</TableCell>
                    <TableCell>{formatMoney(b.cost)}</TableCell>
                    <TableCell>{b.estimated_pacas}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(b.remaining_pacas / b.estimated_pacas) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{b.remaining_pacas}</span>
                      </div>
                    </TableCell>
                    <TableCell>{b.supplier || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={b.is_exhausted ? 'destructive' : 'default'}>
                        {b.is_exhausted ? 'Agotada' : 'Disponible'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(b)}>Editar</Button>
                        {!b.is_exhausted && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleMarkExhausted(b.id)}>Agotar</Button>}
                      </div>
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
