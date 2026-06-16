# 04-design-spec.md

## MediCore — Especificación de Diseño

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisitos:** `01-architecture.md`, `03-business-rules.md` aprobados

---

## Índice

1. [Filosofía de Diseño](#1-filosofía-de-diseño)
2. [Sistema de Tokens](#2-sistema-de-tokens)
3. [Tipografía](#3-tipografía)
4. [Iconografía y Señalética Clínica](#4-iconografía-y-señalética-clínica)
5. [Componentes Base](#5-componentes-base)
6. [Componentes de Dominio Clínico](#6-componentes-de-dominio-clínico)
7. [Formularios Dinámicos por Especialidad](#7-formularios-dinámicos-por-especialidad)
8. [Layout y Navegación](#8-layout-y-navegación)
9. [Wireframes de Flujos Clave](#9-wireframes-de-flujos-clave)
10. [Modo Oscuro y Visor de Imágenes](#10-modo-oscuro-y-visor-de-imágenes)
11. [Estados y Feedback](#11-estados-y-feedback)
12. [Accesibilidad WCAG 2.1 AA](#12-accesibilidad-wcag-21-aa)
13. [Responsive y Dispositivos](#13-responsive-y-dispositivos)

---

## 1. Filosofía de Diseño

MediCore es la herramienta de trabajo de un especialista en un contexto de alta exigencia cognitiva. El médico la usa durante la consulta, mientras el paciente está delante, tomando decisiones clínicas en tiempo real. **Cada segundo de fricción en la interfaz es un segundo robado a la atención al paciente.**

El diseño parte de tres principios que se resuelven como tensiones deliberadas:

**Precisión sin frialdad.** La interfaz debe transmitir rigor clínico — no puede parecer una app de consumo genérica — pero sin la hostilidad visual de los sistemas HIS hospitalarios (grises, tablas densas, jerarquías ininteligibles). La referencia no es la historia clínica en papel: es el cuaderno de notas de un especialista que sabe exactamente qué necesita escribir.

**Densidad navegable.** Los datos clínicos son inherentemente densos. La solución no es ocultarlos con accordions y tabs infinitos, sino diseñar una jerarquía visual donde el ojo del médico llegue al dato correcto en menos de dos segundos. La densidad es una característica, no un problema a resolver.

**Firma visual única: el sistema de estado clínico.** La única decisión formal arriesgada de MediCore es su uso del color como señalética clínica — no como decoración. Un sistema de colores funcional estricto donde cada tono tiene un significado inequívoco: alerta, activo, completado, borrador. Este sistema se mantiene consistente en todos los módulos y es el elemento que hace que la interfaz sea inmediatamente reconocible.

---

## 2. Sistema de Tokens

### Paleta de color

La paleta está construida sobre un azul-pizarra profundo como color de identidad — ni el azul corporativo genérico ni el verde hospitalario tópico — combinado con un blanco roto cálido para los fondos y un ámbar de alta precisión como acento de alerta.

```css
:root {
  /* ── BRAND ── */
  --color-brand-900: #0f1f2e; /* Azul pizarra profundo — identidad primaria */
  --color-brand-800: #162840;
  --color-brand-700: #1e3a57;
  --color-brand-600: #2a5580; /* Interactivo principal (botones, links) */
  --color-brand-500: #3b72a8;
  --color-brand-400: #5d94c6;
  --color-brand-200: #b8d4ea;
  --color-brand-100: #e3eef6;
  --color-brand-50: #f2f7fb; /* Fondos de superficie activa */

  /* ── NEUTRALES ── */
  --color-neutral-950: #0a0f14;
  --color-neutral-900: #111827;
  --color-neutral-800: #1f2937;
  --color-neutral-700: #374151;
  --color-neutral-600: #4b5563;
  --color-neutral-500: #6b7280;
  --color-neutral-400: #9ca3af;
  --color-neutral-300: #d1d5db;
  --color-neutral-200: #e5e7eb;
  --color-neutral-100: #f3f4f6;
  --color-neutral-50: #f9fafb; /* Fondo base de la app */
  --color-white: #ffffff;

  /* ── SEÑALÉTICA CLÍNICA (uso semántico estricto, nunca decorativo) ── */
  --color-status-critical: #c0392b; /* Alergia anafilaxia, alerta urgente */
  --color-status-critical-bg: #fef2f0;
  --color-status-warning: #c07a12; /* Alerta moderada, pendiente de revisión */
  --color-status-warning-bg: #fef9ec;
  --color-status-active: #1a7a4a; /* Medicación activa, cirugía programada */
  --color-status-active-bg: #edfaf2;
  --color-status-draft: #5b6b7a; /* Informe en borrador */
  --color-status-draft-bg: #f0f3f5;
  --color-status-signed: #2a5580; /* Informe firmado (brand profundo) */
  --color-status-signed-bg: #e3eef6;
  --color-status-completed: #1a7a4a; /* Cirugía completada */
  --color-status-cancelled: #9ca3af; /* Cancelado / inactivo */

  /* ── SUPERFICIES ── */
  --surface-base: var(--color-neutral-50);
  --surface-card: var(--color-white);
  --surface-sidebar: var(--color-brand-900);
  --surface-header: var(--color-white);
  --surface-overlay: rgba(15, 31, 46, 0.6);

  /* ── BORDES ── */
  --border-default: var(--color-neutral-200);
  --border-strong: var(--color-neutral-300);
  --border-focus: var(--color-brand-600);

  /* ── SOMBRAS ── */
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-dropdown: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.2);

  /* ── RADIOS ── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* ── ESPACIADO (escala 4px) ── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* ── TRANSICIONES ── */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

### Modo oscuro (ver sección 10)

El modo oscuro solo está disponible cuando el médico activa el visor de imágenes — no es un modo global de la app. Esta decisión es deliberada: los datos clínicos en texto (formularios, informes, escalas) son más fáciles de leer y rellenar en modo claro, mientras que las imágenes médicas requieren modo oscuro para calibración perceptual correcta.

---

## 3. Tipografía

La elección tipográfica tiene un criterio clínico: legibilidad en condiciones de fatiga visual, en pantallas de calidad variable de consulta, con datos médicos que incluyen números, abreviaturas y terminología técnica.

```css
/* ── FUENTES ── */
/* Display / Headers: DM Sans — geométrica, humanista, sin la frialdad de Inter */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

/* Body / Datos: Inter — máxima legibilidad en densidades altas, excelente en tablas */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

/* Datos numéricos / Códigos (CIE-10, NHC, dosis): JetBrains Mono */
/* Uso tabular de números — las cifras ocupan el mismo ancho */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-display: 'DM Sans', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### Escala tipográfica

```
Nombre        Fuente       Tamaño   Peso    Uso
──────────────────────────────────────────────────────────────────
display-lg    DM Sans      28px     700     Títulos de página
display-md    DM Sans      22px     600     Nombre del paciente
display-sm    DM Sans      18px     600     Título de sección
body-lg       Inter        16px     400     Texto de consulta, informes
body-md       Inter        14px     400     Texto de formulario (uso primario)
body-sm       Inter        13px     400     Metadatos, fechas, labels
caption       Inter        12px     400     Notas secundarias, timestamps
label         Inter        12px     500     Etiquetas de campo (uppercase 0.4px)
code-md       JB Mono      14px     400     Códigos CIE-10, NHC, dosis
code-sm       JB Mono      12px     400     IDs, hashes, datos técnicos
```

**Regla de densidad:** En formularios clínicos el tamaño de texto base es `body-md` (14px), no 16px. Los médicos trabajan con formularios densos y el tamaño mayor crea demasiado scrolling. En informes y texto libre, `body-lg` (16px) para lectura cómoda.

---

## 4. Iconografía y Señalética Clínica

**Librería base:** [Lucide Icons](https://lucide.dev) — trazos consistentes de 1.5px, estilo outline. No se mezclan iconos de otras librerías.

**Iconos clínicos especializados** (los que no existen en Lucide): se diseñan como SVGs a medida siguiendo el mismo estilo (1.5px stroke, 24x24 viewBox).

### Iconos por módulo

```
Módulo          Icono Lucide          Notas
─────────────────────────────────────────────────────────
Pacientes       Users                 Sidebar y breadcrumb
Nueva consulta  ClipboardPlus
Cirugía         Scalpel               Custom SVG
Imágenes        ScanLine              (representa DICOM/escáner)
Medicación      Pill
Escalas         BarChart2
Informes        FileText
Analytics       TrendingUp
Ajustes         Settings
Alerta crítica  AlertTriangle         Siempre --color-status-critical
Alerta moderada Info                  --color-status-warning
Firma           PenLine
DRAFT           FileDashed            Custom SVG (líneas discontinuas)
SIGNED          FileCheck
Alergia         ShieldAlert
```

### Badges de estado clínico

Los badges son el componente de señalética más crítico. Reglas:

- Tamaño fijo: `height: 20px`, `padding: 0 6px`, `border-radius: var(--radius-full)`
- Fuente: `caption` weight 500
- **Un badge = un color = un significado.** No existen variaciones de tono del mismo significado.
- El color de fondo es siempre el `*-bg` del token, el texto es siempre el token `*` sin `-bg`

```
Badge           Color texto              Color fondo
─────────────────────────────────────────────────────
DRAFT           --status-draft           --status-draft-bg
REVISADO        --status-warning         --status-warning-bg
FIRMADO         --status-signed          --status-signed-bg
ACTIVO          --status-active          --status-active-bg
PROGRAMADA      --status-active          --status-active-bg
COMPLETADA      --status-completed       --status-completed-bg
CANCELADA       --status-cancelled       neutral-100
ANAPHYLAXIS     --status-critical        --status-critical-bg
```

---

## 5. Componentes Base

Todos los componentes base son de [shadcn/ui](https://ui.shadcn.com) con las customizaciones definidas en esta sección. El principio es: **customizar tokens, no reimplementar componentes**.

### PatientSearchBar

El componente de búsqueda de pacientes es el más utilizado de la app. Aparece en el header en todas las vistas de dashboard.

```
┌─────────────────────────────────────────────────────┐
│  🔍  Buscar paciente por nombre, NHC o DNI...    ⌘K │
└─────────────────────────────────────────────────────┘

Al activar (⌘K o clic):
┌─────────────────────────────────────────────────────┐
│  🔍  García                                          │
├─────────────────────────────────────────────────────┤
│  👤  García López, Ana       NHC 2026-00034    42a  │
│  👤  García Martín, Pedro    NHC 2026-00012    67a  │
│  👤  García García, Luis     NHC 2026-00089    31a  │
├─────────────────────────────────────────────────────┤
│  ○ Crear paciente "García"...                        │
└─────────────────────────────────────────────────────┘
```

- Debounce de 200ms sobre la query
- Búsqueda sobre: `lastName`, `firstName`, `nhc`, `idDocument`
- Máximo 5 resultados en el dropdown
- Atajo de teclado global: `⌘K` (Mac) / `Ctrl+K` (Win)
- Si no hay resultados: opción de crear paciente nuevo con el término de búsqueda pre-rellenado

### ClinicalBanner (alerta de alergia)

Componente de alerta que aparece en la parte superior de todas las vistas de un paciente con alergias de severidad `ANAPHYLAXIS`.

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠  ALERGIA GRAVE: Penicilina (Anafilaxia) · Látex (Anafilaxia)  │
└─────────────────────────────────────────────────────────────────┘
```

- `background: var(--color-status-critical-bg)`
- `border-left: 4px solid var(--color-status-critical)`
- No tiene botón de cierre — no se puede ocultar (BR-PAT-006)
- `position: sticky; top: 0` — siempre visible al hacer scroll

### StatusBadge

```tsx
<StatusBadge status="SIGNED" />     // → badge "FIRMADO"
<StatusBadge status="DRAFT" />      // → badge "BORRADOR"
<StatusBadge status="SCHEDULED" />  // → badge "PROGRAMADA"
```

### DiagnosisCodePicker

Buscador de códigos CIE-10 y SNOMED con búsqueda full-text.

```
┌─────────────────────────────────────────────────────┐
│  Añadir diagnóstico...                               │
└─────────────────────────────────────────────────────┘
                        ↓ (escribir "rinitis")
┌─────────────────────────────────────────────────────┐
│  🔍  rinitis                                         │
├──────────────┬──────────────────────────────────────┤
│  J30.0       │  Rinitis alérgica debida al polen     │
│  J30.1       │  Rinitis alérgica debida a animales   │
│  J30.4       │  Rinitis alérgica, no especificada    │
│  J31.0       │  Rinitis crónica                      │
├──────────────┴──────────────────────────────────────┤
│  Sistema: ● CIE-10  ○ SNOMED CT                     │
└─────────────────────────────────────────────────────┘
```

- Búsqueda client-side sobre el catálogo precargado
- Muestra el código en `font-mono` y la descripción en `font-body`
- Selector de sistema (CIE-10 / SNOMED) con memoria por sesión
- Al seleccionar, se añade como chip editable en el formulario

---

## 6. Componentes de Dominio Clínico

### PatientHeader

Presente en todas las vistas de paciente. Contiene la información de identificación crítica que el médico necesita en todo momento sin navegar.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Ana García López                            NHC 2026-00034         │
│  42 años · Femenino · Grupo 0+               DNI 12345678X          │
│                                                                     │
│  ⚠ ALERGIA GRAVE: Penicilina, Látex          [Ver ficha completa ↗] │
│                                                                     │
│  [Consultas 12]  [Cirugías 2]  [Imágenes 8]  [Medicación]  [Informes]│
└─────────────────────────────────────────────────────────────────────┘
```

- El banner de alerta solo aparece si hay alergias `ANAPHYLAXIS` activas
- Los tabs muestran el conteo de registros de cada módulo
- La barra es `sticky` — siempre visible al hacer scroll en la ficha del paciente

### ClinicalTimeline

Vista cronológica de todos los eventos clínicos de un paciente. Es la vista más usada después del formulario de consulta.

```
LÍNEA DE TIEMPO — Ana García López

  2026
  │
  ● Jun 05  CONSULTA    Revisión 3 meses post-cirugía      [FIRMADO ↗]
  │         Dr. Martínez · Rinosinusitis crónica (J32.9)
  │
  ● May 12  IMAGEN      TAC senos paranasales              [Ver ↗]
  │
  ● Mar 20  CIRUGÍA     Septoplastia + CENS bilateral       [COMPLETADA ↗]
  │         Dr. Martínez · 95 min · ASA I
  │
  ● Mar 15  CONSULTA    Pre-operatoria                     [FIRMADO ↗]
  │
  2025
  │
  ● Nov 10  ESCALA      SNOT-22: 68/110 (severo)
  │
  ● Nov 10  CONSULTA    Primera visita                     [FIRMADO ↗]
              Dr. Martínez · Rinosinusitis crónica + Desviación septal
```

- Los eventos se agrupan por año con separador visual
- Cada evento tiene icono de tipo, fecha, descripción breve y badge de estado
- El color del punto de la línea corresponde al estado del evento
- Clic en cualquier evento navega al detalle del registro

### ScoreEvolutionChart

Gráfica de evolución de una escala clínica a lo largo del tiempo para un paciente. Usa Recharts.

```
  SNOT-22 — Evolución  [últimos 12 meses ▾]

  110 │
      │
   68 │●                                          Severo (>40)
      │  ╲
   45 │   ●                                       Moderado (20-40)
      │     ╲
   22 │       ●                                   Leve (<20)
      │         ╲
    8 │           ●──●
      └────────────────────────────────────────
     Nov    Ene    Mar    May    Jun
     2025   2026
```

- Líneas de referencia para rangos de severidad de la escala
- Tooltip con fecha y puntuación al hover
- Color de la línea varía por zona de severidad (rojo → amarillo → verde)

---

## 7. Formularios Dinámicos por Especialidad

Esta es la decisión de diseño más importante del sistema y la que habilita la escalabilidad a múltiples especialidades.

### Principio

Los formularios clínicos (exploración física, técnica quirúrgica, escalas) **no están codificados en el frontend**. Son configuraciones JSON almacenadas en `Organization.settings` que el sistema de formularios dinámicos renderiza en tiempo de ejecución.

Esto permite:

- Añadir una nueva especialidad sin tocar código
- Personalizar formularios por médico u organización
- Versionar las plantillas de formulario independientemente del código

### Motor de formularios dinámicos

```typescript
// packages/contracts/src/form-schema.ts

// Definición de un campo de formulario
const FormFieldSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    id: z.string(),
    label: z.string(),
    placeholder: z.string().optional(),
    required: z.boolean().default(false),
    multiline: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('select'),
    id: z.string(),
    label: z.string(),
    options: z.array(z.object({ value: z.string(), label: z.string() })),
    required: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('scale'),
    id: z.string(),
    label: z.string(),
    min: z.number(),
    max: z.number(),
    step: z.number().default(1),
    showLabels: z.boolean().default(true),
  }),
  z.object({
    type: z.literal('checkbox'),
    id: z.string(),
    label: z.string(),
    options: z.array(z.object({ value: z.string(), label: z.string() })),
  }),
  z.object({
    type: z.literal('section'), // Separador visual con título
    id: z.string(),
    title: z.string(),
    collapsible: z.boolean().default(true),
  }),
]);

// Plantilla de formulario completa
const FormTemplateSchema = z.object({
  id: z.string(),
  name: z.string(), // "Exploración ORL estándar"
  specialty: z.string(), // "ORL" | "Traumatología" | ...
  version: z.string(), // "1.0.0"
  fields: z.array(FormFieldSchema),
});
```

### Plantilla de exploración ORL inicial (ejemplo)

```json
{
  "id": "orl-physical-exam-v1",
  "name": "Exploración ORL",
  "specialty": "ORL",
  "version": "1.0.0",
  "fields": [
    { "type": "section", "id": "s-ear", "title": "Oídos", "collapsible": true },
    {
      "type": "select",
      "id": "otoscopy_right_membrane",
      "label": "Membrana timpánica derecha",
      "options": [
        { "value": "intact", "label": "Íntegra" },
        { "value": "retracted", "label": "Retraída" },
        { "value": "perforated", "label": "Perforada" },
        { "value": "not_visible", "label": "No visible" }
      ]
    },
    {
      "type": "text",
      "id": "otoscopy_right_notes",
      "label": "Notas oído derecho",
      "multiline": true
    },
    {
      "type": "select",
      "id": "otoscopy_left_membrane",
      "label": "Membrana timpánica izquierda",
      "options": ["Íntegra", "Retraída", "Perforada", "No visible"]
    },
    {
      "type": "text",
      "id": "otoscopy_left_notes",
      "label": "Notas oído izquierdo",
      "multiline": true
    },

    {
      "type": "section",
      "id": "s-nose",
      "title": "Nariz y senos paranasales",
      "collapsible": true
    },
    {
      "type": "select",
      "id": "septum",
      "label": "Tabique nasal",
      "options": ["Centrado", "Desviado derecha", "Desviado izquierda", "Irregular"]
    },
    { "type": "text", "id": "rhinoscopy_notes", "label": "Rinoscopia", "multiline": true },

    { "type": "section", "id": "s-throat", "title": "Orofaringe", "collapsible": true },
    {
      "type": "select",
      "id": "tonsils",
      "label": "Amígdalas",
      "options": ["Normales", "Grado I", "Grado II", "Grado III", "Grado IV", "Ausentes"]
    },
    { "type": "text", "id": "oropharynx_notes", "label": "Notas orofaringe", "multiline": true },

    { "type": "section", "id": "s-larynx", "title": "Laringe", "collapsible": true },
    { "type": "text", "id": "laryngoscopy_notes", "label": "Laringoscopia", "multiline": true },

    { "type": "section", "id": "s-neck", "title": "Cuello", "collapsible": true },
    {
      "type": "select",
      "id": "lymph_nodes",
      "label": "Adenopatías",
      "options": [
        "No palpables",
        "Submandibular",
        "Cervical anterior",
        "Cervical posterior",
        "Múltiples"
      ]
    },
    { "type": "text", "id": "neck_notes", "label": "Notas cuello", "multiline": true }
  ]
}
```

Esta plantilla es el punto de partida. El médico puede editarla desde Ajustes → Formularios, añadir o quitar campos, y crear variantes (ej: "Exploración ORL pediátrica").

---

## 8. Layout y Navegación

### Estructura general (desktop)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER (64px)                                                               │
│  [≡ MediCore]    [🔍 Buscar paciente...  ⌘K]    [⚙]  [Avatar Dr. Martínez] │
├──────────┬──────────────────────────────────────────────────────────────────┤
│          │ CONTENT AREA                                                     │
│ SIDEBAR  │                                                                  │
│ (240px)  │  ┌────────────────────────────────────────────────────────────┐  │
│          │  │  Breadcrumb: Pacientes > Ana García López > Consultas      │  │
│ 👥 Pacs  │  └────────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│ 📋 Hoy   │  [PatientHeader — sticky]                                        │
│          │                                                                  │
│ 📊 Anal. │  [Contenido del módulo activo]                                   │
│          │                                                                  │
│ ─────    │                                                                  │
│          │                                                                  │
│ ⚙ Ajust. │                                                                  │
│          │                                                                  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

### Sidebar

- Fondo: `--surface-sidebar` (azul pizarra profundo `#0F1F2E`)
- Iconos y texto: blanco al 70% en reposo, blanco al 100% en activo
- Item activo: fondo `rgba(255,255,255,0.08)`, borde izquierdo `3px solid white`
- Ancho colapsable a 64px (solo iconos) con `⌘B`
- Sin submenús — la navegación secundaria es siempre horizontal dentro del contenido

### Navegación secundaria (tabs de paciente)

Los tabs de la ficha del paciente son el segundo nivel de navegación más usado. Están en el `PatientHeader`:

```
[Historial]  [Consultas 12]  [Cirugías 2]  [Imágenes 8]
[Medicación 3]  [Escalas]  [Informes 5]
```

- Los tabs con conteo muestran el número de registros activos (no borrados)
- El tab activo tiene `border-bottom: 2px solid var(--color-brand-600)`
- En tablet los tabs se convierten en un dropdown si no caben

---

## 9. Wireframes de Flujos Clave

### F01 — Nueva Consulta (flujo principal)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Ana García López — NHC 2026-00034 — 42a · F  ⚠ Alergia: Penicilina       │
│  [Historial] [Consultas 12] [Cirugías 2] [Imágenes 8] [Medicación] ...     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ＋ Nueva consulta                                                           │
│                                                                             │
│  Fecha ─────────  Tipo ──────────────────  Médico ──────────────────────   │
│  [ 09/06/2026 ]   [ Revisión          ▾]   [ Dr. Carlos Martínez     ]     │
│                                                                             │
│  ┌──── Motivo de consulta ─────────────────────────────────────────────┐   │
│  │  Revisión a los 3 meses de la septoplastia. El paciente refiere...   │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──── Exploración física ▾ ──────────────────────────────────────────┐   │
│  │  [Formulario dinámico ORL — secciones colapsables por área]         │   │
│  │                                                                     │   │
│  │  Oídos ────────────────────────────────────────────────── [▾]      │   │
│  │    Membrana timpánica dcha: [Íntegra          ▾]                    │   │
│  │    Membrana timpánica izq:  [Íntegra          ▾]                    │   │
│  │    Notas: ___________________________________________________       │   │
│  │                                                                     │   │
│  │  Nariz ─────────────────────────────────────────────────── [▾]     │   │
│  │    Tabique: [Centrado             ▾]                                │   │
│  │    Rinoscopia: ______________________________________________       │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──── Diagnóstico ────────────────────────────────────────────────────┐   │
│  │  Impresión: ___________________________________________________     │   │
│  │                                                                     │   │
│  │  Códigos:  [+ Añadir diagnóstico CIE-10 / SNOMED]                  │   │
│  │  ╔═══════════╦════════════════════════════════════╦════════╗        │   │
│  │  ║ J32.9     ║ Rinosinusitis crónica, no espec.   ║ PRIM. ║ [×]    │   │
│  │  ╚═══════════╩════════════════════════════════════╩════════╝        │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──── Plan ───────────────────────────────────────────────────────────┐   │
│  │  _________________________________________________________________  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Próxima revisión: [ ── / ── / ────]                                        │
│                                                                             │
│  ☐ Generar informe de consulta automáticamente                              │
│                                                                             │
│                         [Cancelar]  [Guardar consulta ↗]                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### F02 — Revisión y firma de informe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Informe de revisión — Ana García López                [BORRADOR]           │
│  Generado por IA · Revisado por: pendiente                                  │
├───────────────────────────────┬─────────────────────────────────────────────┤
│  EDITOR (izquierda)           │  VISTA PREVIA PDF (derecha)                 │
│                               │                                             │
│  ┌─────────────────────────┐  │  ┌─────────────────────────────────────┐   │
│  │ Informe de Revisión     │  │  │ CLÍNICA ORL — DR. CARLOS MARTÍNEZ   │   │
│  │                         │  │  │ Colegiado nº 28/12345               │   │
│  │ Paciente: Ana García    │  │  │ ─────────────────────────────────   │   │
│  │ Fecha: 09/06/2026       │  │  │                                     │   │
│  │                         │  │  │ INFORME DE REVISIÓN                 │   │
│  │ Motivo: Revisión 3m     │  │  │                                     │   │
│  │ post-septoplastia...    │  │  │ Paciente: García López, Ana         │   │
│  │                         │  │  │ Fecha nacimiento: 12/03/1984        │   │
│  │ Exploración...          │  │  │ NHC: 2026-00034                     │   │
│  │                         │  │  │                                     │   │
│  │ [Campo de texto rico]   │  │  │ [Preview generada en tiempo real]   │   │
│  │                         │  │  │                                     │   │
│  └─────────────────────────┘  │  └─────────────────────────────────────┘   │
│                               │                                             │
│  Diagnósticos:                │                                             │
│  J32.9 — Rinosinusitis crónica│                                             │
│  [+ añadir código]            │                                             │
│                               │                                             │
│  [Marcar como Revisado]  [Firmar informe →]                                 │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### F03 — Dashboard de Analytics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Analytics — Dr. Carlos Martínez            [Último año ▾]  [Exportar CSV] │
├────────────────┬────────────────┬───────────────────────────────────────────┤
│  247           │  38            │  4.2 consultas                            │
│  Pacientes     │  Cirugías      │  por paciente / año                       │
│  activos       │  realizadas    │                                           │
├────────────────┴────────────────┴───────────────────────────────────────────┤
│                                                                             │
│  Top diagnósticos (CIE-10)           Distribución por edad                 │
│  ─────────────────────────           ───────────────────────               │
│  J32.9  Rinosinusitis  ████████ 62   [Gráfica de barras por grupo etario]  │
│  J34.2  Desv. septal   ██████   48                                         │
│  H65.3  OME bilateral  ████     31   Escalas — Evolución media             │
│  J30.4  Rinitis alerg. ████     29   ─────────────────────────             │
│  J35.1  Amígdalas hip. ███      22   SNOT-22 preop: 68  →  postop: 18     │
│  [Ver todos ↓]                       DHI: 52 → 14                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Modo Oscuro y Visor de Imágenes

El modo oscuro se activa exclusivamente al abrir el visor de imágenes médicas. Es una transición deliberada que señala al médico que está en "modo diagnóstico por imagen".

```css
/* Tokens modo oscuro — solo activos dentro de .imaging-viewer-mode */
.imaging-viewer-mode {
  --surface-base: #0a0f14;
  --surface-card: #111827;
  --surface-sidebar: #0a0f14;
  --color-neutral-50: #0a0f14;
  --color-white: #f9fafb;
  --border-default: #374151;

  /* Los tokens de estado clínico NO cambian en modo oscuro */
  /* El significado del color debe ser consistente en ambos modos */
}
```

### Layout del visor de imágenes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Volver a Ana García]   TAC senos paranasales — 15/11/2025   [⤡ fullscreen]│
├──────────┬──────────────────────────────────────────────────┬───────────────┤
│ SERIE    │                                                  │   NOTAS       │
│          │                                                  │               │
│ [img 1]  │                                                  │  Hallazgos:   │
│ [img 2]  │         [CORNERSTONE.JS VIEWER]                  │  ____________ │
│ [img 3]  │                                                  │  ____________ │
│ [img 4]  │         DICOM / Imagen médica                    │               │
│  ...     │                                                  │  [+ Añadir    │
│          │                                                  │   anotación]  │
│ [img N]  │                                                  │               │
├──────────┴──────────────────────────────────────────────────┴───────────────┤
│  WW: [1500]  WL: [400]    [Zoom ─────●──── +]   [← Anterior] [Siguiente →] │
└─────────────────────────────────────────────────────────────────────────────┘
```

- `WW` (Window Width) y `WL` (Window Level) son controles estándar de visualización DICOM
- La transición al modo oscuro es de 300ms con fade
- Al cerrar el visor se vuelve al modo claro con la misma transición

---

## 11. Estados y Feedback

### Skeleton loaders

En lugar de spinners genéricos, cada sección tiene su propio skeleton que imita la forma del contenido real. Esto reduce la percepción de tiempo de carga.

```
PatientHeader skeleton:
████████████████████████     ████████████
██████████  ██████████       ████████████

ClinicalTimeline skeleton:
● ──────────────  ████████████████████
● ──────────────  ████████████████████
● ──────────────  ████████████████████
```

### Toasts (notificaciones)

Posición: `bottom-right`. Duración: 4 segundos. Sin apilamiento de más de 3.

```
┌───────────────────────────────────┐
│  ✓  Consulta guardada             │  ← success (borde verde)
└───────────────────────────────────┘

┌───────────────────────────────────┐
│  ⚠  Informe generado con alertas  │  ← warning (borde ámbar)
│     Revisa los diagnósticos       │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│  Generando informe...         [×] │  ← progress (borde brand, persistente)
└───────────────────────────────────┘
```

### Estados vacíos (empty states)

Los empty states son momentos de orientación, no decorativos. Cada módulo tiene su propio mensaje directo.

```
[Icono del módulo]

No hay consultas registradas
para este paciente.

[+ Nueva consulta]
```

Nunca: _"¡Ups! Parece que no hay nada aquí todavía."_ — ese tono no encaja con el contexto clínico.

### Confirmación de acciones destructivas

```
┌──────────────────────────────────────────────────────────┐
│  ¿Eliminar esta consulta?                                │
│                                                          │
│  Esta acción archivará la consulta del 09/06/2026.      │
│  Los datos se conservarán por el período legal          │
│  (10 años) pero no serán visibles en la interfaz.       │
│                                                          │
│                      [Cancelar]  [Eliminar consulta]    │
└──────────────────────────────────────────────────────────┘
```

- "Eliminar" siempre es el botón de la derecha, con `background: var(--color-status-critical)`
- El modal describe exactamente qué ocurre — sin ambigüedad
- Los modales de confirmación de firma de informe incluyen el disclaimer legal completo

---

## 12. Accesibilidad WCAG 2.1 AA

### Contraste de color

| Combinación                                      | Ratio  | Cumplimiento |
| ------------------------------------------------ | ------ | ------------ |
| Texto body sobre `--surface-card`                | 12.5:1 | AAA          |
| Texto label sobre `--surface-base`               | 7.8:1  | AAA          |
| Blanco sobre `--color-brand-600`                 | 4.6:1  | AA           |
| `--status-critical` sobre `--status-critical-bg` | 5.2:1  | AA           |
| `--status-active` sobre `--status-active-bg`     | 4.8:1  | AA           |

### Navegación por teclado

- Todos los elementos interactivos son alcanzables con `Tab`
- El orden de foco sigue el flujo visual del formulario
- `Escape` cierra cualquier modal o dropdown activo
- Los formularios de consulta tienen atajos: `Ctrl+S` para guardar, `Ctrl+Enter` para guardar y generar informe

### Screen readers

- Todos los iconos decorativos tienen `aria-hidden="true"`
- Los iconos con función tienen `aria-label` descriptivo
- Los badges de estado tienen `role="status"` y texto visible (no solo color)
- Los campos de formulario tienen `aria-describedby` apuntando a su texto de ayuda

### Movimiento reducido

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 13. Responsive y Dispositivos

### Breakpoints

```
mobile:   < 640px   (fuera de scope del MVP — app desktop-first)
tablet:   640px – 1024px  (consulta con iPad — soporte prioritario)
desktop:  > 1024px  (uso principal)
wide:     > 1440px  (monitores de consulta — layout expandido)
```

### Adaptación en tablet (640px – 1024px)

La app debe funcionar en una tablet en la consulta. Ajustes específicos:

- Sidebar colapsa automáticamente a iconos (64px) en tablet
- `PatientHeader` comprime los datos en dos líneas
- Los tabs de navegación del paciente se convierten en dropdown si hay más de 4
- El formulario de consulta ocupa el ancho completo en una sola columna
- El visor de imágenes se adapta a pantalla completa en tablet

### Lo que NO está en scope del MVP

- Aplicación nativa móvil
- Modo offline / PWA
- Impresión directa desde el navegador (se usa el PDF generado)

---
