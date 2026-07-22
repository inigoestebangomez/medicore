import { ImportWizard } from './import-wizard';

export default function ImportsPage() {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-on-surface">Importar pacientes</h1>
        <p className="text-sm text-on-surface-variant">
          Sube un Excel del hospital, revisa el mapeo propuesto y confirma los cruces.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
