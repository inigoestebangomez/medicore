// apps/web/src/components/research/export-png.ts
// Client-side PNG export from a rendered chart container (spec §6). Recharts
// renders SVG; we clone that SVG into an offscreen canvas at the requested
// pixel ratio and trigger a download. No external dependency (html2canvas is
// not installed) — works for any SVG-backed chart (Recharts D3 output).
//
// If the container holds a <canvas> already (e.g. a rasterized chart), that
// canvas is exported directly.

const NAMESPACE = 'http://www.w3.org/2000/svg';

/** Serialize an SVG element to a standalone data URL (inline styles preserved). */
function svgToDataUrl(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', NAMESPACE);
  if (!clone.getAttribute('width') && svg.clientWidth) clone.setAttribute('width', String(svg.clientWidth));
  if (!clone.getAttribute('height') && svg.clientHeight) clone.setAttribute('height', String(svg.clientHeight));
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clone.outerHTML);
}

/** Trigger a browser download for a data URL. */
function download(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export interface ExportPngOptions {
  /** Device pixel ratio multiplier (default 2 ≈ ~144 DPI on standard displays). */
  pixelRatio?: number;
  /** Background fill — defaults to white so transparent PNGs stay legible. */
  background?: string;
}

/**
 * Export the first chart/svg|canvas inside `container` to a PNG download.
 * Returns the data URL on success, or null if no renderable element was found.
 */
export async function exportChartPng(
  container: HTMLElement | null,
  filename = 'medicore-chart.png',
  options: ExportPngOptions = {},
): Promise<string | null> {
  if (!container) return null;
  const ratio = options.pixelRatio ?? 2;
  const bg = options.background ?? '#ffffff';

  const canvas = container.querySelector('canvas');
  if (canvas) {
    // Rasterized chart: re-encode with background to avoid transparency.
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    const url = out.toDataURL('image/png');
    download(url, filename);
    return url;
  }

  const svg = container.querySelector('svg');
  if (!svg) return null;

  const serializer = svgToDataUrl(svg);
  // Use an Image to rasterize the SVG onto a canvas at the target size.
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to rasterize chart SVG'));
    img.src = serializer;
  });

  const width = (svg.clientWidth || svg.viewBox.baseVal.width || 600);
  const height = (svg.clientHeight || svg.viewBox.baseVal.height || 300);
  const out = document.createElement('canvas');
  out.width = Math.round(width * ratio);
  out.height = Math.round(height * ratio);
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(img, 0, 0, out.width, out.height);
  const url = out.toDataURL('image/png');
  download(url, filename);
  return url;
}

/** Convenience hook used by toolbar buttons: export a ref'd container. */
export function makePngExporter(
  containerGetter: () => HTMLElement | null,
  filename = 'medicore-chart.png',
) {
  return () => exportChartPng(containerGetter(), filename).catch(() => null);
}