import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export function Pagination({ page, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * (pageSize || 0) + 1;
  const to = Math.min(page * (pageSize || 0), totalItems || 0);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      {totalItems !== undefined && pageSize ? (
        <span className="text-xs text-muted-foreground">{from}–{to} de {totalItems}</span>
      ) : (
        <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
      )}
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | '...')[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1]) > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === '...' ? (
              <span key={`dot-${i}`} className="px-1 text-xs text-muted-foreground">...</span>
            ) : (
              <Button key={p} size="sm" variant={p === page ? 'default' : 'outline'} className="w-8 h-8 p-0" onClick={() => onPageChange(p)}>
                {p}
              </Button>
            )
          )}
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 15;

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    data: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    totalPages,
    totalItems: items.length,
    pageSize,
  };
}
