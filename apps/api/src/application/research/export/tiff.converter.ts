// apps/api/src/application/research/export/tiff.converter.ts
// Converts a PNG buffer to a 300-dpi TIFF using `sharp` (M7). `sharp` is a native
// module — it is loaded lazily inside `convert()` so unit tests can inject a
// mock without touching the native binding.

export interface SharpLike {
  (input: Buffer): SharpPipeline;
}

export interface SharpPipeline {
  tiff(options?: { density?: number }): SharpPipeline;
  png(): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}

const DEFAULT_DPI = 300;

export class TiffConverter {
  constructor(
    /** injected for testability; in production the real `sharp` default export */
    private readonly sharp: SharpLike,
  ) {}

  async convert(png: Buffer, dpi = DEFAULT_DPI): Promise<Buffer> {
    const buf = await this.sharp(png).tiff({ density: dpi }).toBuffer();
    return buf;
  }
}