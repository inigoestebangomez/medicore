export class ImportPreviewUnavailableError extends Error {
  constructor() {
    super('El contenido completo de esta importación ya no está disponible. Vuelve a subir el archivo para continuar.');
    this.name = 'ImportPreviewUnavailableError';
  }
}
