// apps/api/prisma/seed.ts
// Seed script placeholder — will be populated when entities are created
// See docs/02-data-schema.md §9 for seed data requirements

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // TODO: Populate seed data for development and tests
  // - Demo organization: "Clínica ORL Dr. Martínez" (slug: clinica-orl-martinez)
  // - Demo physician: physician@demo.medicore.com, role: OWNER
  // - 10 demo patients with ORL pathologies:
  //   - Rinosinusitis crónica (J32.9) + SNOT-22
  //   - Otitis media secretora bilateral (H65.3) + audiometría
  //   - Desviación septal + CENS bilateral (J34.2) + cirugía
  //   - Vértigo posicional paroxístico benigno (H81.1) + DHI + VHIT
  //   - Amígdalas hipertróficas grado III (J35.1) + cirugía
  //   - Nódulos de cuerdas vocales (J38.2) + VHI + laringoscopia
  //   - Hipoacusia neurosensorial bilateral (H90.3) + audiometría + ABR
  //   - Apnea del sueño moderada (G47.3) + Epworth + STOP-BANG
  console.log('[Seed] Placeholder — populate when entities are ready');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
