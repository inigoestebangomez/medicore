// apps/web/src/components/research/ExportChartButton.tsx
// Exports an SVG chart to PNG at ~300 dpi (scale factor 3×) via a canvas
// rasterization: serialize the SVG → load into an Image → draw onto a scaled
// canvas → toBlob → trigger download. Used by every V3 chart (BR-RES-007).
//
// The selector targets the wrapping element's `data-testid`; the first inner
// <svg> is rasterized. Gated implicitly (chart components already gate).

'use client';

import { useState } from 'react';

export interface ExportChartButtonProps {
  /** data-testid of the chart wrapper */
  selector: string;
  /** download file name (without extension) */
  fileName: string;
  /** raster scale (3 ≈ 300dpi for a 96dpi base) */
  scale?: number;
  label?: string;
}

export function ExportChartButton({ selector, fileName, scale = 3, label = 'Exportar PNG' }: ExportChartButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportPng() {
    setBusy(true);
    setError(null);
    try {
      const wrapper = document.querySelector(`[data-testid="${selector}"]`);
      const svg = wrapper?.querySelector('svg');
      if (!svg) throw new Error('no svg found');

      const bbox = (svg as SVGSVGElement).getBoundingClientRect();
      const w = bbox.width || (svg as SVGSVGElement).viewBox.baseVal?.width || 320;
      const h = bbox.height || (svg as SVGSVGElement).viewBox.baseVal?.height || 200;

      const xml = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('no 2d context')); return; }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url);
            if (!blob) { reject(new Error('toBlob returned null')); return; }
            const dlUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = dlUrl;
            a.download = `${fileName}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
            resolve();
          }, 'image/png');
        };
        img.onerror = () => reject(new Error('image load failed'));
        img.src = url;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void exportPng()}
        disabled={busy}
        className="rounded border border-outline px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-low disabled:opacity-50"
        data-testid="export-chart-btn"
      >
        {busy ? 'Exportando…' : label}
      </button>
      {error && <span className="text-xs text-red-600">⚠ {error}</span>}
    </span>
  );
}

export default ExportChartButton;