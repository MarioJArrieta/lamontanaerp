import { useEffect, useState } from 'react';
import {
  Package,
  ShoppingCart,
  Truck,
  CreditCard,
  Factory,
  Warehouse,
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import type { Sale, Receivable, Inventory, Product } from '@/types';

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(val));
}

export default function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    Promise.all([
      api.get(`/sales?from_date=${monthAgo}&to_date=${today}`),
      api.get('/receivables'),
      api.get('/inventory'),
      api.get('/products'),
    ]).then(([salesRes, recRes, invRes, prodRes]) => {
      setSales(salesRes.data);
      setReceivables(recRes.data);
      setInventory(invRes.data);
      setProducts(prodRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando...</div>;
  }

  const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const pendingReceivables = receivables.filter(r => r.status === 'pending');
  const totalPending = pendingReceivables.reduce((sum, r) => sum + Number(r.amount), 0);
  const todaySales = sales.filter(s => s.date === new Date().toISOString().split('T')[0]);

  const productMap = new Map(products.map(p => [p.id, p]));

  return (
    <div>
      <PageHeader title="Dashboard" description="Resumen general de La Montana" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Ventas del mes"
          value={formatMoney(totalSales)}
          icon={ShoppingCart}
          subtitle={`${sales.length} ventas`}
        />
        <StatCard
          title="Ventas hoy"
          value={todaySales.length}
          icon={Package}
          subtitle={formatMoney(todaySales.reduce((s, v) => s + Number(v.total), 0))}
        />
        <StatCard
          title="Por cobrar"
          value={formatMoney(totalPending)}
          icon={CreditCard}
          subtitle={`${pendingReceivables.length} pendientes`}
        />
        <StatCard
          title="Productos en inventario"
          value={inventory.reduce((s, i) => s + i.quantity, 0)}
          icon={Warehouse}
          subtitle={`${inventory.length} productos`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Ultimas ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay ventas recientes</p>
            ) : (
              <div className="space-y-3">
                {sales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{formatMoney(sale.total)}</p>
                      <p className="text-xs text-muted-foreground">{sale.date} - {sale.items.length} items</p>
                    </div>
                    <Badge variant={sale.status === 'paid' ? 'default' : 'secondary'}>
                      {sale.status === 'paid' ? 'Pagada' : 'Pendiente'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Warehouse className="w-4 h-4" />
              Inventario actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inventory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin inventario registrado</p>
            ) : (
              <div className="space-y-3">
                {inventory.map((inv) => {
                  const product = productMap.get(inv.product_id);
                  return (
                    <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Factory className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{product?.name || 'Producto'}</p>
                          <p className="text-xs text-muted-foreground">{product?.unit}</p>
                        </div>
                      </div>
                      <span className="text-lg font-semibold">{inv.quantity}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Cuentas por cobrar pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingReceivables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay cuentas pendientes</p>
            ) : (
              <div className="space-y-3">
                {pendingReceivables.slice(0, 5).map((rec) => (
                  <div key={rec.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{formatMoney(rec.amount)}</p>
                      <p className="text-xs text-muted-foreground">Vence: {rec.due_date}</p>
                    </div>
                    <Badge variant="secondary">{rec.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Entregas recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Revisa el modulo de Repartos para ver las entregas del dia.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
