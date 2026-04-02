import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Warehouse, RefreshCw } from 'lucide-react';
import { Pagination, paginate } from '@/components/ui/pagination';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';
import type { Inventory as InventoryType, InventoryMovement, Product } from '@/types';

export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryType[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/inventory'),
      api.get('/inventory/movements'),
      api.get('/products'),
    ]).then(([invRes, movRes, prodRes]) => {
      setInventory(invRes.data);
      setMovements(movRes.data);
      setProducts(prodRes.data);
    }).finally(() => setLoading(false));
  };
  useEffect(fetchData, []);

  const handleRecalculate = async () => {
    try {
      await api.post('/inventory/recalculate');
      toast.success('Stock recalculado');
      fetchData();
    } catch {
      toast.error('Error al recalcular');
    }
  };

  const productMap = new Map(products.map(p => [p.id, p]));
  const [page, setPage] = useState(1);
  const pg = paginate(movements, page);

  const movementTypeLabel: Record<string, string> = {
    production_in: 'Produccion',
    sale_out: 'Venta',
    adjustment: 'Ajuste',
    raw_material_in: 'Materia prima',
    raw_material_out: 'Consumo MP',
  };
  const movementVariant = (type: string) => type.includes('in') || type === 'production_in' ? 'default' as const : 'secondary' as const;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Stock actual y movimientos"
        action={
          <Button variant="outline" onClick={handleRecalculate}>
            <RefreshCw className="w-4 h-4 mr-2" />Recalcular stock
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {inventory.map(inv => {
          const product = productMap.get(inv.product_id);
          return (
            <Card key={inv.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{product?.name || 'Producto'}</p>
                    <p className="text-3xl font-semibold mt-1">{inv.quantity}</p>
                    <p className="text-xs text-muted-foreground">{product?.unit || 'unidades'}</p>
                  </div>
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Warehouse className="w-7 h-7 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ultimos movimientos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Sin movimientos
                  </TableCell>
                </TableRow>
              ) : pg.data.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{productMap.get(m.product_id)?.name || '-'}</TableCell>
                  <TableCell><Badge variant={movementVariant(m.movement_type)}>{movementTypeLabel[m.movement_type] || m.movement_type}</Badge></TableCell>
                  <TableCell className={m.quantity > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.notes || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString('es-CO')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={pg.page} totalPages={pg.totalPages} totalItems={pg.totalItems} pageSize={pg.pageSize} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
