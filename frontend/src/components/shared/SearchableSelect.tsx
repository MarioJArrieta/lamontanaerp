import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface SearchableOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (id: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  className?: string;
}

export default function SearchableSelect({ value, onChange, options, placeholder = 'Buscar...', className }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;

  return (
    <div className={`relative ${className || ''}`} ref={ref}>
      <Input
        placeholder={placeholder}
        value={open ? search : (selected?.label || '')}
        onFocus={() => { setOpen(true); setSearch(''); }}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
          {filtered.length === 0 ? (
            <div className="p-2 text-sm text-muted-foreground">Sin resultados</div>
          ) : filtered.map(o => (
            <button
              key={o.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${value === o.id ? 'bg-muted font-medium' : ''}`}
              onClick={() => { onChange(o.id); setOpen(false); setSearch(''); }}
            >
              {o.label}{o.sublabel ? ` — ${o.sublabel}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
