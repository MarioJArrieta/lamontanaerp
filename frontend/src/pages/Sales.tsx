import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Pagination, paginate } from '@/components/ui/pagination';
import { toast } from 'sonner';
import { Plus, ShoppingCart, FileText, Package, Trash2, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, Cloud, Lock, Download, Printer, Coins, X } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { SubmitButton } from '@/components/ui/submit-button';
import api from '@/lib/api';
import { bogotaDaysAgo, bogotaToday, sv } from '@/lib/helpers';
import type { Sale, Client, Product, Employee, CompanySettings } from '@/types';
import { generateInvoicePdf, generateInvoiceHtml } from '@/lib/invoice';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

const statusLabel: Record<string, string> = { pending: 'Pendiente', partial: 'Parcial', paid: 'Pagada' };
const statusVariant = (s: string) => s === 'paid' ? 'default' as const : s === 'partial' ? 'outline' as const : 'secondary' as const;
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
  const [payPartial, setPayPartial] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientDropRef = useRef<HTMLDivElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null);
  const [generatingElectronic, setGeneratingElectronic] = useState(false);
  const [dianFormat, setDianFormat] = useState<'letter' | 'thermal'>('letter');
  const [statsScope, setStatsScope] = useState<'today' | 'range'>('today');
  const [searchQuery, setSearchQuery] = usePersistedState('sales_search', '');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMethod, setBulkMethod] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Depura la seleccion cuando cambian las ventas (tras cobrar/eliminar):
  // descarta ids que ya no existen o que quedaron pagadas.
  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      const selectable = new Set(sales.filter(s => s.status !== 'paid').map(s => s.id));
      const next = new Set([...prev].filter(id => selectable.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sales]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />;
  };

  const today = bogotaToday();
  const monthAgo = bogotaDaysAgo(30);
  const [filterFrom, setFilterFrom] = usePersistedState('sales_from', monthAgo);
  const [filterTo, setFilterTo] = usePersistedState('sales_to', today);

  const [form, setForm] = useState({
    date: today, client_id: '', delivery_employee_id: '', payment_type: 'cash', notes: '',
    mark_paid: false, payment_method: 'cash',
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
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.delivery_zone?.toLowerCase().includes(q));
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
    if (!form.client_id) { toast.error('Selecciona un cliente'); return; }
    if (!form.delivery_employee_id) { toast.error('Selecciona un repartidor'); return; }
    if (!form.items.length || form.items.some(i => !i.product_id || !i.quantity)) {
      toast.error('Agrega al menos un producto con cantidad'); return;
    }
    setSaving(true);
    try {
      const isMarkPaid = form.mark_paid && form.payment_type === 'cash';
      await api.post('/sales', {
        date: form.date,
        client_id: form.client_id,
        delivery_employee_id: form.delivery_employee_id,
        payment_type: form.payment_type,
        notes: form.notes || null,
        mark_paid: isMarkPaid,
        payment_method: isMarkPaid ? form.payment_method : null,
        items: form.items.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: item.unit_price ? Number(item.unit_price) : null,
        })),
      });
      toast.success(isMarkPaid ? 'Venta creada y cobrada' : 'Venta creada');
      setOpen(false);
      setClientSearch('');
      setForm({ date: today, client_id: '', delivery_employee_id: '', payment_type: 'cash', notes: '', mark_paid: false, payment_method: 'cash', items: [{ product_id: '', quantity: '', unit_price: '' }] });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openPayDialog = (saleId: string) => {
    setPaySaleId(saleId);
    setPayMethod('');
    setPayPartial(false);
    setPayAmount('');
    setPayOpen(true);
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!paySaleId || !payMethod) return;
    setSaving(true);
    try {
      const payload: { payment_method: string; amount?: number } = { payment_method: payMethod };
      if (payPartial && payAmount) {
        payload.amount = Number(payAmount);
      }
      await api.post(`/sales/${paySaleId}/pay`, payload);
      toast.success(payPartial ? 'Abono registrado' : 'Venta marcada como pagada');
      setPayOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const setManySelected = (ids: string[], on: boolean) => setSelectedIds(prev => {
    const next = new Set(prev);
    for (const id of ids) { if (on) next.add(id); else next.delete(id); }
    return next;
  });

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkPay = async (e: FormEvent) => {
    e.preventDefault();
    const ids = [...selectedIds];
    if (ids.length === 0 || !bulkMethod) return;
    setBulkSaving(true);
    try {
      const { data } = await api.post('/sales/bulk-pay', { sale_ids: ids, payment_method: bulkMethod });
      const paidCount = data.count_paid ?? 0;
      const skipped = data.skipped?.length ?? 0;
      toast.success(
        `${paidCount} venta${paidCount === 1 ? '' : 's'} cobrada${paidCount === 1 ? '' : 's'} · ${formatMoney(data.total_collected || 0)}`
        + (skipped ? ` · ${skipped} omitida${skipped === 1 ? '' : 's'}` : ''),
      );
      setBulkOpen(false);
      clearSelection();
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setBulkSaving(false);
    }
  };

  const openDeleteDialog = (saleId: string) => {
    setDeleteSaleId(saleId);
    setDeletePassword('');
    setDeleteOpen(true);
  };

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!deleteSaleId || !deletePassword) return;
    setSaving(true);
    try {
      await api.post(`/sales/${deleteSaleId}/delete`, { admin_password: deletePassword });
      toast.success('Venta eliminada');
      setDeleteOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const productMap = new Map(products.map(p => [p.id, p]));

  const openInvoiceModal = (sale: Sale) => {
    setInvoiceSale(sale);
  };

  const handleInternalInvoice = async () => {
    if (!invoiceSale) return;
    try {
      await generateInvoicePdf(invoiceSale, clientMap.get(invoiceSale.client_id), productMap, company);
      setInvoiceSale(null);
    } catch {
      toast.error('Error al generar factura');
    }
  };

  const handleInternalInvoiceHtml = async () => {
    if (!invoiceSale) return;
    try {
      await generateInvoiceHtml(invoiceSale, clientMap.get(invoiceSale.client_id), productMap, company);
      setInvoiceSale(null);
    } catch {
      toast.error('Error al generar factura');
    }
  };

  const handleElectronicInvoice = async () => {
    if (!invoiceSale) return;
    setGeneratingElectronic(true);
    try {
      const res = await api.post(`/sales/${invoiceSale.id}/electronic-invoice`);
      const docNumber = res.data?.document_number;
      const status = res.data?.status;
      const saleId = invoiceSale.id;
      if (status === 'accepted') {
        toast.success(`Factura electrónica ${docNumber || ''} aceptada por DIAN`, {
          duration: 10000,
          action: { label: 'Descargar PDF', onClick: () => downloadDianPdf(saleId, docNumber) },
        });
        fetchData();
      } else {
        toast.success(`Factura electrónica ${docNumber || ''} enviada`, { duration: 8000 });
      }
      setInvoiceSale(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error al generar factura electrónica';
      toast.error(msg, { duration: 8000 });
    } finally {
      setGeneratingElectronic(false);
    }
  };

  const downloadDianPdf = async (saleId: string, docNumber?: string | null, format: 'letter' | 'thermal' = 'letter') => {
    try {
      const res = await api.get(`/sales/${saleId}/electronic-invoice/pdf`, {
        responseType: 'blob',
        params: { format },
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = format === 'thermal' ? '-80mm' : '';
      a.download = `${docNumber || 'factura'}${suffix}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'No se pudo descargar el PDF';
      toast.error(msg);
    }
  };
  const deliveryEmployees = employees.filter(e => e.role === 'delivery' && e.is_active);
  const paymentLabel: Record<string, string> = { cash: 'Contado', credit: 'Credito' };

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const q = searchQuery.toLowerCase();
    return sales.filter(s => {
      const clientName = clientMap.get(s.client_id)?.name?.toLowerCase() || '';
      const clientZone = clientMap.get(s.client_id)?.delivery_zone?.toLowerCase() || '';
      const empName = employees.find(e => e.id === s.delivery_employee_id)?.name?.toLowerCase() || '';
      const notes = s.notes?.toLowerCase() || '';
      const status = statusLabel[s.status]?.toLowerCase() || '';
      const payType = paymentLabel[s.payment_type]?.toLowerCase() || '';
      return clientName.includes(q) || clientZone.includes(q) || empName.includes(q) || notes.includes(q) || status.includes(q) || payType.includes(q) || s.date.includes(q);
    });
  }, [sales, searchQuery, clients, employees]);

  const sortedSales = useMemo(() => {
    if (!sortCol) return filteredSales;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredSales].sort((a, b) => {
      let va: string | number = '';
      let vb: string | number = '';
      switch (sortCol) {
        case 'date': va = a.date; vb = b.date; break;
        case 'client': va = clientMap.get(a.client_id)?.name || ''; vb = clientMap.get(b.client_id)?.name || ''; break;
        case 'total': va = Number(a.total); vb = Number(b.total); break;
        case 'paid': va = Number(a.paid_amount); vb = Number(b.paid_amount); break;
        case 'balance': va = Number(a.balance); vb = Number(b.balance); break;
        case 'type': va = a.payment_type; vb = b.payment_type; break;
        case 'employee': {
          va = employees.find(e => e.id === a.delivery_employee_id)?.name || '';
          vb = employees.find(e => e.id === b.delivery_employee_id)?.name || '';
          break;
        }
        case 'status': va = a.status; vb = b.status; break;
        case 'method': va = a.payment_method || ''; vb = b.payment_method || ''; break;
      }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filteredSales, sortCol, sortDir, clientMap, employees]);

  const statsSales = useMemo(() => {
    if (statsScope === 'today') return filteredSales.filter(s => s.date === today);
    return filteredSales;
  }, [filteredSales, statsScope, today]);

  const paidSales = statsSales.filter(s => s.status === 'paid' || s.status === 'partial');
  const pendingSales = statsSales.filter(s => s.status !== 'paid');
  const paidTotal = statsSales.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
  const pendingTotal = statsSales.reduce((sum, s) => sum + Number(s.balance || 0), 0);

  const itemsSold = new Map<string, number>();
  for (const s of statsSales) {
    for (const item of (s.items || [])) {
      itemsSold.set(item.product_id, (itemsSold.get(item.product_id) || 0) + item.quantity);
    }
  }

  const pg = paginate(sortedSales, page);

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
                              {c.name}{c.delivery_zone ? ` — ${c.delivery_zone}` : ''}
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
                    <Select value={form.payment_type} onValueChange={v => setForm({...form, payment_type: sv(v), mark_paid: sv(v) === 'credit' ? false : form.mark_paid})}>
                      <SelectTrigger><SelectValue>{(v: string) => paymentLabel[v] || v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Contado</SelectItem>
                        <SelectItem value="credit">Credito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.payment_type === 'cash' && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="cursor-pointer">Cobrado</Label>
                        <p className="text-xs text-muted-foreground">Marca la venta como pagada al instante</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.mark_paid}
                        onClick={() => setForm({ ...form, mark_paid: !form.mark_paid })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.mark_paid ? 'bg-emerald-600' : 'bg-gray-300'}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${form.mark_paid ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                    {form.mark_paid && (
                      <div className="space-y-2">
                        <Label>Medio de pago</Label>
                        <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: sv(v)})}>
                          <SelectTrigger><SelectValue>{(v: string) => methodLabel[v] || v}</SelectValue></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                            <SelectItem value="nequi">Nequi</SelectItem>
                            <SelectItem value="daviplata">Daviplata</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

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
                  let subtotal = 0;
                  let tax = 0;
                  for (const item of form.items) {
                    const qty = Number(item.quantity) || 0;
                    const product = item.product_id ? productMap.get(item.product_id) : undefined;
                    const displayPrice = Number(item.unit_price) || (product ? Number(product.base_price) : 0);
                    const taxRate = Number(product?.tax_rate ?? 0);
                    const taxIncluded = product?.tax_included === true;
                    let netPrice = displayPrice;
                    if (taxIncluded && taxRate > 0) {
                      netPrice = displayPrice / (1 + taxRate / 100);
                    }
                    const lineSubtotal = qty * netPrice;
                    subtotal += lineSubtotal;
                    tax += lineSubtotal * taxRate / 100;
                  }
                  const grandTotal = subtotal + tax;
                  return grandTotal > 0 ? (
                    <div className="space-y-1 py-2 px-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatMoney(subtotal)}</span>
                      </div>
                      {tax > 0 && (
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <span>IVA</span>
                          <span>{formatMoney(tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1 border-t">
                        <span className="text-sm font-medium">Total estimado</span>
                        <span className="text-lg font-bold">{formatMoney(grandTotal)}</span>
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
                <SubmitButton loading={saving} className="w-full">Crear venta</SubmitButton>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex items-center gap-3 mb-6 flex-wrap">
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
            placeholder="Buscar por cliente, zona, repartidor, notas..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Resumen {statsScope === 'today' ? 'de hoy' : 'del rango filtrado'}
        </p>
        <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setStatsScope('today')}
            className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${
              statsScope === 'today' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setStatsScope('range')}
            className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${
              statsScope === 'range' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Rango
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        <Card>
          <CardContent className="px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Pagadas</p>
            <p className="text-sm font-bold truncate">{formatMoney(paidTotal)}</p>
            <p className="text-[10px] text-muted-foreground">{paidSales.length} ventas</p>
            <div className="mt-1 space-y-0.5">
              {Object.entries(
                paidSales.reduce<Record<string, number>>((acc, s) => {
                  const m = s.payment_method || 'sin_metodo';
                  acc[m] = (acc[m] || 0) + Number(s.paid_amount || 0);
                  return acc;
                }, {})
              ).map(([method, total]) => (
                <p key={method} className="text-[10px]">
                  <span className="font-medium">{methodLabel[method] || method}:</span> {formatMoney(total)}
                </p>
              ))}
            </div>
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
            <p className="text-[10px] text-muted-foreground">{statsSales.length} ventas</p>
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

      {selectedIds.size > 0 && (() => {
        const selectedSales = sales.filter(s => selectedIds.has(s.id));
        const totalBalance = selectedSales.reduce((sum, s) => sum + Number(s.balance || 0), 0);
        return (
          <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 shadow-sm">
            <Coins className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">
              {selectedIds.size} venta{selectedIds.size === 1 ? '' : 's'} seleccionada{selectedIds.size === 1 ? '' : 's'}
              <span className="ml-2 text-muted-foreground">Saldo total: <span className="font-semibold text-foreground">{formatMoney(totalBalance)}</span></span>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={clearSelection}><X className="mr-1 h-3.5 w-3.5" />Limpiar</Button>
              <Button size="sm" onClick={() => { setBulkMethod(''); setBulkOpen(true); }}>
                <Coins className="mr-1 h-3.5 w-3.5" />Cobrar seleccionadas
              </Button>
            </div>
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
                  <TableHead className="w-10">
                    {(() => {
                      const selectable = pg.data.filter(s => s.status !== 'paid').map(s => s.id);
                      const allSel = selectable.length > 0 && selectable.every(id => selectedIds.has(id));
                      const someSel = selectable.some(id => selectedIds.has(id));
                      return (
                        <Checkbox
                          aria-label="Seleccionar todo"
                          disabled={selectable.length === 0}
                          checked={allSel}
                          indeterminate={someSel && !allSel}
                          onChange={e => setManySelected(selectable, e.target.checked)}
                        />
                      );
                    })()}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('date')}>Fecha<SortIcon col="date" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('client')}>Cliente<SortIcon col="client" /></TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('total')}>Total<SortIcon col="total" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('paid')}>Abonado<SortIcon col="paid" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('balance')}>Saldo<SortIcon col="balance" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('type')}>Tipo<SortIcon col="type" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('employee')}>Repartidor<SortIcon col="employee" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>Estado<SortIcon col="status" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('method')}>Medio de pago<SortIcon col="method" /></TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay ventas</p>
                    </TableCell>
                  </TableRow>
                ) : pg.data.map(s => (
                  <TableRow key={s.id} className={selectedIds.has(s.id) ? 'bg-primary/5' : undefined}>
                    <TableCell className="w-10">
                      <Checkbox
                        aria-label="Seleccionar venta"
                        disabled={s.status === 'paid'}
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </TableCell>
                    <TableCell>{s.date}</TableCell>
                    <TableCell className="font-medium">{clientMap.get(s.client_id)?.name || '-'}</TableCell>
                    <TableCell className="text-xs">
                      {(s.items || []).slice(0, 2).map((item, i) => (
                        <span key={i}>{i > 0 && ', '}{item.quantity} {productMap.get(item.product_id)?.name || 'Producto'}</span>
                      ))}
                      {(s.items || []).length > 2 && <span className="text-muted-foreground"> +{s.items.length - 2} más</span>}
                    </TableCell>
                    <TableCell className="font-semibold">{formatMoney(s.total)}</TableCell>
                    <TableCell>{Number(s.paid_amount) > 0 ? formatMoney(s.paid_amount) : '-'}</TableCell>
                    <TableCell className={Number(s.balance) > 0 ? 'text-destructive font-semibold' : ''}>{Number(s.balance) > 0 ? formatMoney(s.balance) : '-'}</TableCell>
                    <TableCell><Badge variant="outline">{paymentLabel[s.payment_type] || s.payment_type}</Badge></TableCell>
                    <TableCell>{s.delivery_employee_id ? (employees.find(e => e.id === s.delivery_employee_id)?.name || '-') : <span className="text-muted-foreground">Sin asignar</span>}</TableCell>
                    <TableCell><Badge variant={statusVariant(s.status)}>{statusLabel[s.status]}</Badge></TableCell>
                    <TableCell>{s.payment_method ? methodLabel[s.payment_method] : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setDetailSale(s)} title="Ver productos" className={`relative ${s.notes ? 'text-amber-600 hover:text-amber-700' : ''}`}>
                          <Eye className="w-3.5 h-3.5" />
                          {s.notes && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1 right-1" />}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openInvoiceModal(s)}>
                          <FileText className="w-3.5 h-3.5 mr-1" />Factura
                        </Button>
                        {s.dian_status === 'accepted' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => downloadDianPdf(s.id, s.dian_document_number)}
                            title={`PDF DIAN ${s.dian_document_number || ''}`}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />PDF DIAN
                          </Button>
                        )}
                        {s.status !== 'paid' && (
                          <Button size="sm" variant="default" onClick={() => openPayDialog(s.id)}>Pagar</Button>
                        )}
                        {s.date === today && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openDeleteDialog(s.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
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

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cobro masivo</DialogTitle></DialogHeader>
          {(() => {
            const selectedSales = sales.filter(s => selectedIds.has(s.id));
            const totalBalance = selectedSales.reduce((sum, s) => sum + Number(s.balance || 0), 0);
            return (
              <form onSubmit={handleBulkPay} className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <div className="flex justify-between"><span>Ventas seleccionadas:</span><span className="font-semibold">{selectedSales.length}</span></div>
                  <div className="flex justify-between"><span>Total a cobrar:</span><span className="font-bold text-primary">{formatMoney(totalBalance)}</span></div>
                </div>
                <p className="text-xs text-muted-foreground">Cada venta se cobra en su totalidad con el mismo medio de pago. Las ventas ya pagadas se omiten.</p>
                <div className="space-y-2">
                  <Label>Medio de pago</Label>
                  <Select value={bulkMethod || null} onValueChange={v => setBulkMethod(sv(v))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar">{(v: string) => methodLabel[v] || 'Seleccionar'}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                      <SelectItem value="nequi">Nequi</SelectItem>
                      <SelectItem value="daviplata">Daviplata</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <SubmitButton loading={bulkSaving} className="w-full" disabled={!bulkMethod || selectedSales.length === 0}>
                  Cobrar {selectedSales.length} venta{selectedSales.length === 1 ? '' : 's'} · {formatMoney(totalBalance)}
                </SubmitButton>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          {(() => {
            const sale = sales.find(s => s.id === paySaleId);
            const balance = sale ? Number(sale.balance) : 0;
            return (
              <form onSubmit={handlePay} className="space-y-4">
                {sale && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                    <div className="flex justify-between"><span>Total:</span><span className="font-semibold">{formatMoney(sale.total)}</span></div>
                    {Number(sale.paid_amount) > 0 && <div className="flex justify-between"><span>Abonado:</span><span>{formatMoney(sale.paid_amount)}</span></div>}
                    <div className="flex justify-between"><span>Saldo:</span><span className="font-bold text-destructive">{formatMoney(balance)}</span></div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Tipo de pago</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={!payPartial ? 'default' : 'outline'} className="flex-1" onClick={() => { setPayPartial(false); setPayAmount(''); }}>Pago total</Button>
                    <Button type="button" size="sm" variant={payPartial ? 'default' : 'outline'} className="flex-1" onClick={() => setPayPartial(true)}>Abono parcial</Button>
                  </div>
                </div>
                {payPartial && (
                  <div className="space-y-2">
                    <Label>Monto del abono</Label>
                    <Input type="number" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} min={1} max={balance} required />
                  </div>
                )}
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
                <SubmitButton loading={saving} className="w-full" disabled={!payMethod || (payPartial && !payAmount)}>
                  {payPartial ? `Abonar ${payAmount ? formatMoney(Number(payAmount)) : ''}` : `Pagar ${formatMoney(balance)}`}
                </SubmitButton>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar venta</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta accion eliminara la venta, su reparto y revertira el inventario. Ingresa la contraseña del administrador para confirmar.</p>
          <form onSubmit={handleDelete} className="space-y-4">
            <div className="space-y-2">
              <Label>Contraseña del administrador</Label>
              <Input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} required autoFocus />
            </div>
            <SubmitButton loading={saving} variant="destructive" className="w-full" disabled={!deletePassword}>Eliminar venta</SubmitButton>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!invoiceSale} onOpenChange={(v) => { if (!v) setInvoiceSale(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Generar factura</DialogTitle></DialogHeader>
          {invoiceSale && (() => {
            const cli = clientMap.get(invoiceSale.client_id);
            const electronicAvailable = !!cli?.dian_id_type && cli?.electronic_invoicing_enabled === true;
            const alreadyAccepted = invoiceSale.dian_status === 'accepted';
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cliente: <span className="font-medium text-foreground">{cli?.name || '-'}</span> · {formatMoney(invoiceSale.total)}
                </p>

                {alreadyAccepted ? (
                  <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-emerald-200 p-2">
                        <Cloud className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-emerald-900">
                          Factura electrónica {invoiceSale.dian_document_number} aceptada por DIAN
                        </p>
                        <p className="text-xs text-emerald-800/80 mt-0.5">
                          Esta venta ya tiene factura electrónica generada. No se puede regenerar.
                        </p>
                        {invoiceSale.dian_cufe && (
                          <p className="text-[10px] text-emerald-800/60 font-mono break-all mt-1">
                            CUFE: {invoiceSale.dian_cufe}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-lg border p-2 flex items-center gap-1 bg-muted/30">
                        <button
                          type="button"
                          onClick={() => setDianFormat('letter')}
                          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            dianFormat === 'letter'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          Carta (A4)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDianFormat('thermal')}
                          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            dianFormat === 'thermal'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          Térmica 80mm
                        </button>
                      </div>
                      <Button
                        type="button"
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => downloadDianPdf(invoiceSale.id, invoiceSale.dian_document_number, dianFormat)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Descargar PDF DIAN {dianFormat === 'thermal' ? '(80mm)' : '(Carta)'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleInternalInvoice}
                      className="w-full text-left rounded-lg border bg-white p-4 hover:border-blue-500 hover:bg-blue-50/50 transition-colors flex items-start gap-3"
                    >
                      <div className="rounded-md bg-blue-100 p-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Factura interna (PDF)</p>
                        <p className="text-xs text-muted-foreground">Descarga el PDF para guardar o imprimir despues.</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleInternalInvoiceHtml}
                      className="w-full text-left rounded-lg border bg-white p-4 hover:border-amber-500 hover:bg-amber-50/50 transition-colors flex items-start gap-3"
                    >
                      <div className="rounded-md bg-amber-100 p-2">
                        <Printer className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Factura interna (HTML - imprimir)</p>
                        <p className="text-xs text-muted-foreground">Abre en pestaña con tamano 80mm y dialogo de impresion directo.</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={electronicAvailable ? handleElectronicInvoice : undefined}
                      disabled={!electronicAvailable || generatingElectronic}
                      className={`w-full text-left rounded-lg border p-4 transition-colors flex items-start gap-3 ${
                        electronicAvailable
                          ? 'bg-white hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer'
                          : 'bg-muted/40 cursor-not-allowed opacity-60'
                      }`}
                      title={electronicAvailable ? '' : 'El cliente no tiene habilitada la factura electrónica. Edita el cliente para habilitarla.'}
                    >
                      <div className={`rounded-md p-2 ${electronicAvailable ? 'bg-emerald-100' : 'bg-gray-200'}`}>
                        {electronicAvailable ? (
                          <Cloud className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Lock className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          Factura electrónica DIAN
                          {generatingElectronic && <span className="text-xs text-emerald-600">enviando...</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {electronicAvailable
                            ? 'Envía la factura a la DIAN y obtiene CUFE.'
                            : 'Cliente no habilitado. Edita el cliente y activa "Habilitar para factura electrónica".'}
                        </p>
                      </div>
                    </button>
                  </>
                )}

                <Button variant="outline" className="w-full" onClick={() => setInvoiceSale(null)}>
                  {alreadyAccepted ? 'Cerrar' : 'Cancelar'}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailSale} onOpenChange={() => setDetailSale(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de venta</DialogTitle></DialogHeader>
          {detailSale && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {detailSale.date} — {clientMap.get(detailSale.client_id)?.name || 'Cliente'}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detailSale.items || []).map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{productMap.get(item.product_id)?.name || 'Producto'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-medium">Total</span>
                <span className="text-lg font-bold">{formatMoney(detailSale.total)}</span>
              </div>
              {detailSale.notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Nota</p>
                  <p className="text-sm">{detailSale.notes}</p>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => setDetailSale(null)}>Cerrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
