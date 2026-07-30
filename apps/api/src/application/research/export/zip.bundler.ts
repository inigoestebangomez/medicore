// apps/api/src/application/research/export/zip.bundler.ts
// Bundles an array of {filename, buffer} pairs into a single ZIP using
// `archiver` (M7). `archiver` is injected for testability (real default export
// in production). Returns the final Buffer.

import type { Archiver } from 'archiver';
import { Writable } from 'stream';

export interface ArchivePair {
  filename: string;
  buffer: Buffer;
}

export type ArchiverFactory = () => Archiver;

export class ZipBundler {
  constructor(private readonly createArchive: ArchiverFactory) {}

  async bundle(pairs: ArchivePair[]): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const archive = this.createArchive();
      const chunks: Buffer[] = [];
      const sink = new Writable({
        write(chunk, _enc, cb) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); cb(); },
      });
      archive.on('error', reject);
      archive.on('warning', () => {});
      archive.pipe(sink);
      sink.on('finish', () => {
        const out = Buffer.concat(chunks);
        resolve(out);
      });
      for (const p of pairs) {
        archive.append(p.buffer, { name: p.filename });
      }
      archive.finalize();
    });
  }
}