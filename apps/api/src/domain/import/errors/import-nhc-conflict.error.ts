export type ImportNhcConflictReason = 'soft-deleted' | 'unresolved';

export class ImportNhcConflictError extends Error {
  constructor(
    public readonly nhc: string,
    public readonly reason: ImportNhcConflictReason,
  ) {
    super(
      reason === 'soft-deleted'
        ? `No se puede finalizar la importacion: el NHC "${nhc}" ya pertenece a un paciente eliminado. No se restaurara ni sobrescribira automaticamente; requiere resolucion manual antes de reintentar.`
        : `No se puede finalizar la importacion: no se pudo resolver el paciente que ocupa el NHC "${nhc}" despues de una colision concurrente. Revisa el paciente y reintenta la importacion.`
    );
    this.name = 'ImportNhcConflictError';
  }
}
