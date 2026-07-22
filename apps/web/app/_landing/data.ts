// Static copy + feature metadata for the marketing landing page.
// All copy is Spanish neutral, professional, clinical-adjacent per docs/04-design-spec.md.
// Icons reference keys resolved to inline SVGs in FeaturesSection (Lucide-style, 1.5px stroke).

export const HERO = {
  headline: 'Gestión clínica que piensa como un especialista',
  subhead:
    'Historias clínicas, consultas, cirugías e informes firmados en un único sistema. Diseñado para la consulta de alta exigencia cognitiva.',
  primaryCtaLabel: 'Empieza gratis',
} as const;

export const FEATURES: ReadonlyArray<{ icon: FeatureIcon; title: string; body: string }> = [
  {
    icon: 'Users',
    title: 'Gestión de pacientes',
    body: 'Historias clínicas centralizadas, escalas clínicas y una línea de tiempo con todos los eventos del paciente en una sola vista.',
  },
  {
    icon: 'ClipboardPlus',
    title: 'Consultas dinámicas',
    body: 'Formularios configurables por especialidad que se adaptan a cada tipo de consulta, sin tocar el código ni perder la estructura clínica.',
  },
  {
    icon: 'FileCheck',
    title: 'Informes firmados',
    body: 'Genera, revisa y firma informes clínicos con trazabilidad legal completa y exportación a PDF lista para archivar.',
  },
];

export const CTA_SECTION = {
  heading: 'Empieza a trabajar con tus pacientes hoy',
  subhead: 'Acceso inmediato. Sin configuración compleja.',
  primaryLabel: 'Crear cuenta',
  secondaryLabel: 'Iniciar sesión',
} as const;

export const FOOTER = {
  brand: 'MediCore',
  privacyPolicyHref: 'https://www.privacypolicies.com/live/ab4f55aa-8ebe-46ca-b984-e4ce21ad7f45',
  privacyPolicyLabel: 'Política de privacidad',
} as const;

export type FeatureIcon = 'Users' | 'ClipboardPlus' | 'FileCheck';