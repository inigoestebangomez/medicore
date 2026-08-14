export const ORL_ANATOMY_ZONES = {
  // OÍDO
  ear_external_right:   { label: 'Oído externo derecho',   codes: ['H60', 'H61', 'H62'] },
  ear_external_left:    { label: 'Oído externo izquierdo', codes: ['H60', 'H61', 'H62'] },
  ear_middle_right:     { label: 'Oído medio derecho',     codes: ['H65', 'H66', 'H70', 'H71', 'H72', 'H73', 'H74'] },
  ear_middle_left:      { label: 'Oído medio izquierdo',   codes: ['H65', 'H66', 'H70', 'H71', 'H72', 'H73', 'H74'] },
  ear_inner_right:      { label: 'Oído interno derecho',   codes: ['H80', 'H81', 'H83', 'H90', 'H91', 'H93'] },
  ear_inner_left:       { label: 'Oído interno izquierdo', codes: ['H80', 'H81', 'H83', 'H90', 'H91', 'H93'] },

  // NARIZ Y SENOS
  nasal_septum:         { label: 'Tabique nasal',          codes: ['J34.2'] },
  nasal_turbinates:     { label: 'Cornetes nasales',       codes: ['J34.3'] },
  sinus_maxillary:      { label: 'Senos maxilares',        codes: ['J32.0'] },
  sinus_frontal:        { label: 'Senos frontales',        codes: ['J32.1'] },
  sinus_ethmoid:        { label: 'Senos etmoidales',       codes: ['J32.2'] },
  sinus_sphenoid:       { label: 'Seno esfenoidal',        codes: ['J32.3'] },

  // FARINGE Y LARINGE
  nasopharynx:          { label: 'Nasofaringe',            codes: ['J39', 'C11'] },
  oropharynx:           { label: 'Orofaringe',             codes: ['J35', 'J36', 'C10'] },
  tonsils:              { label: 'Amígdalas',              codes: ['J35.0', 'J35.1', 'J35.3'] },
  larynx:               { label: 'Laringe',                codes: ['J38', 'J04', 'C32'] },
  vocal_cords:          { label: 'Cuerdas vocales',        codes: ['J38.0', 'J38.1', 'J38.2', 'J38.3'] },

  // CUELLO
  thyroid:              { label: 'Tiroides',               codes: ['E00', 'E01', 'E02', 'E03', 'E04', 'C73'] },
  salivary_parotid:     { label: 'Parótida',               codes: ['K11', 'C07'] },
  salivary_submandibular: { label: 'Glándula submandibular', codes: ['K11', 'C08'] },
  lymph_nodes_cervical: { label: 'Adenopatías cervicales', codes: ['R59', 'C77.0'] },
} as const;

export type AnatomyZoneKey = keyof typeof ORL_ANATOMY_ZONES;

export interface DiagnosisCode {
  code: string;
}

export function getActiveZones(diagnosisCodes: DiagnosisCode[]): AnatomyZoneKey[] {
  const codes = diagnosisCodes.map(d => d.code);
  return (Object.entries(ORL_ANATOMY_ZONES) as [AnatomyZoneKey, typeof ORL_ANATOMY_ZONES[AnatomyZoneKey]][])
    .filter(([_, zone]) =>
      zone.codes.some(zoneCode =>
        codes.some(code => code.startsWith(zoneCode))
      )
    )
    .map(([zoneKey]) => zoneKey);
}