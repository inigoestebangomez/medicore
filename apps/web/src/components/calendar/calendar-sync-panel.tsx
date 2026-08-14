'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-fetch';

interface ProviderStatus {
  provider: string;
  connected: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  GOOGLE: 'Google Calendar',
  MICROSOFT: 'Microsoft Teams / Outlook',
  APPLE: 'iCloud Calendar',
};

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  GOOGLE: 'Sincroniza tu agenda con Google Calendar. Si iniciaste sesión con Google, la conexión es automática.',
  MICROSOFT: 'Sincroniza con Microsoft Teams y Outlook. Disponible si usas Microsoft Entra ID.',
  APPLE: 'Sincroniza con iCloud Calendar. Requiere contraseña de aplicación.',
};

export function CalendarSyncPanel() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    setLoading(true);
    try {
      const res = await apiFetch<{ providers: ProviderStatus[] }>('/v1/calendar/sync/providers');
      setProviders(res.providers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando proveedores');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider: string) {
    setConnecting(provider);
    try {
      const res = await apiFetch<{ authUrl: string }>(
        `/v1/calendar/sync/connect/${provider}`,
        { method: 'POST' },
      );
      // Open OAuth URL in a new window
      if (res.authUrl) {
        window.open(res.authUrl, '_blank', 'width=600,height=700');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error conectando');
    } finally {
      setConnecting(null);
    }
  }

  async function handleDisconnect(provider: string) {
    try {
      await apiFetch(`/v1/calendar/sync/disconnect/${provider}`, { method: 'DELETE' });
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconectando');
    }
  }

  async function handleRefresh() {
    setSyncing(true);
    try {
      await apiFetch('/v1/calendar/sync/refresh', { method: 'POST' });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error sincronizando');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-surface-low" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-on-surface">Sincronización de calendarios</h3>
          <p className="text-sm text-on-surface-variant">
            Conecta tu cuenta de calendario externo para ver todos tus eventos en un solo lugar.
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={syncing} variant="outline" size="sm">
          {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-clinical-critical/40 bg-clinical-critical/10 p-3 text-sm text-clinical-critical">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {providers.map((p) => (
          <div
            key={p.provider}
            className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface-lowest p-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-on-surface">
                  {PROVIDER_LABELS[p.provider] ?? p.provider}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    p.connected
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-surface-low text-on-surface-variant'
                  }`}
                >
                  {p.connected ? 'Conectado' : 'No conectado'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {PROVIDER_DESCRIPTIONS[p.provider] ?? ''}
              </p>
            </div>
            <div className="ml-4">
              {p.connected ? (
                <Button
                  onClick={() => handleDisconnect(p.provider)}
                  variant="outline"
                  size="sm"
                >
                  Desconectar
                </Button>
              ) : (
                <Button
                  onClick={() => handleConnect(p.provider)}
                  disabled={connecting === p.provider}
                  size="sm"
                >
                  {connecting === p.provider ? 'Conectando…' : 'Conectar'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-on-surface-variant/60">
        La sincronización se ejecuta automáticamente cada 15 minutos. Los eventos externos aparecerán en tu agenda con el color del proveedor.
      </p>
    </div>
  );
}
