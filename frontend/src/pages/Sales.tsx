import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus, ShoppingCart, CircleDollarSign, Clock, FileText, Package } from 'lucide-react';
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
import type { Sale, Client, Product, Employee, CompanySettings } from '@/types';
import { generateInvoice } from '@/lib/invoice';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

const statusLabel: Record<string, string> = { pending: 'Pendiente', paid: 'Pagada' };
const statusVariant = (s: string) => s === 'paid' ? 'default' as const : 'secondary' as const;
const methodLabel: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata' };

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('');
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientDropRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = useState(monthAgo);
  const [filterTo, setFilterTo] = useState(today);

  const [form, setForm] = useState({
    date: today, client_id: '', delivery_employee_id: '', payment_type: 'cash', notes: '',
    items: [{ product_id: '', quantity: '', unit_price: '' }],
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/sales?from_date=${filterFrom}&to_date=${filterTo}`),
      api.get('/clients'),
      api.get('/products'),
      api.get('/employees'),
    ]).then(([salesRes, clientsRes, productsRes, empRes]) => {
      setSales(salesRes.data);
      setClients(clientsRes.data);
      setProducts(productsRes.data);
      setEmployees(empRes.data);
    }).finally(() => setLoading(false));
    api.get('/settings').then(r => { if (r.data?.id) setCompany(r.data); }).catch(() => {});
  };
  useEffect(fetchData, [filterFrom, filterTo]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.zone?.toLowerCase().includes(q));
  }, [clients, clientSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientDropRef.current && !clientDropRef.current.contains(e.target as Node)) setClientDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { product_id: '', quantity: '', unit_price: '' }] });
  };

  const updateItem = (idx: number, field: string, value: string) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };

  const removeItem = (idx: number) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/sales', {
        date: form.date,
        client_id: form.client_id,
        delivery_employee_id: form.delivery_employee_id,
        payment_type: form.payment_type,
        notes: form.notes || null,
        items: form.items.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: item.unit_price ? Number(item.unit_price) : null,
        })),
      });
      toast.success('Venta creada');
      setOpen(false);
      setClientSearch('');
      setForm({ date: today, client_id: '', delivery_employee_id: '', payment_type: 'cash', notes: '', items: [{ product_id: '', quantity: '', unit_price: '' }] });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

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
      toast.success('Venta marcada como pagada');
      setPayOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const productMap = new Map(products.map(p => [p.id, p]));

  const handleInvoice = async (sale: Sale) => {
    try {
      await generateInvoice(sale, clientMap.get(sale.client_id), productMap, company);
    } catch {
      toast.error('Error al generar factura');
    }
  };
  const deliveryEmployees = employees.filter(e => e.role === 'delivery' && e.is_active);
  const paymentLabel: Record<string, string> = { cash: 'Contado', credit: 'Credito' };

  const paidSales = sales.filter(s => s.status === 'paid');
  const pendingSales = sales.filter(s => s.status === 'pending');
  const paidTotal = paidSales.reduce((sum, s) => sum + Number(s.total), 0);
  const pendingTotal = pendingSales.reduce((sum, s) => sum + Number(s.total), 0);

  const itemsSold = new Map<string, number>();
  for (const s of sales) {
    for (const item of s.items) {
      itemsSold.set(item.product_id, (itemsSold.get(item.product_id) || 0) + item.quantity);
    }
  }

  return (
    <div>
      <PageHeader
        title="Ventas"
        description="Gestion de ventas"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <Button><Plus className="w-4 h-4 mr-2" />Nueva venta</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Crear venta</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <div className="relative" ref={clientDropRef}>
                      <Input
                        placeholder="Buscar cliente..."
                        value={clientDropOpen ? clientSearch : (form.client_id ? clientMap.get(form.client_id)?.name || '' : '')}
                        onFocus={() => { setClientDropOpen(true); setClientSearch(''); }}
                        onChange={e => { setClientSearch(e.target.value); setClientDropOpen(true); }}
                      />
                      {clientDropOpen && (
                        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-white shadow-lg">
                          {filteredClients.length === 0 && <div className="p-2 text-sm text-gray-500">Sin resultados</div>}
                          {filteredClients.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${form.client_id === c.id ? 'bg-gray-50 font-medium' : ''}`}
                              onClick={() => { setForm({...form, client_id: c.id}); setClientDropOpen(false); setClientSearch(''); }}
                            >
                              {c.name}{c.zone ? ` — ${c.zone}` : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Repartidor</Label>
                    <Select value={form.delivery_employee_id || null} onValueChange={v => setForm({...form, delivery_employee_id: sv(v)})}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar">{(v: string) => deliveryEmployees.find(e => e.id === v)?.name || 'Seleccionar'}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {deliveryEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de pago</Label>
                    <Select value={form.payment_type} onValueChange={v => setForm({...form, payment_type: sv(v)})}>
                      <SelectTrigger><SelectValue>{(v: string) => paymentLabel[v] || v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Contado</SelectItem>
                        <SelectItem value="credit">Credito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Agregar item</Button>
                  </div>
                  {form.items.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.unit_price) || (item.product_id ? Number(productMap.get(item.product_id)?.base_price || 0) : 0);
                    const subtotal = qty * price;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="grid grid-cols-4 gap-2 items-end">
                          <Select value={item.product_id || null} onValueChange={v => updateItem(idx, 'product_id', sv(v))}>
                            <SelectTrigger><SelectValue placeholder="Producto">{(v: string) => productMap.get(v)?.name || 'Producto'}</SelectValue></SelectTrigger>
                            <SelectContent>
                              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input type="number" placeholder="Cant." value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} required />
                          <Input type="number" placeholder="Precio (opc.)" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>X</Button>
                        </div>
                        {qty > 0 && price > 0 && (
                          <p className="text-xs text-muted-foreground text-right pr-12">
                            {qty} x {formatMoney(price)} = <span className="font-medium text-foreground">{formatMoney(subtotal)}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const grandTotal = form.items.reduce((sum, item) => {
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.unit_price) || (item.product_id ? Number(productMap.get(item.product_id)?.base_price || 0) : 0);
                    return sum + qty * price;
                  }, 0);
                  return grandTotal > 0 ? (
                    <div className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">Total estimado</span>
                      <span className="text-lg font-bold">{formatMoney(grandTotal)}</span>
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
                <Button type="submit" className="w-full">Crear venta</Button>
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

      <div className="grid grid-cols-4 gap-2 mb-6">
        <Card>
          <CardContent className="px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Pagadas</p>
            <p className="text-sm font-bold truncate">{formatMoney(paidTotal)}</p>
            <p className="text-[10px] text-muted-foreground">{paidSales.length} ventas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Pendientes</p>
            <p className="text-sm font-bold truncate">{formatMoney(pendingTotal)}</p>
            <p className="text-[10px] text-muted-foreground">{pendingSales.length} ventas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="text-sm font-bold truncate">{formatMoney(paidTotal + pendingTotal)}</p>
            <p className="text-[10px] text-muted-foreground">{sales.length} ventas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" />Items vendidos</p>
            <div className="mt-0.5 space-y-0.5">
              {Array.from(itemsSold.entries()).map(([pid, qty]) => (
                <p key={pid} className="text-xs truncate">
                  <span className="font-bold">{qty}</span>{' '}
                  <span className="text-muted-foreground">{productMap.get(pid)?.name || pid}</span>
                </p>
              ))}
              {itemsSold.size === 0 && <p className="text-xs text-muted-foreground">-</p>}
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Repartidor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Medio de pago</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay ventas</p>
                    </TableCell>
                  </TableRow>
                ) : sales.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.date}</TableCell>
                    <TableCell className="font-medium">{clientMap.get(s.client_id)?.name || '-'}</TableCell>
                    <TableCell>{s.items.length} items</TableCell>
                    <TableCell className="font-semibold">{formatMoney(s.total)}</TableCell>
                    <TableCell><Badge variant="outline">{paymentLabel[s.payment_type] || s.payment_type}</Badge></TableCell>
                    <TableCell>{s.delivery_employee_id ? (employees.find(e => e.id === s.delivery_employee_id)?.name || '-') : <span className="text-muted-foreground">Sin asignar</span>}</TableCell>
                    <TableCell><Badge variant={statusVariant(s.status)}>{statusLabel[s.status]}</Badge></TableCell>
                    <TableCell>{s.payment_method ? methodLabel[s.payment_method] : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleInvoice(s)}>
                          <FileText className="w-3.5 h-3.5 mr-1" />Factura
                        </Button>
                        {s.status === 'pending' && (
                          <Button size="sm" variant="default" onClick={() => openPayDialog(s.id)}>Pagar</Button>
                        )}
                      </div>
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
