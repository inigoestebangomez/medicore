// apps/api/prisma/seed.ts
// MediCore — ORL Clinical Seed Data
// Populates realistic mock data for development and demos

import { PrismaClient, Sex, AllergySeverity, AllergyStatus, ConsultationType, SurgeryStatus, AsaClassification, ReportType, ReportStatus, ClinicalScaleType, MedicationStatus, ImagingStudyType } from '@prisma/client';

const prisma = new PrismaClient();

// ── IDs from existing DB ──
const ORG_ID = 'beeaedcf-6eed-4377-b981-2cd991f82180';
const USER_ID = '92a6d917-f89e-4abd-9d13-4cad2e2aedee';

// ── Helper: generate sequential NHC ──
function nhc(seq: number): string {
  const year = new Date().getFullYear();
  return `${year}-${String(seq).padStart(5, '0')}`;
}

async function main() {
  console.log('[Seed] Clearing existing clinical data...');
  await prisma.auditLog.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.report.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.imagingStudy.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.medicationPrescription.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.clinicalScale.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.surgery.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.consultation.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.allergy.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.consentRecord.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.patient.deleteMany({ where: { organizationId: ORG_ID } });

  console.log('[Seed] Creating patients...');

  // ────────────────────────────────────────
  // PATIENT 1: Rinosinusitis crónica
  // ────────────────────────────────────────
  const p1 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(1),
      firstName: 'Carmen',
      lastName: 'García López',
      birthDate: new Date('1975-04-12'),
      sex: Sex.FEMALE,
      idDocument: '12345678A',
      idDocType: 'DNI',
      phone: '612345678',
      email: 'carmen.garcia@email.com',
      bloodType: 'A_POS',
      createdBy: USER_ID,
    },
  });

  await prisma.allergy.create({
    data: {
      organizationId: ORG_ID,
      patientId: p1.id,
      substance: 'Amoxicilina',
      substanceCode: '372687004',
      reaction: 'Erupción cutánea generalizada',
      severity: AllergySeverity.MODERATE,
      status: AllergyStatus.ACTIVE,
      onsetDate: new Date('2020-03-15'),
      createdBy: USER_ID,
    },
  });

  const c1a = await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p1.id,
      date: new Date('2025-11-10'),
      type: ConsultationType.FIRST_VISIT,
      physicianId: USER_ID,
      chiefComplaint: 'Congestión nasal crónica bilateral y cefalea frontal desde hace 6 meses',
      currentIllness: 'Paciente refiere obstrucción nasal bilateral persistente, rinorrea purulenta ocasional, hiposmia y presión facial frontal. Síntomas empeoran con cambios de temperatura. No respuesta a corticoides nasales ni antihistamínicos orales durante 3 meses.',
      physicalExam: {
        rinoscopia: { mucosa: 'eritematosa', cornetes: 'hipertróficos grado II', secreciones: 'purulentas en meato medio bilateral' },
        otoscopia: { oidoDerecho: 'normal', oidoIzquierdo: 'normal' },
        orofaringe: 'normal',
      },
      assessment: 'Rinosinusitis crónica con pólipos nasales bilateral (J32.4). Probable componente alérgico.',
      diagnosisCodes: [
        { system: 'ICD10', code: 'J32.4', description: 'Rinosinusitis crónica con pólipos nasales', type: 'primary' },
        { system: 'ICD10', code: 'J30.4', description: 'Rinitis alérgica perenne', type: 'secondary' },
      ],
      plan: 'Solicitar TAC de senos paranasales. Iniciar corticoides sistémicos pauta descendente + lavados nasales. Valorar cirugía endoscópica nasosinusal si no hay mejoría en 2 meses.',
      createdBy: USER_ID,
    },
  });

  await prisma.clinicalScale.create({
    data: {
      organizationId: ORG_ID,
      patientId: p1.id,
      consultationId: c1a.id,
      scaleType: ClinicalScaleType.SNOT_22,
      date: new Date('2025-11-10'),
      scores: {
        needBlowNose: 4, sneezing: 2, runnyNose: 4, cough: 2, postnasalDrip: 5,
        thickNasalDischarge: 4, earFullness: 2, dizziness: 1, earPain: 0, facialPainPressure: 4,
        difficultyFallingAsleep: 3, wakeAtNight: 2, lackOfGoodSleep: 3, wakeUpTired: 3,
        fatigue: 3, reducedProductivity: 2, reducedConcentration: 2, frustratedRestless: 3,
        sad: 1, embarrassed: 1, senseTasteSmell: 5, nasalObstruction: 5,
      },
      total: 58,
      createdBy: USER_ID,
    },
  });

  await prisma.imagingStudy.create({
    data: {
      organizationId: ORG_ID,
      patientId: p1.id,
      consultationId: c1a.id,
      type: ImagingStudyType.CT_SCAN,
      date: new Date('2025-11-15'),
      description: 'TAC de senos paranasales — cortes coronales y axiales',
      findings: 'Ocupación completa de senos maxilares y etmoidales bilaterales. Pólipos en meato medio bilateral. Complejo ostiomeatal obstruido. No erosión ósea.',
      files: [{ name: 'tac_senos_carmen_garcia.dcm', url: 'r2://imaging/tac_senos_carmen_garcia.dcm', size: 45678901 }],
      createdBy: USER_ID,
    },
  });

  await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p1.id,
      date: new Date('2025-12-05'),
      type: ConsultationType.FOLLOW_UP,
      physicianId: USER_ID,
      chiefComplaint: 'Control post-tratamiento médico. Persiste clínica.',
      currentIllness: 'Tras 3 semanas de corticoides orales + lavados nasales, mejoría parcial pero persiste obstrucción nasal significativa y anosmia. TAC muestra pansinusitis con pólipos.',
      assessment: 'Rinosinusitis crónica con pólipos nasales refractaria a tratamiento médico. Candidata a CENS bilateral.',
      diagnosisCodes: [{ system: 'ICD10', code: 'J32.4', description: 'Rinosinusitis crónica con pólipos nasales', type: 'primary' }],
      plan: 'Programar cirugía endoscópica nasosinusal bilateral + polipectomía. Consentimiento informado. Preoperatorio completo.',
      createdBy: USER_ID,
    },
  });

  await prisma.surgery.create({
    data: {
      organizationId: ORG_ID,
      patientId: p1.id,
      physicianId: USER_ID,
      date: new Date('2026-01-20'),
      status: SurgeryStatus.COMPLETED,
      procedureType: 'Cirugía endoscópica nasosinusal bilateral + polipectomía etmoidal',
      procedureCodes: [{ system: 'ICD10PCS', code: '09BV4ZZ', description: 'Excision of nasal septum, percutaneous endoscopic approach' }],
      asa: AsaClassification.ASA_I,
      anesthesiaType: 'General',
      preOpChecklist: { bloodwork: true, consent: true, fasting: true, ecg: true, rxThorax: false },
      duration: 95,
      technique: {
        abordaje: 'Endoscópico transnasal',
        procedimientos: ['Uncinectomía bilateral', 'Antrostomía maxilar bilateral', 'Etmoidectomía anterior y posterior bilateral', 'Polipectomía'],
        taponamiento: 'Merocel bilateral 48h',
      },
      findings: 'Pólipos grado III en ambas fosas nasales. Mucosa polipoidea en etmoides. Senos maxilares con contenido mucopurulento espeso.',
      postOpNotes: 'Buena evolución postoperatoria. Retirado taponamiento a las 48h. Iniciados lavados nasales con suero salino.',
      postOpProtocol: { visitas: ['1 semana', '1 mes', '3 meses', '6 meses'], cuidados: ['Lavados nasales 3 veces/día', 'Corticoides nasales a partir del 7º día', 'Evitar esfuerzos físicos 2 semanas'] },
      createdBy: USER_ID,
    },
  });

  await prisma.medicationPrescription.create({
    data: {
      organizationId: ORG_ID,
      patientId: p1.id,
      physicianId: USER_ID,
      drugName: 'Mometasona furoato 50mcg',
      activeIngredient: 'Mometasona',
      dosage: '50mcg/dosis',
      frequency: '2 aplicaciones en cada fosa nasal cada 12 horas',
      route: 'tópico nasal',
      form: 'spray nasal',
      startDate: new Date('2026-01-27'),
      status: MedicationStatus.ACTIVE,
      reason: 'Mantenimiento post-CENS',
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // PATIENT 2: Otitis media secretora bilateral
  // ────────────────────────────────────────
  const p2 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(2),
      firstName: 'Alejandro',
      lastName: 'Martínez Ruiz',
      birthDate: new Date('2019-08-03'),
      sex: Sex.MALE,
      idDocument: '23456789B',
      idDocType: 'DNI',
      phone: '623456789',
      email: 'padres.martinez@email.com',
      emergencyContact: { name: 'Laura Ruiz', relationship: 'Madre', phone: '634567890' },
      bloodType: 'O_POS',
      notes: 'Paciente pediátrico. Derivado por pediatra por hipoacusia detectada en revisión escolar.',
      createdBy: USER_ID,
    },
  });

  await prisma.allergy.create({
    data: {
      organizationId: ORG_ID,
      patientId: p2.id,
      substance: 'Polen de gramíneas',
      reaction: 'Rinoconjuntivitis estacional',
      severity: AllergySeverity.MILD,
      status: AllergyStatus.ACTIVE,
      createdBy: USER_ID,
    },
  });

  const c2a = await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p2.id,
      date: new Date('2025-09-15'),
      type: ConsultationType.FIRST_VISIT,
      physicianId: USER_ID,
      chiefComplaint: 'El niño oye mal en clase según profesora. Infecciones de oído frecuentes.',
      currentIllness: 'Madre refiere 4-5 episodios de otitis media aguda en el último año. Profesora notó que no responde cuando le hablan desde atrás. No dolor actual. Respiración oral nocturna.',
      physicalExam: {
        otoscopia: { oidoDerecho: 'retracción timpánica con nivel hidroaéreo', oidoIzquierdo: 'tímpano opaco, abombado, sin movilidad' },
        rinoscopia: { mucosa: 'levemente congestiva', cornetes: 'normales' },
        orofaringe: 'amígdalas grado I',
      },
      assessment: 'Otitis media secretora (seromucosa) bilateral (H65.3). Hipoacusia de transmisión secundaria. Posible hipertrofia adenoidea.',
      diagnosisCodes: [
        { system: 'ICD10', code: 'H65.3', description: 'Otitis media mucoide crónica', type: 'primary' },
        { system: 'ICD10', code: 'H90.3', description: 'Hipoacusia neurosensorial bilateral', type: 'secondary' },
      ],
      plan: 'Audiometría tonal + impedanciometría. Valorar adenoidectomía + drenajes transtimpánicos si persiste tras 3 meses de tratamiento médico.',
      followUpDate: new Date('2025-12-15'),
      createdBy: USER_ID,
    },
  });

  await prisma.imagingStudy.create({
    data: {
      organizationId: ORG_ID,
      patientId: p2.id,
      consultationId: c2a.id,
      type: ImagingStudyType.AUDIOGRAM,
      date: new Date('2025-09-20'),
      description: 'Audiometría tonal + impedanciometría',
      findings: 'Hipoacusia de transmisión bilateral moderada (40dB). Curva B bilateral en impedanciometría. Reflejo estapedial ausente bilateral.',
      files: [{ name: 'audiometria_alejandro_martinez.pdf', url: 'r2://imaging/audiometria_alejandro_martinez.pdf', size: 234567 }],
      createdBy: USER_ID,
    },
  });

  await prisma.surgery.create({
    data: {
      organizationId: ORG_ID,
      patientId: p2.id,
      physicianId: USER_ID,
      date: new Date('2026-04-10'),
      status: SurgeryStatus.SCHEDULED,
      procedureType: 'Adenoidectomía + drenajes transtimpánicos bilaterales',
      asa: AsaClassification.ASA_I,
      anesthesiaType: 'General',
      preOpChecklist: { bloodwork: false, consent: true, fasting: true, ecg: false, rxThorax: false },
      preOpNotes: 'Paciente pediátrico 6 años. ASA I. Sin alergias medicamentosas relevantes.',
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // PATIENT 3: Vértigo posicional paroxístico benigno
  // ────────────────────────────────────────
  const p3 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(3),
      firstName: 'Manuela',
      lastName: 'Fernández Torres',
      birthDate: new Date('1962-11-28'),
      sex: Sex.FEMALE,
      idDocument: '34567890C',
      idDocType: 'DNI',
      phone: '634567891',
      email: 'manuela.fernandez@email.com',
      bloodType: 'B_POS',
      createdBy: USER_ID,
    },
  });

  const c3a = await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p3.id,
      date: new Date('2025-10-08'),
      type: ConsultationType.FIRST_VISIT,
      physicianId: USER_ID,
      chiefComplaint: 'Episodios de mareo intenso con sensación de giro al acostarse o girar en la cama',
      currentIllness: 'Desde hace 3 semanas presenta crisis de vértigo rotatorio de 30-60 segundos de duración desencadenadas por cambios posturales: acostarse, girar en cama, mirar hacia arriba. No hipoacusia, no acúfenos. No náuseas importantes. Refiere inestabilidad residual entre crisis.',
      physicalExam: {
        otoscopia: 'normal bilateral',
        pruebasVestibulares: 'Dix-Hallpike positivo derecho con nistagmo torsional-horizontal geotrópico de 5s de latencia y 25s de duración. Agotable.',
        rinoscopia: 'normal',
      },
      assessment: 'Vértigo posicional paroxístico benigno (VPPB) del canal semicircular posterior derecho (H81.1). Canalolitiasis.',
      diagnosisCodes: [{ system: 'ICD10', code: 'H81.1', description: 'Vértigo paroxístico benigno', type: 'primary' }],
      plan: 'Maniobra de Epley canalicular derecha en consulta. Reevaluar en 1 semana. Si persiste, rehabilitación vestibular.',
      createdBy: USER_ID,
    },
  });

  await prisma.clinicalScale.create({
    data: {
      organizationId: ORG_ID,
      patientId: p3.id,
      consultationId: c3a.id,
      scaleType: ClinicalScaleType.DHI,
      date: new Date('2025-10-08'),
      scores: {
        doesLookingUpIncreaseProblem: 4, feelingFrustrated: 4, restrictTravel: 2,
        walkingDownSupermarketAisle: 2, difficultyGettingIntoBed: 4, restrictSocialActivities: 2,
        difficultyReading: 0, performingMoreStrenuousActivities: 2, embarrassed: 2,
        quickHeadMovements: 4, afraidToStayHomeAlone: 0, afraidPeopleThinkIntoxicated: 0,
        difficultyWalking: 2, difficultyConcentrating: 0, walkingInDark: 2,
        feelingHandicapped: 2, takingShower: 0, feelingDepressed: 0,
        quickMovementsAffect: 4, relationshipWithFamily: 0, bendingOver: 4,
        feelingDisabled: 2, turningOverInBed: 4, feelingDizzy: 0,
        stooping: 2,
      },
      total: 46,
      createdBy: USER_ID,
    },
  });

  const c3b = await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p3.id,
      date: new Date('2025-10-15'),
      type: ConsultationType.FOLLOW_UP,
      physicianId: USER_ID,
      chiefComplaint: 'Control post-maniobra de Epley. Mejoría significativa.',
      currentIllness: 'Tras maniobra de Epley el 08/10, refiere desaparición completa de las crisis de vértigo rotatorio. Persiste leve inestabilidad matutina que va cediendo.',
      physicalExam: { pruebasVestibulares: 'Dix-Hallpike bilateral negativo. No nistagmo.' },
      assessment: 'Resolución del VPPB. Inestabilidad residual en remisión.',
      plan: 'Alta. Ejercicios vestibulares domiciliarios 2 semanas. Volver si recurrencia.',
      createdBy: USER_ID,
    },
  });

  await prisma.clinicalScale.create({
    data: {
      organizationId: ORG_ID,
      patientId: p3.id,
      consultationId: c3b.id,
      scaleType: ClinicalScaleType.DHI,
      date: new Date('2025-10-15'),
      scores: {
        doesLookingUpIncreaseProblem: 0, feelingFrustrated: 0, restrictTravel: 0,
        walkingDownSupermarketAisle: 0, difficultyGettingIntoBed: 0, restrictSocialActivities: 0,
        difficultyReading: 0, performingMoreStrenuousActivities: 0, embarrassed: 0,
        quickHeadMovements: 0, afraidToStayHomeAlone: 0, afraidPeopleThinkIntoxicated: 0,
        difficultyWalking: 0, difficultyConcentrating: 0, walkingInDark: 0,
        feelingHandicapped: 0, takingShower: 0, feelingDepressed: 0,
        quickMovementsAffect: 0, relationshipWithFamily: 0, bendingOver: 0,
        feelingDisabled: 0, turningOverInBed: 0, feelingDizzy: 0,
        stooping: 0,
      },
      total: 0,
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // PATIENT 4: Desviación septal + hipertrofia de cornetes
  // ────────────────────────────────────────
  const p4 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(4),
      firstName: 'Javier',
      lastName: 'Sánchez Ortega',
      birthDate: new Date('1988-03-22'),
      sex: Sex.MALE,
      idDocument: '45678901D',
      idDocType: 'DNI',
      phone: '645678902',
      createdBy: USER_ID,
    },
  });

  await prisma.allergy.create({
    data: {
      organizationId: ORG_ID,
      patientId: p4.id,
      substance: 'AINEs (Ibuprofeno)',
      reaction: 'Angioedema periorbitario',
      severity: AllergySeverity.SEVERE,
      status: AllergyStatus.ACTIVE,
      onsetDate: new Date('2015-06-01'),
      notes: 'Reacción confirmada en urgencias. Evitar todos los AINEs.',
      createdBy: USER_ID,
    },
  });

  await prisma.allergy.create({
    data: {
      organizationId: ORG_ID,
      patientId: p4.id,
      substance: 'Látex',
      reaction: 'Dermatitis de contacto',
      severity: AllergySeverity.MILD,
      status: AllergyStatus.ACTIVE,
      createdBy: USER_ID,
    },
  });

  const c4a = await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p4.id,
      date: new Date('2025-10-22'),
      type: ConsultationType.FIRST_VISIT,
      physicianId: USER_ID,
      chiefComplaint: 'No puedo respirar por la nariz desde siempre. Ronco mucho.',
      currentIllness: 'Obstrucción nasal derecha crónica desde la adolescencia. Respiración oral nocturna con ronquido intenso. Apneas presenciadas por su pareja. Cefalea matutina frecuente. Epworth 14/24.',
      physicalExam: {
        rinoscopia: { septum: 'desviación septal derecha grado III', cornetes: 'hipertrofia compensadora de cornete inferior izquierdo' },
        orofaringe: 'Mallampati III. Úvula elongada.',
        otoscopia: 'normal bilateral',
      },
      assessment: 'Desviación septal derecha (J34.2) + hipertrofia de cornetes + probable SAOS moderado.',
      diagnosisCodes: [
        { system: 'ICD10', code: 'J34.2', description: 'Desviación del tabique nasal', type: 'primary' },
        { system: 'ICD10', code: 'G47.3', description: 'Apnea del sueño', type: 'secondary' },
      ],
      plan: 'Solicitar polisomnografía. Septoplastia + turbinoplastia programada. Valorar CPAP si SAOS confirmado.',
      createdBy: USER_ID,
    },
  });

  await prisma.clinicalScale.create({
    data: {
      organizationId: ORG_ID,
      patientId: p4.id,
      consultationId: c4a.id,
      scaleType: ClinicalScaleType.OSA_EPWORTH,
      date: new Date('2025-10-22'),
      scores: {
        sittingAndReading: 2, watchingTV: 1, sittingInPublicPlace: 0,
        passengerInCar: 1, lyingDown: 3, sittingAndTalking: 0,
        sittingQuietlyAfterLunch: 2, inCarWhileStopped: 3,
      },
      total: 12,
      createdBy: USER_ID,
    },
  });

  await prisma.clinicalScale.create({
    data: {
      organizationId: ORG_ID,
      patientId: p4.id,
      consultationId: c4a.id,
      scaleType: ClinicalScaleType.STOPBANG,
      date: new Date('2025-10-22'),
      scores: {
        snoring: 1, tired: 1, observedApnea: 1,
        pressure: 0, bmi: 1, age: 0,
        neck: 1, gender: 1,
      },
      total: 6,
      createdBy: USER_ID,
    },
  });

  await prisma.surgery.create({
    data: {
      organizationId: ORG_ID,
      patientId: p4.id,
      physicianId: USER_ID,
      date: new Date('2026-02-14'),
      status: SurgeryStatus.COMPLETED,
      procedureType: 'Septoplastia + turbinoplastia bilateral por radiofrecuencia',
      asa: AsaClassification.ASA_II,
      anesthesiaType: 'General',
      preOpChecklist: { bloodwork: true, consent: true, fasting: true, ecg: true, rxThorax: true },
      duration: 75,
      technique: {
        abordaje: 'Endonasal',
        procedimientos: ['Septoplastia con incisión hemitransfixiante izquierda', 'Resección de cresta septal', 'Turbinoplastia bilateral con radiofrecuencia'],
        taponamiento: 'Splints septales bilaterales 7 días',
      },
      findings: 'Desviación septal cartilaginosa y ósea a derecha. Cresta septal inferior. Cornetes inferiores hipertróficos.',
      postOpNotes: 'Taponamiento ligero. Dolor controlado con paracetamol (evitar AINEs por alergia).',
      createdBy: USER_ID,
    },
  });

  await prisma.medicationPrescription.create({
    data: {
      organizationId: ORG_ID,
      patientId: p4.id,
      physicianId: USER_ID,
      drugName: 'Paracetamol 1g',
      activeIngredient: 'Paracetamol',
      dosage: '1g',
      frequency: 'cada 8 horas si dolor',
      route: 'oral',
      startDate: new Date('2026-02-14'),
      duration: '5 días',
      status: MedicationStatus.COMPLETED,
      reason: 'Analgesia postoperatoria (alérgico a AINEs)',
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // PATIENT 5: Nódulos de cuerdas vocales
  // ────────────────────────────────────────
  const p5 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(5),
      firstName: 'María Isabel',
      lastName: 'Gómez Díaz',
      birthDate: new Date('1992-05-17'),
      sex: Sex.FEMALE,
      idDocument: '56789012E',
      idDocType: 'DNI',
      phone: '656789013',
      email: 'maribel.gomez@email.com',
      createdBy: USER_ID,
    },
  });

  const c5a = await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p5.id,
      date: new Date('2025-11-05'),
      type: ConsultationType.FIRST_VISIT,
      physicianId: USER_ID,
      chiefComplaint: 'Disfonía crónica. Soy profesora de primaria y cada vez me cuesta más dar clase.',
      currentIllness: 'Disfonía progresiva de 8 meses de evolución. Empeora a lo largo del día y tras uso vocal prolongado. Carraspeo frecuente. Sensación de cuerpo extraño faríngeo. No dolor. No disfagia. No disnea.',
      physicalExam: {
        laringoscopia: 'Nódulos vocales bilaterales simétricos en unión de tercio anterior con medio. Cierre glótico incompleto en reloj de arena. Signos de tensión muscular laríngea.',
        rinoscopia: 'normal',
        otoscopia: 'normal',
      },
      assessment: 'Nódulos de cuerdas vocales bilaterales (J38.2). Disfonía por tensión muscular asociada.',
      diagnosisCodes: [{ system: 'ICD10', code: 'J38.2', description: 'Nódulos de las cuerdas vocales', type: 'primary' }],
      plan: 'Rehabilitación logopédica 2 sesiones/semana x 3 meses. Higiene vocal. Control en 3 meses con laringoscopia.',
      createdBy: USER_ID,
    },
  });

  await prisma.clinicalScale.create({
    data: {
      organizationId: ORG_ID,
      patientId: p5.id,
      consultationId: c5a.id,
      scaleType: ClinicalScaleType.VHI,
      date: new Date('2025-11-05'),
      scores: {
        voiceMakesItDifficultToBeHeard: 3, runOutOfAir: 1, voiceVaries: 2,
        peopleHaveDifficultyUnderstanding: 2, voiceWorseInEvening: 3, clearVoiceUnpredictable: 2,
        strainToSpeak: 3, avoidSocial: 1, voiceLimitsPersonalLife: 2,
        feelLeftOut: 1, voiceProblemUpsets: 3, tendToAvoidGroups: 1,
        annoyed: 2, frustrates: 3, voiceLimitsSocial: 2,
        troubleSpeakingLoudly: 3, uncertain: 1, peopleAskRepeat: 3,
        voiceSoundDifferent: 3, embarrassed: 2, lessOutgoing: 1,
        usePhoneLess: 0, incomeAffected: 0, feelHandicapped: 2,
        voiceWorseDuringDay: 3, unpredictable: 1, loseVoice: 2,
        effortToSpeak: 3, peopleIrritated: 0, askWhatIsWrong: 2,
      },
      total: 51,
      createdBy: USER_ID,
    },
  });

  await prisma.medicationPrescription.create({
    data: {
      organizationId: ORG_ID,
      patientId: p5.id,
      physicianId: USER_ID,
      drugName: 'Omeprazol 20mg',
      activeIngredient: 'Omeprazol',
      dosage: '20mg',
      frequency: 'cada 24 horas en ayunas',
      route: 'oral',
      startDate: new Date('2025-11-05'),
      duration: '3 meses',
      status: MedicationStatus.ACTIVE,
      reason: 'Sospecha de RGE silente asociado a disfonía',
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // PATIENT 6: Amigdalitis crónica + hipertrofia amigdalar
  // ────────────────────────────────────────
  const p6 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(6),
      firstName: 'Daniel',
      lastName: 'Hernández Gil',
      birthDate: new Date('2005-09-30'),
      sex: Sex.MALE,
      idDocument: '67890123F',
      idDocType: 'DNI',
      phone: '667890124',
      createdBy: USER_ID,
    },
  });

  await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p6.id,
      date: new Date('2025-12-01'),
      type: ConsultationType.FIRST_VISIT,
      physicianId: USER_ID,
      chiefComplaint: 'Anginas de repetición. 6-7 episodios al año. Fiebre alta cada vez.',
      currentIllness: 'Desde hace 3 años presenta amigdalitis aguda recurrente (6-7 episodios/año) con fiebre >38.5°C, odinofagia intensa y adenopatías cervicales. Cada episodio requiere antibiótico y baja escolar. Antecedente de absceso periamigdalino drenado hace 1 año.',
      physicalExam: {
        orofaringe: 'Amígdalas palatinas grado III-IV crípticas con caseum. No exudados actuales.',
        rinoscopia: 'normal',
        otoscopia: 'normal',
        cuello: 'Adenopatías subangulomandibulares bilaterales rodaderas.',
      },
      assessment: 'Amigdalitis crónica críptica (J35.0) + hipertrofia amigdalar obstructiva grado III-IV.',
      diagnosisCodes: [{ system: 'ICD10', code: 'J35.0', description: 'Amigdalitis crónica', type: 'primary' }],
      plan: 'Amigdalectomía bilateral programada. Cumple criterios de Paradise (7 episodios/año). Consentimiento informado.',
      createdBy: USER_ID,
    },
  });

  await prisma.surgery.create({
    data: {
      organizationId: ORG_ID,
      patientId: p6.id,
      physicianId: USER_ID,
      date: new Date('2026-03-05'),
      status: SurgeryStatus.COMPLETED,
      procedureType: 'Amigdalectomía bilateral por disección',
      asa: AsaClassification.ASA_I,
      anesthesiaType: 'General',
      preOpChecklist: { bloodwork: true, consent: true, fasting: true, ecg: false, rxThorax: false },
      duration: 45,
      technique: { abordaje: 'Transoral', tecnica: 'Disección roma con asa fría', hemostasia: 'Bipolar' },
      findings: 'Amígdalas crípticas con material caseoso abundante. Sin complicaciones intraoperatorias.',
      postOpNotes: 'Buena evolución. Dolor controlado. Ingiere líquidos a las 6h.',
      postOpProtocol: { dieta: 'Líquidos fríos 48h, blanda 7 días', analgesia: 'Paracetamol + Metamizol alternos', control: '1 semana' },
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // PATIENT 7: Hipoacusia neurosensorial bilateral
  // ────────────────────────────────────────
  const p7 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(7),
      firstName: 'Antonio',
      lastName: 'López Márquez',
      birthDate: new Date('1954-01-15'),
      sex: Sex.MALE,
      idDocument: '78901234G',
      idDocType: 'DNI',
      phone: '678901235',
      email: 'antonio.lopez@email.com',
      bloodType: 'A_NEG',
      createdBy: USER_ID,
    },
  });

  const c7a = await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p7.id,
      date: new Date('2025-11-20'),
      type: ConsultationType.FIRST_VISIT,
      physicianId: USER_ID,
      chiefComplaint: 'No oigo bien. Mi familia se queja de que pongo la tele muy alta.',
      currentIllness: 'Hipoacusia bilateral progresiva de 3-4 años de evolución. Mayor afectación en frecuencias agudas. Dificultad para seguir conversaciones en ambientes ruidosos. Acúfenos bilaterales agudos intermitentes. No vértigo. Antecedente laboral: 30 años en fábrica con exposición a ruido.',
      physicalExam: {
        otoscopia: 'CAEs permeables. Tímpanos normales bilateral.',
        rinoscopia: 'normal',
        acumetría: 'Rinne positivo bilateral. Weber centrado.',
      },
      assessment: 'Hipoacusia neurosensorial bilateral simétrica (H90.3) — probable presbiacusia + trauma acústico crónico.',
      diagnosisCodes: [
        { system: 'ICD10', code: 'H90.3', description: 'Hipoacusia neurosensorial bilateral', type: 'primary' },
        { system: 'ICD10', code: 'H93.1', description: 'Acúfenos subjetivos', type: 'secondary' },
      ],
      plan: 'Audiometría tonal + logoaudiometría. Adaptación de audífonos bilateral. Control en 3 meses.',
      createdBy: USER_ID,
    },
  });

  await prisma.imagingStudy.create({
    data: {
      organizationId: ORG_ID,
      patientId: p7.id,
      consultationId: c7a.id,
      type: ImagingStudyType.AUDIOGRAM,
      date: new Date('2025-11-25'),
      description: 'Audiometría tonal liminar + logoaudiometría',
      findings: 'HNS bilateral simétrica moderada-severa (55-65dB) en frecuencias agudas (>2000Hz). Conservación de graves. Logoaudiometría: 80% a 40dB. Compatible con presbiacusia + trauma acústico.',
      files: [{ name: 'audiometria_antonio_lopez.pdf', url: 'r2://imaging/audiometria_antonio_lopez.pdf', size: 198765 }],
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // PATIENT 8: Reflujo faringolaríngeo
  // ────────────────────────────────────────
  const p8 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(8),
      firstName: 'Laura',
      lastName: 'Vega Romero',
      birthDate: new Date('1985-07-09'),
      sex: Sex.FEMALE,
      idDocument: '89012345H',
      idDocType: 'DNI',
      phone: '689012346',
      email: 'laura.vega@email.com',
      createdBy: USER_ID,
    },
  });

  const c8a = await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p8.id,
      date: new Date('2026-01-10'),
      type: ConsultationType.FIRST_VISIT,
      physicianId: USER_ID,
      chiefComplaint: 'Sensación de nudo en la garganta y carraspeo constante desde hace meses',
      currentIllness: 'Globus faríngeo persistente de 6 meses de evolución. Carraspeo frecuente matutino. Tos seca irritativa. Regurgitación ácida ocasional. Empeora con café, picante y alcohol. No disfagia. No pérdida de peso.',
      physicalExam: {
        laringoscopia: 'Eritema y edema de aritenoides bilateral. Hipertrofia de banda ventricular. Edema de región retrocricoidea. Signos de RFL grado II.',
        rinoscopia: 'normal',
        orofaringe: 'Granularidad en pared faríngea posterior.',
      },
      assessment: 'Reflujo faringolaríngeo (RFL) moderado. Globus faríngeo secundario.',
      diagnosisCodes: [{ system: 'ICD10', code: 'K21.9', description: 'Enfermedad por reflujo gastroesofágico sin esofagitis', type: 'primary' }],
      plan: 'IBP dosis doble 3 meses + medidas higiénico-dietéticas. Control con RSI en 3 meses.',
      createdBy: USER_ID,
    },
  });

  await prisma.clinicalScale.create({
    data: {
      organizationId: ORG_ID,
      patientId: p8.id,
      consultationId: c8a.id,
      scaleType: ClinicalScaleType.RSI,
      date: new Date('2026-01-10'),
      scores: {
        hoarseness: 2, throatClearing: 4, excessThroatMucus: 3,
        difficultySwallowing: 1, coughingAfterEating: 2, breathingDifficulties: 0,
        troublesomeCough: 3, sensationOfLump: 5, heartburnChestPain: 2,
      },
      total: 22,
      createdBy: USER_ID,
    },
  });

  await prisma.medicationPrescription.create({
    data: {
      organizationId: ORG_ID,
      patientId: p8.id,
      physicianId: USER_ID,
      drugName: 'Esomeprazol 40mg',
      activeIngredient: 'Esomeprazol',
      dosage: '40mg',
      frequency: 'cada 12 horas en ayunas',
      route: 'oral',
      startDate: new Date('2026-01-10'),
      duration: '3 meses',
      status: MedicationStatus.ACTIVE,
      reason: 'Tratamiento empírico RFL',
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // PATIENT 9: Tumor de oído medio (colesteatoma)
  // ────────────────────────────────────────
  const p9 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(9),
      firstName: 'Roberto',
      lastName: 'Álvarez Nieto',
      birthDate: new Date('1978-12-03'),
      sex: Sex.MALE,
      idDocument: '90123456I',
      idDocType: 'DNI',
      phone: '690123457',
      createdBy: USER_ID,
    },
  });

  await prisma.allergy.create({
    data: {
      organizationId: ORG_ID,
      patientId: p9.id,
      substance: 'Penicilina',
      reaction: 'Anafilaxia — shock anafiláctico',
      severity: AllergySeverity.ANAPHYLAXIS,
      status: AllergyStatus.ACTIVE,
      onsetDate: new Date('2008-02-14'),
      notes: 'Episodio confirmado en urgencias. Intubación requerida. ALERGIA CRÍTICA.',
      createdBy: USER_ID,
    },
  });

  const c9a = await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p9.id,
      date: new Date('2026-02-20'),
      type: ConsultationType.FIRST_VISIT,
      physicianId: USER_ID,
      chiefComplaint: 'Supuración crónica del oído izquierdo y he notado que oigo menos',
      currentIllness: 'Otorrea crónica izquierda intermitente desde hace 2 años con episodios de reagudización. Hipoacusia progresiva ipsilateral. Otalgia ocasional leve. No vértigo franco pero inestabilidad ocasional.',
      physicalExam: {
        otoscopia: 'Oído derecho: normal. Oído izquierdo: perforación marginal ático con escama epidérmica y secreción purulenta escasa.',
        rinoscopia: 'normal',
      },
      assessment: 'Colesteatoma de oído medio izquierdo (H71). Sobreinfección crónica. Hipoacusia conductiva.',
      diagnosisCodes: [
        { system: 'ICD10', code: 'H71', description: 'Colesteatoma del oído medio', type: 'primary' },
        { system: 'ICD10', code: 'H90.1', description: 'Hipoacusia de conducción unilateral', type: 'secondary' },
      ],
      plan: 'TAC de peñascos urgente. Cirugía programada: timpanoplastia cerrada con mastoidectomía. Precaución: alergia ANAPHYLAXIS a penicilina. Usar clindamicina si precisa antibiótico.',
      followUpDate: new Date('2026-03-05'),
      createdBy: USER_ID,
    },
  });

  await prisma.imagingStudy.create({
    data: {
      organizationId: ORG_ID,
      patientId: p9.id,
      consultationId: c9a.id,
      type: ImagingStudyType.CT_SCAN,
      date: new Date('2026-02-25'),
      description: 'TAC de peñascos — cortes finos',
      findings: 'Ocupación de caja timpánica y ático izquierdo por masa de partes blandas con erosión del scutum y cadena osicular. Mastoides esclerótica. Sin extensión a fosa craneal media. Compatible con colesteatoma adquirido.',
      files: [{ name: 'tac_penascos_roberto_alvarez.dcm', url: 'r2://imaging/tac_penascos_roberto_alvarez.dcm', size: 56789012 }],
      createdBy: USER_ID,
    },
  });

  await prisma.surgery.create({
    data: {
      organizationId: ORG_ID,
      patientId: p9.id,
      physicianId: USER_ID,
      date: new Date('2026-05-15'),
      status: SurgeryStatus.SCHEDULED,
      procedureType: 'Timpanoplastia cerrada + mastoidectomía con reconstrucción osicular (TORP) — oído izquierdo',
      asa: AsaClassification.ASA_II,
      anesthesiaType: 'General',
      preOpChecklist: { bloodwork: true, consent: true, fasting: true, ecg: true, rxThorax: true },
      preOpNotes: 'CIRUGÍA DE ALTO RIESGO. Alergia ANAPHYLAXIS a penicilina — NO administrar betalactámicos. Protocolo de alergia activado. Monitorización neuromuscular por posible lesión del nervio facial.',
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // PATIENT 10: Parálisis facial periférica
  // ────────────────────────────────────────
  const p10 = await prisma.patient.create({
    data: {
      organizationId: ORG_ID,
      nhc: nhc(10),
      firstName: 'Sofía',
      lastName: 'Ramírez Castillo',
      birthDate: new Date('1990-11-08'),
      sex: Sex.FEMALE,
      idDocument: '01234567J',
      idDocType: 'DNI',
      phone: '601234568',
      email: 'sofia.ramirez@email.com',
      createdBy: USER_ID,
    },
  });

  await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p10.id,
      date: new Date('2026-04-02'),
      type: ConsultationType.URGENCY,
      physicianId: USER_ID,
      chiefComplaint: 'Me he levantado esta mañana y no puedo mover la mitad de la cara',
      currentIllness: 'Inicio súbito esta mañana de debilidad facial derecha completa. No puede cerrar el ojo derecho completamente. Desviación de comisura bucal a la izquierda al sonreír. No puede fruncir el ceño derecho. Lagrimeo. No otalgia. No lesiones cutáneas. Cuadro catarral leve hace 1 semana.',
      physicalExam: {
        exploracionFacial: 'Parálisis facial periférica derecha House-Brackmann grado IV. Signo de Bell positivo. No cierre palpebral completo.',
        otoscopia: 'normal bilateral. No vesículas.',
        rinoscopia: 'normal',
        paresCraneales: 'Resto de pares craneales normales.',
      },
      assessment: 'Parálisis facial periférica derecha idiopática (parálisis de Bell) G51.0. House-Brackmann IV.',
      diagnosisCodes: [{ system: 'ICD10', code: 'G51.0', description: 'Parálisis de Bell', type: 'primary' }],
      plan: 'Prednisona 60mg/día 5 días + Aciclovir 800mg/8h 7 días. Protección ocular: lágrimas artificiales + oclusión nocturna. Control en 1 semana. EMG si no mejoría en 3 semanas.',
      createdBy: USER_ID,
    },
  });

  await prisma.medicationPrescription.create({
    data: {
      organizationId: ORG_ID,
      patientId: p10.id,
      physicianId: USER_ID,
      drugName: 'Prednisona 30mg',
      activeIngredient: 'Prednisona',
      dosage: '60mg (2 comprimidos)',
      frequency: 'cada 24 horas en desayuno',
      route: 'oral',
      startDate: new Date('2026-04-02'),
      duration: '5 días',
      status: MedicationStatus.COMPLETED,
      reason: 'Parálisis de Bell — pauta descendente',
      createdBy: USER_ID,
    },
  });

  await prisma.medicationPrescription.create({
    data: {
      organizationId: ORG_ID,
      patientId: p10.id,
      physicianId: USER_ID,
      drugName: 'Aciclovir 800mg',
      activeIngredient: 'Aciclovir',
      dosage: '800mg',
      frequency: 'cada 8 horas',
      route: 'oral',
      startDate: new Date('2026-04-02'),
      duration: '7 días',
      status: MedicationStatus.COMPLETED,
      reason: 'Cobertura antiviral parálisis de Bell',
      createdBy: USER_ID,
    },
  });

  await prisma.consultation.create({
    data: {
      organizationId: ORG_ID,
      patientId: p10.id,
      date: new Date('2026-04-16'),
      type: ConsultationType.FOLLOW_UP,
      physicianId: USER_ID,
      chiefComplaint: 'Control de parálisis facial. Ya puedo cerrar el ojo.',
      currentIllness: 'Mejoría progresiva desde el 5º día de tratamiento. Ahora cierra el ojo completamente. Recupera movilidad frontal y nasogeniana. House-Brackmann II.',
      physicalExam: { exploracionFacial: 'House-Brackmann grado II. Cierre palpebral completo. Leve asimetría al sonreír.' },
      assessment: 'Parálisis de Bell en fase de recuperación. Buena evolución.',
      plan: 'Continuar ejercicios de mímica facial. Control en 1 mes. Alta previsible.',
      createdBy: USER_ID,
    },
  });

  // ────────────────────────────────────────
  // REPORTS
  // ────────────────────────────────────────
  await prisma.report.createMany({
    data: [
      {
        organizationId: ORG_ID,
        patientId: p1.id,
        physicianId: USER_ID,
        type: ReportType.SURGICAL_REPORT,
        status: ReportStatus.SIGNED,
        sourceType: 'surgery',
        sourceId: null, // will associate via patient
        title: 'Informe quirúrgico — CENS bilateral + polipectomía',
        content: '## Informe Quirúrgico\n\n**Paciente:** Carmen García López\n**NHC:** 2026-00001\n**Fecha:** 20/01/2026\n**Cirujano:** Dr. Iñi Stephen Blog\n\n### Procedimiento\nCirugía endoscópica nasosinusal bilateral + polipectomía etmoidal.\n\n### Hallazgos\nPólipos grado III en ambas fosas nasales. Mucosa polipoidea en etmoides. Senos maxilares con contenido mucopurulento espeso.\n\n### Técnica\n- Uncinectomía bilateral\n- Antrostomía maxilar bilateral\n- Etmoidectomía anterior y posterior bilateral\n- Polipectomía\n- Taponamiento con Merocel bilateral 48h\n\n### Complicaciones\nNinguna.\n\n### Plan Postoperatorio\n- Retirada de taponamiento a las 48h\n- Lavados nasales con suero salino 3 veces/día\n- Corticoides nasales a partir del 7º día\n- Control en consulta: 1 semana, 1 mes, 3 meses',
        aiGenerated: true,
        aiModel: 'claude-sonnet-4-20250514',
        signedAt: new Date('2026-01-21'),
        signedBy: USER_ID,
        createdBy: USER_ID,
      },
      {
        organizationId: ORG_ID,
        patientId: p3.id,
        physicianId: USER_ID,
        type: ReportType.FOLLOW_UP_REPORT,
        status: ReportStatus.SIGNED,
        sourceType: 'consultation',
        title: 'Informe de revisión — VPPB resuelto',
        content: '## Informe de Revisión\n\n**Paciente:** Manuela Fernández Torres\n**Fecha:** 15/10/2025\n\n### Diagnóstico\nVértigo posicional paroxístico benigno del canal semicircular posterior derecho (H81.1)\n\n### Evolución\nTras maniobra de Epley canalicular derecha realizada el 08/10/2025, la paciente refiere desaparición completa de las crisis de vértigo rotatorio. Persiste leve inestabilidad matutina en remisión. Dix-Hallpike bilateral negativo en el control actual.\n\n### Escala DHI\nPre-tratamiento: 46/100 → Post-tratamiento: 0/100\n\n### Plan\nAlta. Ejercicios vestibulares domiciliarios 2 semanas. Volver si recurrencia.',
        aiGenerated: true,
        aiModel: 'claude-sonnet-4-20250514',
        signedAt: new Date('2025-10-16'),
        signedBy: USER_ID,
        createdBy: USER_ID,
      },
      {
        organizationId: ORG_ID,
        patientId: p9.id,
        physicianId: USER_ID,
        type: ReportType.REFERRAL_LETTER,
        status: ReportStatus.DRAFT,
        sourceType: 'consultation',
        title: 'Carta de derivación — Colesteatoma oído medio izquierdo',
        content: '## Carta de Derivación\n\n**Paciente:** Roberto Álvarez Nieto\n**Fecha:** 20/02/2026\n\nEstimado compañero,\n\nRemito a Roberto Álvarez Nieto, 47 años, diagnosticado de colesteatoma de oído medio izquierdo (H71) con hipoacusia conductiva secundaria.\n\n### Hallazgos relevantes\n- Otorrea crónica izquierda de 2 años de evolución\n- Perforación marginal ático con escama epidérmica\n- TAC de peñascos: ocupación de caja timpánica y ático izquierdo con erosión del scutum\n- **ALERGIA ANAPHYLAXIS A PENICILINA**\n\n### Solicitud\nValoración para timpanoplastia cerrada + mastoidectomía con reconstrucción osicular.\n\nAdjunto TAC de peñascos.\n\nAtentamente,\nDr. Iñi Stephen Blog',
        aiGenerated: false,
        createdBy: USER_ID,
      },
    ],
  });

  // ────────────────────────────────────────
  // CONSENT RECORDS
  // ────────────────────────────────────────
  await prisma.consentRecord.createMany({
    data: [
      {
        organizationId: ORG_ID,
        patientId: p1.id,
        consentType: 'TREATMENT',
        grantedAt: new Date('2025-11-10'),
        collectedBy: USER_ID,
      },
      {
        organizationId: ORG_ID,
        patientId: p1.id,
        consentType: 'SURGERY',
        grantedAt: new Date('2026-01-10'),
        collectedBy: USER_ID,
      },
      {
        organizationId: ORG_ID,
        patientId: p1.id,
        consentType: 'DATA_PROCESSING',
        grantedAt: new Date('2025-11-10'),
        collectedBy: USER_ID,
      },
      {
        organizationId: ORG_ID,
        patientId: p2.id,
        consentType: 'TREATMENT',
        grantedAt: new Date('2025-09-15'),
        collectedBy: USER_ID,
      },
      {
        organizationId: ORG_ID,
        patientId: p4.id,
        consentType: 'TREATMENT',
        grantedAt: new Date('2025-10-22'),
        collectedBy: USER_ID,
      },
      {
        organizationId: ORG_ID,
        patientId: p4.id,
        consentType: 'SURGERY',
        grantedAt: new Date('2026-02-01'),
        collectedBy: USER_ID,
      },
      {
        organizationId: ORG_ID,
        patientId: p6.id,
        consentType: 'SURGERY',
        grantedAt: new Date('2026-02-20'),
        collectedBy: USER_ID,
      },
      {
        organizationId: ORG_ID,
        patientId: p9.id,
        consentType: 'SURGERY',
        grantedAt: new Date('2026-05-01'),
        collectedBy: USER_ID,
      },
    ],
  });

  // ────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────
  const patients = await prisma.patient.count({ where: { organizationId: ORG_ID } });
  const consultations = await prisma.consultation.count({ where: { organizationId: ORG_ID } });
  const surgeries = await prisma.surgery.count({ where: { organizationId: ORG_ID } });
  const scales = await prisma.clinicalScale.count({ where: { organizationId: ORG_ID } });
  const medications = await prisma.medicationPrescription.count({ where: { organizationId: ORG_ID } });
  const imaging = await prisma.imagingStudy.count({ where: { organizationId: ORG_ID } });
  const reports = await prisma.report.count({ where: { organizationId: ORG_ID } });
  const consents = await prisma.consentRecord.count({ where: { organizationId: ORG_ID } });

  console.log('\n[Seed] ✅ Complete! Summary:');
  console.log(`  Patients:       ${patients}`);
  console.log(`  Consultations:  ${consultations}`);
  console.log(`  Surgeries:      ${surgeries}`);
  console.log(`  Clinical Scales: ${scales}`);
  console.log(`  Medications:    ${medications}`);
  console.log(`  Imaging Studies: ${imaging}`);
  console.log(`  Reports:        ${reports}`);
  console.log(`  Consents:       ${consents}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
