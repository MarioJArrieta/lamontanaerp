import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SubmitButton } from '@/components/ui/submit-button';
import { exportToExcel, type ExportColumn } from '@/lib/exportExcel';

interface ExportColumnsDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  filename: string;
  sheetName: string;
  columns: ExportColumn<T>[];
  rows: T[];
  defaultSelectedKeys?: string[];
}

export default function ExportColumnsDialog<T>({
  open, onOpenChange, title, filename, sheetName, columns, rows, defaultSelectedKeys,
}: ExportColumnsDialogProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultSelectedKeys ?? columns.map(c => c.key)),
  );
  const [exporting, setExporting] = useState(false);

  const toggle = (key: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const chosen = columns.filter(c => selected.has(c.key));
      await exportToExcel(filename, sheetName, chosen, rows);
      onOpenChange(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />{title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Elige las columnas a incluir ({rows.length} registro{rows.length === 1 ? '' : 's'}).
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set(columns.map(c => c.key)))}>
              Todas
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Ninguna
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-72 overflow-y-auto border rounded-lg p-3">
            {columns.map(c => (
              <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={selected.has(c.key)} onChange={() => toggle(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
          <SubmitButton
            type="button"
            loading={exporting}
            disabled={selected.size === 0 || rows.length === 0}
            className="w-full"
            onClick={handleExport}
          >
            Descargar Excel ({selected.size} columna{selected.size === 1 ? '' : 's'})
          </SubmitButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
