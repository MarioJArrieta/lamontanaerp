import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, ShoppingCart, HandCoins } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import type { FinanceKPIs as FinanceKPIsType } from '@/types';

function formatMoney(val: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);
}

const categoryLabel: Record<string, string> = {
  raw_material: 'Materia prima',
  services: 'Servicios',
  transport: 'Transporte',
  payroll: 'Nomina',
  other: 'Otro',
};

export default function FinanceKPIs() {
  const [kpis, setKpis] = useState<FinanceKPIsType | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = useState(monthAgo);
  const [filterTo, setFilterTo] = useState(today);

  const fetchData = () => {
    setLoading(true);
    api.get(`/finance/kpis?from_date=${filterFrom}&to_date=${filterTo}`)
      .then(res => setKpis(res.data))
      .catch(() => toast.error('Error al cargar KPIs'))
      .finally(() => setLoading(false));
  };
  useEffect(fetchData, [filterFrom, filterTo]);

  const maxExpenseCat = kpis
    ? Math.max(...Object.values(kpis.expense_by_category), 1)
    : 1;

  return (
    <div>
      <PageHeader
        title="Gastos vs Ingresos"
        description="Resumen financiero del periodo"
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

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Cargando...</div>
      ) : !kpis ? (
        <div className="p-8 text-center text-muted-foreground">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          <p>No se pudieron cargar los KPIs</p>
          <button onClick={fetchData} className="mt-2 text-sm underline text-primary">Reintentar</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard
              title="Total Ingresos"
              value={formatMoney(kpis.total_income)}
              icon={TrendingUp}
              subtitle={`Ventas: ${formatMoney(kpis.total_sales)} | Otros: ${formatMoney(kpis.total_other_income)}`}
            />
            <StatCard
              title="Total Gastos"
              value={formatMoney(kpis.total_expenses)}
              icon={TrendingDown}
              subtitle={`${Object.keys(kpis.expense_by_category).length} categorias`}
            />
            <StatCard
              title="Balance"
              value={formatMoney(kpis.balance)}
              icon={DollarSign}
              subtitle={kpis.balance >= 0 ? 'Ganancia' : 'Perdida'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">Gastos por categoria</h3>
                </div>
                {Object.keys(kpis.expense_by_category).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin gastos en este periodo</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(kpis.expense_by_category)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amount]) => (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{categoryLabel[cat] || cat}</span>
                            <span className="font-medium">{formatMoney(amount)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full transition-all"
                              style={{ width: `${(amount / maxExpenseCat) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">Composicion de ingresos</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">Ventas</p>
                        <p className="text-xs text-muted-foreground">Ingresos por ventas</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-green-600">{formatMoney(kpis.total_sales)}</p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50">
                    <div className="flex items-center gap-3">
                      <HandCoins className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">Otros ingresos</p>
                        <p className="text-xs text-muted-foreground">Alquiler, reembolsos, etc.</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-blue-600">{formatMoney(kpis.total_other_income)}</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Margen</span>
                    <span className={`text-lg font-bold ${kpis.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {kpis.total_income > 0
                        ? `${((kpis.balance / kpis.total_income) * 100).toFixed(1)}%`
                        : '0%'}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 mt-2">
                    <div
                      className={`h-3 rounded-full transition-all ${kpis.balance >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{
                        width: kpis.total_income > 0
                          ? `${Math.min(Math.abs(kpis.balance / kpis.total_income) * 100, 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
