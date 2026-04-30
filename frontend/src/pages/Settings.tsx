import { useEffect, useState, useRef, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Upload, X, Cloud, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
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
    dian_facturador_url: '',
    dian_facturador_api_key: '',
  });
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    tenant?: {
      name: string;
      nit: string;
      dv: string;
      tax_regime: string;
      city_name: string | null;
      department_name: string | null;
      email: string | null;
      is_active: boolean;
    };
  } | null>(null);
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
            dian_facturador_url: s.dian_facturador_url || '',
            dian_facturador_api_key: '',
          });
          setApiKeyMasked(s.dian_facturador_api_key_masked || null);
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
      const payload: Record<string, string | null> = {
        name: form.name,
        nit: form.nit || null,
        phone: form.phone || null,
        address: form.address || null,
        logo_url: form.logo_url || null,
        dian_facturador_url: form.dian_facturador_url || null,
      };
      // Send api_key if user is creating it for the first time (no masked yet) or explicitly editing.
      // Avoid wiping a stored key when the user just saves other fields without re-entering it.
      if (editingApiKey || !apiKeyMasked) {
        payload.dian_facturador_api_key = form.dian_facturador_api_key || null;
      }
      const r = await api.put('/settings', payload);
      setApiKeyMasked(r.data?.dian_facturador_api_key_masked || null);
      setForm(f => ({ ...f, dian_facturador_api_key: '' }));
      setEditingApiKey(false);
      toast.success('Configuracion guardada');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post('/settings/dian/test-connection');
      setTestResult({ ok: r.data.ok, message: r.data.message, tenant: r.data.tenant });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      setTestResult({ ok: false, message: msg });
    } finally {
      setTesting(false);
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

              {/* DIAN integration */}
              <div className="rounded-lg border bg-emerald-50/30 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-emerald-600" />
                  <div>
                    <Label className="font-semibold">Integracion facturador DIAN</Label>
                    <p className="text-xs text-muted-foreground">
                      Conexion al sistema externo que envia facturas electronicas a la DIAN.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>URL del facturador</Label>
                  <Input
                    value={form.dian_facturador_url}
                    onChange={e => setForm({ ...form, dian_facturador_url: e.target.value })}
                    placeholder="http://localhost:8001/api/v1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>API Key</Label>
                  {!editingApiKey && apiKeyMasked ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 text-sm bg-muted rounded-md font-mono">{apiKeyMasked}</code>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setEditingApiKey(true); setShowApiKey(false); }}>
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={form.dian_facturador_api_key}
                          onChange={e => setForm({ ...form, dian_facturador_api_key: e.target.value })}
                          placeholder={apiKeyMasked ? 'Pegar nueva API key (vacio para no cambiar)' : 'Pegar API key del facturador'}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(s => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {apiKeyMasked && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingApiKey(false); setForm(f => ({ ...f, dian_facturador_api_key: '' })); }}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {apiKeyMasked && form.dian_facturador_url && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={testConnection} disabled={testing}>
                        {testing ? 'Probando...' : 'Probar conexion'}
                      </Button>
                      {testResult && (
                        <div className={`flex items-center gap-1 text-sm ${testResult.ok ? 'text-emerald-700' : 'text-destructive'}`}>
                          {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                          <span>{testResult.message}</span>
                        </div>
                      )}
                    </div>
                    {testResult?.ok && testResult.tenant && (
                      <div className="rounded-md border bg-white p-3 text-sm space-y-1.5">
                        <div className="font-semibold text-emerald-800">{testResult.tenant.name}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground">NIT:</span> {testResult.tenant.nit}-{testResult.tenant.dv}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">Regimen:</span> {testResult.tenant.tax_regime}
                          </div>
                          {(testResult.tenant.city_name || testResult.tenant.department_name) && (
                            <div className="col-span-2">
                              <span className="font-medium text-foreground">Ubicacion:</span>{' '}
                              {[testResult.tenant.city_name, testResult.tenant.department_name].filter(Boolean).join(', ')}
                            </div>
                          )}
                          {testResult.tenant.email && (
                            <div className="col-span-2">
                              <span className="font-medium text-foreground">Email:</span> {testResult.tenant.email}
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-foreground">Estado:</span>{' '}
                            <span className={testResult.tenant.is_active ? 'text-emerald-700' : 'text-destructive'}>
                              {testResult.tenant.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
