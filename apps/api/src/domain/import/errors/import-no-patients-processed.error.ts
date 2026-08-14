export class ImportNoPatientsProcessedError extends Error {
  constructor(public readonly identifiableRowCount: number) {
    super(
      `La importación no procesó ningún paciente aunque encontró ${identifiableRowCount} fila${identifiableRowCount === 1 ? '' : 's'} identificable${identifiableRowCount === 1 ? '' : 's'}. Revisa las decisiones de coincidencia y que el NHC y el nombre estén mapeados correctamente antes de reintentar.`,
    );
    this.name = 'ImportNoPatientsProcessedError';
  }
}
