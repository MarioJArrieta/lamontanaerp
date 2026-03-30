import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, Package } from 'lucide-react';
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
import type { Product, Inventory } from '@/types';

const unitLabel: Record<string, string> = { paca: 'Paca', botellon: 'Botellon', unidad: 'Unidad' };

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', product_type: 'paca_x40', unit: 'paca', base_price: '' });
  const [stockOpen, setStockOpen] = useState(false);
  const [stockProductId, setStockProductId] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockNotes, setStockNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    Promise.all([
      api.get('/products'),
      api.get('/inventory'),
    ]).then(([prodRes, invRes]) => {
      setProducts(prodRes.data);
      setInventory(invRes.data);
    }).finally(() => setLoading(false));
  };
  useEffect(fetchData, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/products/${editId}`, { name: form.name, base_price: form.base_price });
        toast.success('Producto actualizado');
      } else {
        await api.post('/products', form);
        toast.success('Producto creado');
      }
      setOpen(false);
      setEditId(null);
      setForm({ name: '', product_type: 'paca_x40', unit: 'paca', base_price: '' });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({ name: p.name, product_type: p.product_type, unit: p.unit, base_price: p.base_price });
    setOpen(true);
  };

  const stockMap = new Map(inventory.map(i => [i.product_id, i.quantity]));

  const openStockDialog = (productId: string) => {
    setStockProductId(productId);
    setStockQty('');
    setStockNotes('');
    setStockOpen(true);
  };

  const handleStockAdjust = async (e: FormEvent) => {
    e.preventDefault();
    if (!stockProductId || !stockQty) return;
    setSaving(true);
    try {
      await api.post('/inventory/adjustments', {
        product_id: stockProductId,
        quantity: Number(stockQty),
        notes: stockNotes || null,
      });
      toast.success('Stock ajustado');
      setStockOpen(false);
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
      await api.put(`/products/${id}`, { is_active: false });
      toast.success('Producto desactivado');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Catalogo de productos"
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ name: '', product_type: 'paca_x40', unit: 'paca', base_price: '' }); } }}>
            <DialogTrigger>
              <Button><Plus className="w-4 h-4 mr-2" />Nuevo producto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? 'Editar producto' : 'Crear producto'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                {!editId && (
                  <div className="space-y-2">
                    <Label>Unidad</Label>
                    <Select value={form.unit} onValueChange={v => setForm({...form, unit: sv(v)})}>
                      <SelectTrigger><SelectValue>{(v: string) => unitLabel[v] || v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paca">Paca</SelectItem>
                        <SelectItem value="botellon">Botellon</SelectItem>
                        <SelectItem value="unidad">Unidad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Precio base</Label>
                  <Input type="number" value={form.base_price} onChange={e => setForm({...form, base_price: e.target.value})} required />
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
                  <TableHead>Unidad</TableHead>
                  <TableHead>Precio base</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay productos</p>
                    </TableCell>
                  </TableRow>
                ) : products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell>{formatMoney(p.base_price)}</TableCell>
                    <TableCell className="font-semibold">{stockMap.get(p.id) ?? 0}</TableCell>
                    <TableCell><Badge variant={p.is_active ? 'default' : 'destructive'}>{p.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Editar</Button>
                        <Button size="sm" variant="outline" onClick={() => openStockDialog(p.id)}>Stock</Button>
                        {p.is_active && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}>Eliminar</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar stock</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stock actual: <span className="font-semibold text-foreground">{stockProductId ? (stockMap.get(stockProductId) ?? 0) : 0}</span>
          </p>
          <form onSubmit={handleStockAdjust} className="space-y-4">
            <div className="space-y-2">
              <Label>Cantidad (positivo para agregar, negativo para restar)</Label>
              <Input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} required placeholder="ej: 50 o -10" />
            </div>
            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Input value={stockNotes} onChange={e => setStockNotes(e.target.value)} placeholder="Razon del ajuste" />
            </div>
            <SubmitButton loading={saving} className="w-full" disabled={!stockQty}>Ajustar</SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
