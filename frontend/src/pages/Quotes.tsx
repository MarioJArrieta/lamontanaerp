import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Pagination, paginate } from '@/components/ui/pagination';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, FileSignature } from 'lucide-react';
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
import type { Quote, QuoteStatus, Client, Product, CompanySettings } from '@/types';
import { generateQuote } from '@/lib/quote';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

const statusLabel: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  expired: 'Expirada',
};

const statusVariant = (s: QuoteStatus): 'default' | 'outline' | 'secondary' | 'destructive' => {
  switch (s) {
    case 'accepted': return 'default';
    case 'sent': return 'outline';
    case 'rejected':
    case 'expired': return 'destructive';
    default: return 'secondary';
  }
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const DEFAULT_VALID_DAYS = 15;

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientDropRef = useRef<HTMLDivElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = usePersistedState('quotes_search', '');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />;
  };

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = usePersistedState('quotes_from', monthAgo);
  const [filterTo, setFilterTo] = usePersistedState('quotes_to', today);

  const [form, setForm] = useState({
    date: today,
    client_id: '',
    valid_until: addDays(today, DEFAULT_VALID_DAYS),
    status: 'draft' as QuoteStatus,
    notes: '',
    items: [{ product_id: '', quantity: '', unit_price: '' }],
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/quotes?from_date=${filterFrom}&to_date=${filterTo}`),
      api.get('/clients'),
      api.get('/products'),
    ]).then(([quotesRes, clientsRes, productsRes]) => {
      setQuotes(quotesRes.data);
      setClients(clientsRes.data);
      setProducts(productsRes.data);
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

  const resetForm = () => {
    const t = new Date().toISOString().split('T')[0];
    setForm({
      date: t,
      client_id: '',
      valid_until: addDays(t, DEFAULT_VALID_DAYS),
      status: 'draft',
      notes: '',
      items: [{ product_id: '', quantity: '', unit_price: '' }],
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/quotes', {
        date: form.date,
        client_id: form.client_id,
        valid_until: form.valid_until,
        status: form.status,
        notes: form.notes || null,
        items: form.items.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: item.unit_price ? Number(item.unit_price) : null,
        })),
      });
      toast.success('Cotizacion creada');
      setOpen(false);
      setClientSearch('');
      resetForm();
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (quoteId: string) => {
    setDeleteQuoteId(quoteId);
    setDeleteOpen(true);
  };

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!deleteQuoteId) return;
    setSaving(true);
    try {
      await api.delete(`/quotes/${deleteQuoteId}`);
      toast.success('Cotizacion eliminada');
      setDeleteOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (quoteId: string, status: QuoteStatus) => {
    try {
      await api.patch(`/quotes/${quoteId}/status`, { status });
      toast.success('Estado actualizado');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    }
  };

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const productMap = new Map(products.map(p => [p.id, p]));

  const handleGenerateQuotePdf = async (quote: Quote) => {
    try {
      await generateQuote(quote, clientMap.get(quote.client_id), productMap, company);
    } catch {
      toast.error('Error al generar cotizacion');
    }
  };

  const filteredQuotes = useMemo(() => {
    if (!searchQuery.trim()) return quotes;
    const q = searchQuery.toLowerCase();
    return quotes.filter(s => {
      const clientName = clientMap.get(s.client_id)?.name?.toLowerCase() || '';
      const clientZone = clientMap.get(s.client_id)?.delivery_zone?.toLowerCase() || '';
      const notes = s.notes?.toLowerCase() || '';
      const status = statusLabel[s.status]?.toLowerCase() || '';
      return clientName.includes(q) || clientZone.includes(q) || notes.includes(q) || status.includes(q) || s.date.includes(q);
    });
  }, [quotes, searchQuery, clients]);

  const sortedQuotes = useMemo(() => {
    if (!sortCol) return filteredQuotes;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredQuotes].sort((a, b) => {
      let va: string | number = '';
      let vb: string | number = '';
      switch (sortCol) {
        case 'date': va = a.date; vb = b.date; break;
        case 'valid_until': va = a.valid_until; vb = b.valid_until; break;
        case 'client': va = clientMap.get(a.client_id)?.name || ''; vb = clientMap.get(b.client_id)?.name || ''; break;
        case 'total': va = Number(a.total); vb = Number(b.total); break;
        case 'status': va = a.status; vb = b.status; break;
      }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filteredQuotes, sortCol, sortDir, clientMap]);

  const draftCount = filteredQuotes.filter(q => q.status === 'draft').length;
  const sentCount = filteredQuotes.filter(q => q.status === 'sent').length;
  const acceptedCount = filteredQuotes.filter(q => q.status === 'accepted').length;
  const totalAmount = filteredQuotes.reduce((sum, q) => sum + Number(q.total), 0);

  const pg = paginate(sortedQuotes, page);

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        description="Genera cotizaciones para clientes (no impactan contabilidad)"
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { resetForm(); setClientSearch(''); } }}>
            <DialogTrigger>
              <Button><Plus className="w-4 h-4 mr-2" />Nueva cotizacion</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Crear cotizacion</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input type="date" value={form.date} onChange={e => {
                      const d = e.target.value;
                      setForm({ ...form, date: d, valid_until: addDays(d, DEFAULT_VALID_DAYS) });
                    }} required />
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
                    <Label>Valida hasta</Label>
                    <Input type="date" value={form.valid_until} onChange={e => setForm({...form, valid_until: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={form.status} onValueChange={v => setForm({...form, status: sv(v) as QuoteStatus})}>
                      <SelectTrigger><SelectValue>{(v: string) => statusLabel[v as QuoteStatus] || v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Borrador</SelectItem>
                        <SelectItem value="sent">Enviada</SelectItem>
                        <SelectItem value="accepted">Aceptada</SelectItem>
                        <SelectItem value="rejected">Rechazada</SelectItem>
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
                <SubmitButton loading={saving} className="w-full">Crear cotizacion</SubmitButton>
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
            placeholder="Buscar por cliente, zona, notas, estado..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        <Card>
          <CardContent className="px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Borradores</p>
            <p className="text-sm font-bold">{draftCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Enviadas</p>
            <p className="text-sm font-bold">{sentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Aceptadas</p>
            <p className="text-sm font-bold">{acceptedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Monto total</p>
            <p className="text-sm font-bold truncate">{formatMoney(totalAmount)}</p>
            <p className="text-[10px] text-muted-foreground">{filteredQuotes.length} cotizaciones</p>
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
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('date')}>Fecha<SortIcon col="date" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('client')}>Cliente<SortIcon col="client" /></TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('valid_until')}>Valida hasta<SortIcon col="valid_until" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('total')}>Total<SortIcon col="total" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>Estado<SortIcon col="status" /></TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <FileSignature className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No hay cotizaciones</p>
                    </TableCell>
                  </TableRow>
                ) : pg.data.map(q => (
                  <TableRow key={q.id}>
                    <TableCell>{q.date}</TableCell>
                    <TableCell className="font-medium">{clientMap.get(q.client_id)?.name || '-'}</TableCell>
                    <TableCell className="text-xs">
                      {(q.items || []).slice(0, 2).map((item, i) => (
                        <span key={i}>{i > 0 && ', '}{item.quantity} {productMap.get(item.product_id)?.name || 'Producto'}</span>
                      ))}
                      {(q.items || []).length > 2 && <span className="text-muted-foreground"> +{q.items.length - 2} más</span>}
                    </TableCell>
                    <TableCell>{q.valid_until}</TableCell>
                    <TableCell className="font-semibold">{formatMoney(q.total)}</TableCell>
                    <TableCell>
                      <Select value={q.status} onValueChange={v => handleStatusChange(q.id, sv(v) as QuoteStatus)}>
                        <SelectTrigger className="h-7 w-[120px]">
                          <SelectValue>
                            {(v: string) => <Badge variant={statusVariant(v as QuoteStatus)}>{statusLabel[v as QuoteStatus] || v}</Badge>}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Borrador</SelectItem>
                          <SelectItem value="sent">Enviada</SelectItem>
                          <SelectItem value="accepted">Aceptada</SelectItem>
                          <SelectItem value="rejected">Rechazada</SelectItem>
                          <SelectItem value="expired">Expirada</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setDetailQuote(q)} title="Ver detalle">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleGenerateQuotePdf(q)}>
                          <FileText className="w-3.5 h-3.5 mr-1" />PDF
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openDeleteDialog(q.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar cotizacion</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta accion eliminara la cotizacion de forma permanente.</p>
          <form onSubmit={handleDelete} className="space-y-4">
            <SubmitButton loading={saving} variant="destructive" className="w-full">Eliminar cotizacion</SubmitButton>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailQuote} onOpenChange={() => setDetailQuote(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de cotizacion</DialogTitle></DialogHeader>
          {detailQuote && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {detailQuote.date} — {clientMap.get(detailQuote.client_id)?.name || 'Cliente'}
              </p>
              <p className="text-xs text-muted-foreground">
                Valida hasta: {detailQuote.valid_until} — <Badge variant={statusVariant(detailQuote.status)}>{statusLabel[detailQuote.status]}</Badge>
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
                  {(detailQuote.items || []).map((item, i) => (
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
                <span className="text-lg font-bold">{formatMoney(detailQuote.total)}</span>
              </div>
              {detailQuote.notes && (
                <p className="text-xs text-muted-foreground"><span className="font-medium">Notas:</span> {detailQuote.notes}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => handleGenerateQuotePdf(detailQuote)}>
                  <FileText className="w-3.5 h-3.5 mr-1" />Descargar PDF
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setDetailQuote(null)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
