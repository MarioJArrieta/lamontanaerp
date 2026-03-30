import { useEffect, useState, useRef, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Upload, X } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import type { CompanySettings } from '@/types';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    nit: '',
    phone: '',
    address: '',
    logo_url: '',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/settings')
      .then(r => {
        if (r.data && r.data.id) {
          const s: CompanySettings = r.data;
          setForm({
            name: s.name || '',
            nit: s.nit || '',
            phone: s.phone || '',
            address: s.address || '',
            logo_url: s.logo_url || '',
          });
        }
      })
      .catch(() => {
        // No settings yet, show empty form
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe superar 2MB');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await api.post('/settings/logo', formData);
      setForm(f => ({ ...f, logo_url: r.data.logo_url }));
      toast.success('Logo cargado');
    } catch {
      toast.error('Error al cargar el logo');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }
    setSaving(true);
    try {
      await api.put('/settings', {
        name: form.name,
        nit: form.nit || null,
        phone: form.phone || null,
        address: form.address || null,
        logo_url: form.logo_url || null,
      });
      toast.success('Configuracion guardada');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Configuracion" description="Datos de la empresa" />
        <div className="p-8 text-center text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Configuracion" description="Datos de la empresa" />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Informacion de la empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Logo */}
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {form.logo_url ? (
                    <div className="relative">
                      <img
                        src={form.logo_url}
                        alt="Logo"
                        className="w-24 h-24 object-contain rounded-lg border bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, logo_url: '' }))}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Subir</span>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />
                  {form.logo_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      Cambiar
                    </Button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label>Nombre de la empresa *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="La Montana"
                  required
                />
              </div>

              {/* NIT and Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NIT</Label>
                  <Input
                    value={form.nit}
                    onChange={e => setForm({ ...form, nit: e.target.value })}
                    placeholder="900.123.456-7"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <Input
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="300 123 4567"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label>Direccion</Label>
                <Input
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Cra 10 #20-30, Ciudad"
                />
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar configuracion'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
