# 14-visual-design-spec.md
## MediCore — Diseño Visual y Estilo

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisito:** `04-design-spec.md` aprobado (este documento lo supersede en todo lo visual)
> **Referencia:** Estándares de diseño de producto 2026 — glassmorphism estructural,
> spatial computing influence, micro-interacciones con propósito clínico.

---

## Índice

1. [Manifiesto Visual](#1-manifiesto-visual)
2. [Estructura de Layout — Rompiendo el Sidebar](#2-estructura-de-layout--rompiendo-el-sidebar)
3. [Sistema de Color](#3-sistema-de-color)
4. [Tipografía](#4-tipografía)
5. [El Modelo 3D Anatómico ORL](#5-el-modelo-3d-anatómico-orl)
6. [Glassmorphism Clínico — El Lenguaje Visual](#6-glassmorphism-clínico--el-lenguaje-visual)
7. [Sistema de Motion y Micro-interacciones](#7-sistema-de-motion-y-micro-interacciones)
8. [Tokens CSS Completos](#8-tokens-css-completos)
9. [Vistas y Composiciones](#9-vistas-y-composiciones)
10. [Componentes con Carácter Propio](#10-componentes-con-carácter-propio)
11. [El Visor de Imágenes — Contexto Inmersivo](#11-el-visor-de-imágenes--contexto-inmersivo)
12. [Dashboard de Analytics — Densidad con Belleza](#12-dashboard-de-analytics--densidad-con-belleza)
13. [Modo Oscuro Estructural](#13-modo-oscuro-estructural)
14. [Implementación con Tailwind + shadcn/ui](#14-implementación-con-tailwind--shadcnui)

---

## 1. Manifiesto Visual

MediCore no es un SaaS B2B genérico. Es la herramienta diaria de un profesional de altísima formación que pasa 8 horas mirando esta interfaz. Tiene que ser digna de ese uso.

**Tres decisiones de diseño que nos diferencian de todo lo que existe:**

La primera: **navegación horizontal superior en lugar de sidebar vertical**. El sidebar izquierdo con logo arriba es el patrón de 2018. En 2026 la pantalla es ancha, el contenido clínico es denso, y el espacio horizontal es el recurso más valioso. La navegación va arriba, como en los mejores productos de diseño actuales — Linear, Vercel, Figma, Arc Browser.

La segunda: **el modelo 3D anatómico ORL como protagonista de la ficha del paciente**. No como decoración — como herramienta clínica. La cabeza y cuello en tres dimensiones, con los focos de patología del paciente iluminados en tiempo real. El médico ve de un vistazo dónde están los problemas de este paciente antes de leer una sola línea.

La tercera: **glassmorphism estructural, no decorativo**. No el glassmorphism de 2021 con demasiado blur y bordes brillantes. Glassmorphism como sistema de jerarquía visual: los elementos primarios son sólidos, los secundarios son translúcidos, los terciarios son casi transparentes. La profundidad comunica importancia.

---

## 2. Estructura de Layout — Rompiendo el Sidebar

### La navegación horizontal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR (56px)                                                              │
│  ╔════════╗  Pacientes · Cirugías · Imágenes · Investigación · Analytics   │
│  ║ M CORE ║                                        ⌘K [Buscar...]   🔔  👤 │
│  ╚════════╝                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONTENT AREA — ocupa el 100% del ancho disponible                         │
│                                                                             │
│  (sin sidebar — el espacio lateral es contenido clínico)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

El logo **MediCore** en la topbar no es el típico logo + nombre. Es un **logotipo condensado** — las letras `MC` en una forma geométrica que funciona como monograma. A su derecha, los ítems de navegación principal como pestañas planas sin subrayado activo visible — el ítem activo cambia solo de peso tipográfico y color. Sin iconos en la nav principal (los iconos son para móvil, no para desktop profesional).

### La context bar — debajo del topbar cuando hay un paciente activo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  PATIENT CONTEXT BAR (48px) — solo visible cuando hay paciente activo      │
│  ← Pacientes   /   Elena Rodríguez, 45a · NHC 2026-00034                  │
│  [Consultas 12] [Cirugías 2] [Imágenes 8] [Medicación] [Informes] [...]   │
│                                        [Generar informe] [Nueva consulta]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  CONTENT                                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

Esta segunda barra es el contexto del paciente activo. Aparece y desaparece con una transición suave. Cuando no hay paciente activo, el content area empieza directamente bajo el topbar.

### Grid del content area

```css
/* El content area usa un grid de 12 columnas con columnas de contexto fijas */

.content-grid {
  display: grid;
  grid-template-columns:
    1fr          /* columna de contexto izquierda (modelo 3D, info del paciente) */
    2fr          /* columna central (timeline, formularios, contenido principal) */
    1fr;         /* columna derecha (medicación, alertas, acciones rápidas) */
  gap: var(--space-6);
  padding: var(--space-6) var(--space-8);
  max-width: 1600px;
  margin: 0 auto;
}

/* En la vista de lista de pacientes: 1 sola columna full-width */
/* En el visor de imágenes: layout diferente (ver sección 11) */
/* En analytics: 2 columnas */
```

---

## 3. Sistema de Color

### La paleta — lejos del azul corporativo

MediCore usa **Slate profundo + Aqua médico + Ámbar de precisión**. La referencia conceptual es la iluminación de una sala de operaciones: luz fría y precisa, fondos neutros profundos, acentos de alta visibilidad.

```css
:root {
  /* ── FONDOS — tres capas de profundidad ── */
  --bg-base:        #0D1117;   /* Fondo global — casi negro azulado, no negro puro */
  --bg-elevated:    #161B22;   /* Cards, paneles — ligeramente más claro */
  --bg-overlay:     #1C2128;   /* Dropdowns, modales — la capa más alta */
  --bg-subtle:      #21262D;   /* Hover states, separadores */

  /* ── SUPERFICIES GLASS — el lenguaje visual principal ── */
  --glass-primary:   rgba(255, 255, 255, 0.06);   /* Cards principales */
  --glass-secondary: rgba(255, 255, 255, 0.03);   /* Cards secundarias */
  --glass-hover:     rgba(255, 255, 255, 0.09);   /* Hover sobre glass */
  --glass-border:    rgba(255, 255, 255, 0.08);   /* Bordes de glass */
  --glass-border-strong: rgba(255, 255, 255, 0.14);

  /* ── AQUA MÉDICO — el color de identidad ── */
  /* No es el azul de todos los SaaS. Es un aqua frío con presencia propia */
  --aqua-950:  #011A1F;
  --aqua-900:  #022D35;
  --aqua-800:  #044B5A;
  --aqua-700:  #076778;
  --aqua-600:  #0A8499;   /* Interactivo principal */
  --aqua-500:  #0EA5C0;   /* Links, iconos activos */
  --aqua-400:  #22C4DC;   /* Hover, highlights */
  --aqua-300:  #67D9EC;   /* Texto sobre dark */
  --aqua-200:  #A8EBF4;
  --aqua-100:  #D4F5FA;
  --aqua-50:   #EBF9FC;

  /* ── NEUTRALES — basados en Zinc, no en Gray ── */
  /* Zinc tiene un subtono frío que funciona mejor con el aqua */
  --zinc-950:  #09090B;
  --zinc-900:  #18181B;
  --zinc-800:  #27272A;
  --zinc-700:  #3F3F46;
  --zinc-600:  #52525B;
  --zinc-500:  #71717A;
  --zinc-400:  #A1A1AA;
  --zinc-300:  #D4D4D8;
  --zinc-200:  #E4E4E7;
  --zinc-100:  #F4F4F5;
  --zinc-50:   #FAFAFA;

  /* ── SEÑALÉTICA CLÍNICA — inmutable ── */
  --critical:     #F43F5E;   /* Rose — alerta anafilaxia, urgente */
  --critical-dim: rgba(244, 63, 94, 0.15);
  --critical-glow: rgba(244, 63, 94, 0.3);

  --warning:      #F59E0B;   /* Amber — alerta moderada */
  --warning-dim:  rgba(245, 158, 11, 0.15);

  --success:      #10B981;   /* Emerald — activo, completado */
  --success-dim:  rgba(16, 185, 129, 0.15);

  --info:         #0EA5C0;   /* Aqua — informativo */
  --info-dim:     rgba(14, 165, 192, 0.15);

  --draft:        #6B7280;   /* Neutral — borrador */
  --draft-dim:    rgba(107, 114, 128, 0.15);

  /* ── GRADIENTES ── */
  --gradient-aqua:
    linear-gradient(135deg, #0A8499 0%, #0EA5C0 50%, #22C4DC 100%);

  --gradient-page-bg:
    radial-gradient(ellipse at 20% 0%, rgba(10, 132, 153, 0.12) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 100%, rgba(14, 165, 192, 0.08) 0%, transparent 60%),
    #0D1117;

  --gradient-card-hover:
    linear-gradient(135deg,
      rgba(14, 165, 192, 0.05) 0%,
      rgba(255, 255, 255, 0.02) 100%);

  --gradient-orl-glow:
    /* Para el modelo 3D — glow aqua sobre las zonas afectadas */
    radial-gradient(circle, rgba(14, 165, 192, 0.6) 0%, transparent 70%);

  /* ── SOMBRAS ── */
  --shadow-card:
    0 1px 3px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.06);

  --shadow-card-hover:
    0 4px 24px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(14, 165, 192, 0.2),
    0 0 20px rgba(14, 165, 192, 0.05);

  --shadow-modal:
    0 24px 80px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.08);

  --shadow-glow-aqua:
    0 0 30px rgba(14, 165, 192, 0.25),
    0 0 60px rgba(14, 165, 192, 0.1);

  --shadow-critical:
    0 0 20px rgba(244, 63, 94, 0.3);

  /* ── BORDES ── */
  --border-default:  rgba(255, 255, 255, 0.08);
  --border-strong:   rgba(255, 255, 255, 0.14);
  --border-focus:    rgba(14, 165, 192, 0.6);
  --border-critical: rgba(244, 63, 94, 0.5);

  /* ── TEXTO ── */
  --text-primary:   #F4F4F5;   /* Zinc-100 — texto principal */
  --text-secondary: #A1A1AA;   /* Zinc-400 — metadatos, labels */
  --text-tertiary:  #71717A;   /* Zinc-500 — texto desactivado */
  --text-aqua:      #22C4DC;   /* Links, valores destacados */
  --text-critical:  #FB7185;   /* Alertas críticas */
  --text-warning:   #FCD34D;   /* Alertas moderadas */
  --text-success:   #34D399;   /* Estado activo/completado */

  /* ── RADIOS ── */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-full: 9999px;

  /* ── BLUR ── */
  --blur-glass:  blur(20px) saturate(180%);
  --blur-modal:  blur(40px) saturate(200%);

  /* ── ESPACIADO ── */
  --space-1:  4px;   --space-2:  8px;   --space-3:  12px;
  --space-4:  16px;  --space-5:  20px;  --space-6:  24px;
  --space-8:  32px;  --space-10: 40px;  --space-12: 48px;
  --space-16: 64px;

  /* ── TRANSICIONES ── */
  --ease-out-expo:   cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:     cubic-bezier(0.4, 0, 0.2, 1);
  --transition-fast: 120ms var(--ease-out-expo);
  --transition-base: 200ms var(--ease-out-expo);
  --transition-slow: 350ms var(--ease-out-expo);
}
```

---

## 4. Tipografía

```css
/* ── FUENTES ── */

/* Display y UI: Geist — la tipografía de Vercel. Geométrica, técnica, moderna.
   Diseñada específicamente para interfaces de software en 2023.
   Legibilidad perfecta en densidades altas y tamaños pequeños. */
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');

/* Datos numéricos, códigos CIE-10, NHC: Geist Mono
   Tabular numbers — todos los dígitos tienen el mismo ancho.
   Crítico para alinear columnas de datos en analytics. */
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap');

:root {
  --font-sans: 'Geist', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'Fira Code', monospace;

  /* Escala tipográfica */
  --text-xs:   11px;   /* Timestamps, metadata tiny */
  --text-sm:   13px;   /* Labels, captions */
  --text-base: 14px;   /* Texto de formulario (uso primario) */
  --text-md:   15px;   /* Texto de consulta, informes */
  --text-lg:   17px;   /* Títulos de sección */
  --text-xl:   20px;   /* Nombre del paciente en context bar */
  --text-2xl:  24px;   /* Título de página */
  --text-3xl:  30px;   /* Display — KPIs en analytics */
  --text-4xl:  38px;   /* Hero number */

  /* Pesos */
  --weight-light:   300;
  --weight-normal:  400;
  --weight-medium:  500;
  --weight-semibold: 600;
  --weight-bold:    700;

  /* Tracking */
  --tracking-tight:  -0.03em;   /* Números grandes, display */
  --tracking-normal: -0.01em;   /* Body */
  --tracking-wide:   0.06em;    /* Labels en mayúsculas */

  /* Line heights */
  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;
}

/* Reglas de uso: */
/* Los códigos CIE-10 siempre en --font-mono */
/* Los números de KPI en analytics con --tracking-tight */
/* Los labels en MAYÚSCULAS con --tracking-wide --text-xs */
/* El nombre del paciente con --weight-semibold --tracking-tight */
```

---

## 5. El Modelo 3D Anatómico ORL

Este es el elemento diferencial más potente de MediCore visualmente. No existe en ningún competidor.

### Concepto

En la ficha de cada paciente, la columna izquierda muestra un **modelo 3D de la cabeza y cuello humano** con los focos de patología del paciente **iluminados en tiempo real** con glow aqua. El médico puede rotar el modelo con el ratón.

Para ORL el modelo muestra: oídos (externo, medio, interno), nariz y senos paranasales, laringe, faringe, cuerdas vocales, tiroides y glándulas salivales.

### Zonas anatómicas ORL y su activación

```typescript
// apps/web/src/lib/orl-anatomy-map.ts

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
} as const

// Función que devuelve las zonas activas para un paciente
export function getActiveZones(diagnosisCodes: DiagnosisCode[]): string[] {
  const codes = diagnosisCodes.map(d => d.code)
  return Object.entries(ORL_ANATOMY_ZONES)
    .filter(([_, zone]) =>
      zone.codes.some(zoneCode =>
        codes.some(code => code.startsWith(zoneCode))
      )
    )
    .map(([zoneKey]) => zoneKey)
}
```

### Implementación Three.js

```typescript
// apps/web/src/components/clinical/AnatomyViewer3D/index.tsx

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

// El modelo GLTF es un modelo de cabeza y cuello humano
// con meshes nombrados exactamente igual que las keys de ORL_ANATOMY_ZONES
// Archivo: public/models/orl-anatomy.glb
// Tamaño objetivo: < 3MB (comprimido con Draco)

interface AnatomyViewer3DProps {
  activeZones:    string[]        // zonas con patología
  severity:       Record<string, 'critical' | 'warning' | 'info'>
  onZoneClick:    (zone: string) => void
  rotating:       boolean         // rotación automática suave
}

// Los materiales de las zonas activas usan:
// - Color base: aqua (#0EA5C0) con emissive intensity 0.3
// - Pulso animado: emissive intensity oscila entre 0.2 y 0.5 con Math.sin
// - Para critical: color rose (#F43F5E) con emissive intensity 0.6
// - Para warning: color amber (#F59E0B)

// Las zonas inactivas tienen:
// - Material translúcido: opacity 0.3, transparent true
// - Color base: zinc (#3F3F46)
// - Sin emissive

// El fondo del canvas es transparente — se ve el gradient de la card detrás
```

### Visual del modelo en la ficha del paciente

```
┌─────────────────────────────────────────┐
│                                         │
│     [Modelo 3D — cabeza y cuello]       │
│                                         │
│         ┌──────────┐                    │
│         │  ╭────╮  │   ← Oídos: aqua   │
│         │  │ 👁  │  │     glow suave    │
│         │  │ 👃  │  │   ← Nariz: aqua  │
│         │  │ 👄  │  │                  │
│         │  ╰────╯  │                   │
│         │    ││    │   ← Cuello: gris  │
│         └──────────┘                   │
│                                         │
│  ● Senos maxilares bilateral           │
│  ● Oído medio derecho                  │
│  ● Cornetes hipertróficos              │
│                                         │
│  [Rotar]  [Vista frontal]  [Vista lat.] │
└─────────────────────────────────────────┘
```

### Estados del modelo según diagnósticos

```
Sin diagnóstico activo:
  Modelo en tono zinc translúcido, rotación suave continua.
  Texto: "Sin patología activa registrada"

Con diagnóstico activo (normal):
  Zonas afectadas en aqua con pulso suave.
  Tooltip al hover: nombre de la zona + diagnóstico asociado.

Con diagnóstico crítico (tumor, sangrado):
  Zonas afectadas en rose con pulso más rápido y glow más intenso.
  El modelo deja de rotar automáticamente — enfoque.

Con múltiples zonas afectadas:
  Todas iluminadas simultáneamente. El médico puede clicar cada zona
  para navegar directamente al diagnóstico correspondiente.
```

---

## 6. Glassmorphism Clínico — El Lenguaje Visual

El glassmorphism de MediCore no es el de 2021 con gradientes de colores pastel y bordes brillantes. Es **glassmorphism estructural**: un sistema de capas de profundidad donde la translucidez comunica jerarquía.

### Las tres capas

```css
/* CAPA 1 — Cards primarias (información clínica principal) */
.card-primary {
  background:    var(--glass-primary);  /* rgba(255,255,255,0.06) */
  backdrop-filter: var(--blur-glass);
  border:        1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow:    var(--shadow-card);
}

.card-primary:hover {
  background:    var(--glass-hover);
  border-color:  var(--glass-border-strong);
  box-shadow:    var(--shadow-card-hover);
  transform:     translateY(-1px);
  transition:    all var(--transition-base);
}

/* CAPA 2 — Cards secundarias (dentro de cards primarias) */
.card-secondary {
  background:    var(--glass-secondary);  /* rgba(255,255,255,0.03) */
  border:        1px solid var(--border-default);
  border-radius: var(--radius-md);
}

/* CAPA 3 — Items de lista, filas de tabla */
.list-item {
  background:    transparent;
  border-bottom: 1px solid var(--border-default);
  transition:    background var(--transition-fast);
}

.list-item:hover {
  background: var(--glass-secondary);
}
```

### Bordes con gradiente — el detalle que marca la diferencia

```css
/* Los cards importantes tienen un borde superior con gradiente aqua */
/* simula una fuente de luz desde arriba — profundidad real */

.card-featured {
  position: relative;
  border-radius: var(--radius-lg);
  background: var(--glass-primary);
  backdrop-filter: var(--blur-glass);
}

.card-featured::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    160deg,
    rgba(14, 165, 192, 0.4) 0%,
    rgba(255, 255, 255, 0.08) 40%,
    transparent 80%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

---

## 7. Sistema de Motion y Micro-interacciones

### Principio: el movimiento tiene propósito clínico

Nada se mueve porque sí. Cada animación transmite información: un estado cambió, una alerta apareció, un proceso completó.

```css
/* ── ENTRADA DE PÁGINAS ── */
/* Las páginas no aparecen instantáneamente — entran con fade + slide */

@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-content {
  animation: page-enter 250ms var(--ease-out-expo);
}

/* ── CARDS EN CASCADA ── */
/* Las cards de una lista entran en secuencia, no todas a la vez */

.card-cascade > * {
  animation: page-enter 300ms var(--ease-out-expo) both;
}

.card-cascade > *:nth-child(1) { animation-delay: 0ms }
.card-cascade > *:nth-child(2) { animation-delay: 40ms }
.card-cascade > *:nth-child(3) { animation-delay: 80ms }
.card-cascade > *:nth-child(4) { animation-delay: 120ms }
.card-cascade > *:nth-child(5) { animation-delay: 160ms }

/* ── PULSO DE ALERTA CRÍTICA ── */

@keyframes critical-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 var(--critical-glow);
    border-color: rgba(244, 63, 94, 0.5);
  }
  50% {
    box-shadow: 0 0 0 6px transparent;
    border-color: rgba(244, 63, 94, 0.8);
  }
}

.alert-critical {
  animation: critical-pulse 2.5s ease-in-out infinite;
}

/* ── PULSO DEL MODELO 3D (zonas activas) ── */

@keyframes anatomy-pulse {
  0%, 100% { opacity: 0.7; filter: brightness(1); }
  50%       { opacity: 1.0; filter: brightness(1.3); }
}

/* ── SKELETON LOADERS ── */

@keyframes skeleton-shimmer {
  from { background-position: -200% 0; }
  to   { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-subtle) 25%,
    var(--bg-overlay) 50%,
    var(--bg-subtle) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

/* ── NÚMERO CONTANDO (KPIs en analytics) ── */
/* Los números grandes en el dashboard cuentan desde 0 hasta el valor real */
/* Implementado en JS con requestAnimationFrame */

/* ── TRANSICIÓN AL MODO IMAGEN ── */

@keyframes imaging-mode-enter {
  from {
    background-color: var(--bg-base);
    filter: brightness(1);
  }
  to {
    background-color: #000;
    filter: brightness(0.95);
  }
}

.imaging-mode {
  animation: imaging-mode-enter 400ms var(--ease-in-out) forwards;
}
```

---

## 8. Tokens CSS Completos

```typescript
// tailwind.config.ts — configuración completa

import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',  // siempre dark en MediCore
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Aqua médico
        aqua: {
          50:  '#EBF9FC', 100: '#D4F5FA', 200: '#A8EBF4',
          300: '#67D9EC', 400: '#22C4DC', 500: '#0EA5C0',
          600: '#0A8499', 700: '#076778', 800: '#044B5A',
          900: '#022D35', 950: '#011A1F',
        },
        // Zinc para neutrales
        zinc: {
          50:  '#FAFAFA', 100: '#F4F4F5', 200: '#E4E4E7',
          300: '#D4D4D8', 400: '#A1A1AA', 500: '#71717A',
          600: '#52525B', 700: '#3F3F46', 800: '#27272A',
          900: '#18181B', 950: '#09090B',
        },
        // Señalética clínica
        clinical: {
          critical: '#F43F5E',
          warning:  '#F59E0B',
          success:  '#10B981',
          info:     '#0EA5C0',
          draft:    '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'xs':   ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        'sm':   ['13px', { lineHeight: '18px', letterSpacing: '-0.005em' }],
        'base': ['14px', { lineHeight: '20px', letterSpacing: '-0.01em' }],
        'md':   ['15px', { lineHeight: '22px', letterSpacing: '-0.01em' }],
        'lg':   ['17px', { lineHeight: '24px', letterSpacing: '-0.015em' }],
        'xl':   ['20px', { lineHeight: '28px', letterSpacing: '-0.02em' }],
        '2xl':  ['24px', { lineHeight: '32px', letterSpacing: '-0.025em' }],
        '3xl':  ['30px', { lineHeight: '36px', letterSpacing: '-0.03em' }],
        '4xl':  ['38px', { lineHeight: '44px', letterSpacing: '-0.04em' }],
      },
      borderRadius: {
        sm: '6px', md: '10px', lg: '16px', xl: '24px',
      },
      boxShadow: {
        card:         '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        'card-hover': '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(14,165,192,0.2), 0 0 20px rgba(14,165,192,0.05)',
        modal:        '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
        'glow-aqua':  '0 0 30px rgba(14,165,192,0.25), 0 0 60px rgba(14,165,192,0.1)',
        critical:     '0 0 20px rgba(244,63,94,0.3)',
      },
      backdropBlur: {
        glass: '20px',
        modal: '40px',
      },
      backgroundImage: {
        'page-gradient':
          'radial-gradient(ellipse at 20% 0%, rgba(10,132,153,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(14,165,192,0.08) 0%, transparent 60%)',
        'aqua-gradient':
          'linear-gradient(135deg, #0A8499 0%, #0EA5C0 50%, #22C4DC 100%)',
        'card-featured-border':
          'linear-gradient(160deg, rgba(14,165,192,0.4) 0%, rgba(255,255,255,0.08) 40%, transparent 80%)',
      },
      animation: {
        'page-enter':     'page-enter 250ms cubic-bezier(0.16,1,0.3,1)',
        'critical-pulse': 'critical-pulse 2.5s ease-in-out infinite',
        'skeleton':       'skeleton-shimmer 1.5s ease-in-out infinite',
        'fade-in':        'page-enter 200ms cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
} satisfies Config
```

---

## 9. Vistas y Composiciones

### Vista: Lista de Pacientes

```
fondo: bg-page-gradient (el gradiente de aqua sutil en las esquinas)

┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR                                                                      │
│ [M] MediCore  Pacientes · Cirugías · Imágenes · Investigación · Analytics  │
│                                          ⌘K [Buscar...]    🔔    Dr. Ruiz  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                               padding: 32px │
│  Pacientes                                         [Importar]  [+ Nuevo]   │
│  247 en total                                                               │
│                                                                             │
│  [Filtros activos: ninguno]   [Todos ▾]  [Ordenar: Apellido ▾]             │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ card-primary — lista de pacientes                                    │  │
│  │                                                                      │  │
│  │  García López, Ana          42a · F      NHC 2026-00034              │  │
│  │  ⚠ Alergia: Penicilina (Anafilaxia)     Última visita: hace 3 días  │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  Rodríguez Vega, Carmen     61a · F      NHC 2026-00021              │  │
│  │  Sin alertas                             Última visita: hace 2 sem.  │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  Martínez Pérez, José       38a · M      NHC 2026-00089              │  │
│  │  Sin alertas                             Última visita: hace 1 mes   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Vista: Ficha del Paciente — la más importante

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ PATIENT CONTEXT BAR                                                         │
│ ← Pacientes / Ana García López, 42a                                         │
│ [Consultas 12] [Cirugías 2] [Imágenes 8] [Medicación] [Informes 5]         │
│                                   [Generar informe ✦]  [Nueva consulta +]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GRID 3 COLUMNAS                                                            │
│                                                                             │
│  ┌──────────────┐  ┌───────────────────────────┐  ┌────────────────────┐  │
│  │ COL 1 (1fr)  │  │ COL 2 (2fr)               │  │ COL 3 (1fr)        │  │
│  │              │  │                           │  │                    │  │
│  │ [Modelo 3D]  │  │  CRITICAL ALLERGY ALERT   │  │  Medicación activa │  │
│  │              │  │  ⚠ Penicilina — Anafilaxia│  │                    │  │
│  │ Zonas aqua:  │  │                           │  │  Mometasona 50mcg  │  │
│  │ · Senos max. │  │  Timeline clínica         │  │  2x mañana · DAILY │  │
│  │ · Cornetes   │  │                           │  │  ─────────────────  │  │
│  │              │  │  ● Mar 12 — CIRUGÍA       │  │  Amoxicilina 875mg │  │
│  │ [Rotar]      │  │    ESS Bilateral          │  │  2x día · ENDS Mar │  │
│  │ [Frontal]    │  │    Etmoidectomía + antros.│  │  ─────────────────  │  │
│  │ [Lateral]    │  │                           │  │  Loratadina 10mg   │  │
│  │              │  │  ● Ene 28 — FOLLOW-UP     │  │  PRN alergias      │  │
│  │              │  │    Nasofibroscopia        │  │                    │  │
│  │  ● Senos max.│  │    Poliposis grado III    │  │  [Ver log completo] │  │
│  │  ● Cornetes  │  │                           │  │                    │  │
│  │              │  │  ● Nov 15 — URGENCIA      │  │                    │  │
│  └──────────────┘  │    Epistaxis aguda        │  └────────────────────┘  │
│                    │                           │                          │
│                    └───────────────────────────┘                          │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Pruebas recientes y diagnósticos                                       │ │
│  │                                                                        │ │
│  │  [Audiometría · Mar 10]  [Nasofibroscopia · Ene 28]  [CBC · Mar 11]  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Componentes con Carácter Propio

### TopBar

```tsx
// El topbar es el elemento más visto de la app — debe ser perfecto

<header className="
  sticky top-0 z-50
  h-14
  flex items-center justify-between
  px-6
  border-b border-white/[0.06]
  bg-[#0D1117]/80
  backdrop-blur-xl
  backdrop-saturate-180
">
  {/* Logo — no es un nombre, es un monograma */}
  <div className="flex items-center gap-8">
    <div className="
      w-8 h-8 rounded-lg
      bg-aqua-gradient
      flex items-center justify-center
      text-white font-bold text-sm tracking-tight
      shadow-glow-aqua
    ">
      M
    </div>

    {/* Nav principal — sin iconos, sin subrayado visible */}
    <nav className="flex items-center gap-1">
      {['Pacientes', 'Cirugías', 'Imágenes', 'Investigación', 'Analytics'].map(item => (
        <a className="
          px-3 py-1.5
          text-sm font-medium
          text-zinc-400 hover:text-zinc-100
          rounded-md
          hover:bg-white/[0.05]
          transition-all duration-120
          data-[active=true]:text-zinc-100
          data-[active=true]:bg-white/[0.06]
        ">
          {item}
        </a>
      ))}
    </nav>
  </div>

  {/* Búsqueda global — prominente, siempre visible */}
  <button className="
    flex items-center gap-2
    px-4 py-2
    text-sm text-zinc-500
    bg-white/[0.04]
    border border-white/[0.08]
    rounded-lg
    hover:bg-white/[0.06]
    hover:border-white/[0.12]
    transition-all duration-150
    w-64
  ">
    <SearchIcon className="w-4 h-4" />
    <span>Buscar...</span>
    <kbd className="ml-auto text-xs text-zinc-600 font-mono">⌘K</kbd>
  </button>

  {/* Acciones de usuario */}
  <div className="flex items-center gap-3">
    <button className="relative p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/[0.05]">
      <BellIcon className="w-5 h-5" />
      {/* Punto de notificación — solo aparece si hay notificaciones */}
      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-aqua-500 rounded-full" />
    </button>
    <div className="flex items-center gap-2 pl-3 border-l border-white/[0.08]">
      <div className="w-7 h-7 rounded-full bg-aqua-800 flex items-center justify-center text-aqua-300 text-xs font-semibold">
        DR
      </div>
      <span className="text-sm text-zinc-300">Dr. Ruiz</span>
    </div>
  </div>
</header>
```

### ClinicalBanner — Alerta de Alergia

```tsx
// El banner más crítico del sistema — diseñado para NO ignorarse

<div className="
  relative
  flex items-start gap-3
  px-4 py-3
  rounded-lg
  bg-rose-500/[0.08]
  border border-rose-500/[0.3]
  animate-critical-pulse
  sticky top-14 z-40   /* sticky bajo el topbar */
">
  {/* Icono con fondo */}
  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-rose-500/20 flex items-center justify-center">
    <AlertTriangleIcon className="w-4 h-4 text-rose-400" />
  </div>

  <div className="flex-1 min-w-0">
    <p className="text-xs font-semibold text-rose-400 uppercase tracking-widest mb-0.5">
      Alerta de alergia crítica
    </p>
    <p className="text-sm font-medium text-rose-300">
      Penicilina — Reacción anafiláctica
    </p>
    <p className="text-xs text-zinc-500 mt-0.5">
      Verificado por Dr. Aristhone · Octubre 2023
    </p>
  </div>

  {/* Sin botón de cierre — BR-PAT-006 */}
</div>
```

### StatusBadge — Los badges clínicos

```tsx
// Un badge = un color = un significado. Sin variaciones.

const variants = {
  DRAFT:      'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  REVIEWED:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
  SIGNED:     'bg-aqua-500/15 text-aqua-400 border-aqua-500/20',
  ACTIVE:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  SCHEDULED:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  COMPLETED:  'bg-aqua-500/15 text-aqua-400 border-aqua-500/20',
  CANCELLED:  'bg-zinc-500/10 text-zinc-600 border-zinc-500/10',
  SURGERY:    'bg-violet-500/15 text-violet-400 border-violet-500/20',
  EMERGENCY:  'bg-rose-500/15 text-rose-400 border-rose-500/20',
  'FOLLOW-UP': 'bg-sky-500/15 text-sky-400 border-sky-500/20',
}

<span className={`
  inline-flex items-center
  px-2 py-0.5
  text-xs font-medium
  border rounded-full
  ${variants[status]}
`}>
  {label}
</span>
```

### DiagnosisCodePicker

```tsx
// El buscador de CIE-10 tiene que sentirse rápido y preciso

<div className="
  relative
  bg-zinc-900/90
  backdrop-blur-xl
  border border-white/[0.1]
  rounded-xl
  shadow-modal
  overflow-hidden
">
  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
    <SearchIcon className="w-4 h-4 text-zinc-500" />
    <input
      className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
      placeholder="Buscar diagnóstico CIE-10..."
    />
    <div className="flex items-center gap-1">
      <button className="px-2 py-1 text-xs rounded-md bg-aqua-500/20 text-aqua-400 font-medium">
        CIE-10
      </button>
      <button className="px-2 py-1 text-xs rounded-md text-zinc-500 hover:bg-white/[0.05]">
        SNOMED
      </button>
    </div>
  </div>

  <div className="max-h-64 overflow-y-auto">
    {results.map(code => (
      <button className="
        w-full flex items-center gap-3 px-4 py-2.5
        hover:bg-white/[0.04]
        transition-colors duration-75
        group
      ">
        {/* El código en monospace */}
        <span className="
          flex-shrink-0
          font-mono text-sm font-medium
          text-aqua-400
          w-14 text-left
        ">
          {code.code}
        </span>
        {/* La descripción */}
        <span className="text-sm text-zinc-300 group-hover:text-zinc-100 text-left">
          {code.description}
        </span>
        {/* Tipo — aparece al hover */}
        <span className="ml-auto text-xs text-zinc-600 group-hover:text-zinc-500">
          Principal
        </span>
      </button>
    ))}
  </div>
</div>
```

---

## 11. El Visor de Imágenes — Contexto Inmersivo

Cuando el médico entra al visor de imágenes, la interfaz cambia de contexto completamente. No es un cambio de página — es una metamorfosis visual.

```css
/* La transición dura 400ms */
/* El fondo pasa de #0D1117 a #000000 */
/* El topbar se oscurece más */
/* El panel lateral de estudios aparece desde la izquierda */

.imaging-layout {
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  grid-template-rows: 48px 1fr;
  height: 100vh;
  background: #000;
  gap: 0;
}

.imaging-topbar {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  background: rgba(0, 0, 0, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
}

/* En el topbar del visor: */
/* Nombre del médico | tipo de especialista | chip del paciente | chip de alergia */
/* Todo en la misma línea, información clínica siempre visible */
```

### Panel de estudios (izquierda en el visor)

```tsx
// Las miniaturas de los estudios se agrupan por categoría

<aside className="bg-zinc-950/90 border-r border-white/[0.05] overflow-y-auto">
  <div className="p-4">
    <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">
      Radiología y Endoscopia
    </p>

    {studies.radiology.map(study => (
      <button className="
        w-full mb-2
        relative group
        rounded-lg overflow-hidden
        border border-transparent
        hover:border-aqua-500/40
        transition-all duration-150
        data-[selected=true]:border-aqua-500/60
        data-[selected=true]:shadow-glow-aqua
      ">
        <img src={study.thumbnail} className="w-full aspect-video object-cover" />
        <div className="
          absolute inset-0
          bg-gradient-to-t from-black/80 to-transparent
          flex flex-col justify-end
          p-2
        ">
          <p className="text-xs font-medium text-white uppercase tracking-wide">
            {study.type}
          </p>
          <p className="text-xs text-zinc-400">{study.date}</p>
        </div>
      </button>
    ))}
  </div>
</aside>
```

---

## 12. Dashboard de Analytics — Densidad con Belleza

El dashboard de analytics es el único lugar donde los números son los protagonistas. El diseño debe transmitir que estos datos son valiosos.

### Los KPI cards — con un detalle diferencial

```tsx
// Los números grandes cuentan desde 0 hasta el valor real al cargar
// El porcentaje de cambio tiene color dinámico (verde/rojo)

<div className="
  card-primary
  p-5
  relative
  overflow-hidden
">
  {/* Texto de la métrica */}
  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
    Total Pacientes
  </p>

  {/* El número grande */}
  <div className="flex items-end gap-3 mb-1">
    <span className="text-4xl font-bold text-zinc-100 tracking-tight tabular-nums">
      2,842
    </span>
    <span className="text-sm font-medium text-emerald-400 mb-1.5">
      ↑ 12%
    </span>
  </div>

  <p className="text-xs text-zinc-600">Desde el trimestre anterior</p>

  {/* El ícono decorativo en la esquina superior derecha */}
  {/* Muy grande, muy opaco — propósito decorativo/identificativo */}
  <div className="
    absolute -right-3 -top-3
    w-20 h-20
    text-aqua-500/8
  ">
    <UsersIcon className="w-full h-full" />
  </div>

  {/* Borde con gradiente aqua en la parte superior */}
  {/* El card featured de sección 6 */}
</div>
```

### El SNOT-22 pre/post — las barras comparativas

```tsx
// Las barras de comparación pre/post son el chart más visto en ORL
// Deben ser elegantes y claras simultáneamente

// Colores:
// PRE: aqua-600 (#0A8499) — el color base del sistema
// POST: aqua-400 (#22C4DC) — más brillante, comunica mejoría
// Las barras tienen border-radius en la parte superior
// El gap entre barras dentro del mismo grupo: 4px
// El gap entre grupos: 16px
```

---

## 13. Modo Oscuro Estructural

MediCore es **dark by default**. No hay modo claro. La razón clínica: el médico trabaja en consultas con iluminación variable, y un modo oscuro constante reduce la fatiga visual. Los informes clínicos que se imprimen/exportan tienen fondo blanco — eso se maneja en el CSS de impresión.

El único modo adicional es el **modo imagen** (sección 11) que es aún más oscuro.

```css
/* CSS de impresión — los informes se imprimen en blanco */
@media print {
  body {
    background: white !important;
    color: black !important;
  }

  .no-print { display: none !important; }

  .print-report {
    font-family: 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.6;
    color: black;
  }
}
```

---

## 14. Implementación con Tailwind + shadcn/ui

### Clases utilitarias custom más usadas

```tsx
// Estas clases aparecen en decenas de componentes
// Definirlas como @layer components evita repetición

@layer components {
  .card-primary {
    @apply bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]
           rounded-2xl shadow-card transition-all duration-200
           hover:bg-white/[0.09] hover:border-white/[0.14] hover:shadow-card-hover
           hover:-translate-y-px;
  }

  .card-secondary {
    @apply bg-white/[0.03] border border-white/[0.06] rounded-xl;
  }

  .label-clinical {
    @apply text-xs font-semibold text-zinc-500 uppercase tracking-widest;
  }

  .data-mono {
    @apply font-mono text-sm font-medium text-aqua-400 tabular-nums;
  }

  .btn-primary {
    @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
           bg-aqua-gradient text-white shadow-glow-aqua
           hover:opacity-90 active:scale-[0.98]
           transition-all duration-150;
  }

  .btn-secondary {
    @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
           bg-white/[0.06] text-zinc-300 border border-white/[0.08]
           hover:bg-white/[0.09] hover:text-zinc-100
           transition-all duration-150;
  }

  .btn-ghost {
    @apply inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm
           text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]
           transition-all duration-120;
  }

  .input-clinical {
    @apply w-full px-3 py-2 text-sm text-zinc-100
           bg-white/[0.04] border border-white/[0.08] rounded-lg
           placeholder:text-zinc-600
           focus:outline-none focus:border-aqua-500/60 focus:bg-white/[0.06]
           transition-all duration-150;
  }

  .section-title {
    @apply text-lg font-semibold text-zinc-100 tracking-tight;
  }

  .page-title {
    @apply text-2xl font-bold text-zinc-100 tracking-tight;
  }
}
```

### Customización de shadcn/ui

```typescript
// components/ui/button.tsx — sobrescribir los estilos base de shadcn

// El variant="default" de shadcn se convierte en btn-primary
// El variant="outline" se convierte en btn-secondary
// El variant="ghost" se convierte en btn-ghost

// La clave: shadcn permite editar el código directamente
// Cambiar cn() por nuestros tokens en lugar de los suyos
```

### El `globals.css` mínimo

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
    box-sizing: border-box;
  }

  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    @apply bg-[#0D1117] text-zinc-100 font-sans;
    background-image: var(--gradient-page-bg);
    background-attachment: fixed;
    min-height: 100vh;
  }

  /* Scrollbar personalizado — dark y fino */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 999px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Selección de texto */
  ::selection {
    background: rgba(14, 165, 192, 0.3);
    color: #F4F4F5;
  }

  /* Focus visible accesible */
  :focus-visible {
    outline: 2px solid rgba(14, 165, 192, 0.6);
    outline-offset: 2px;
    border-radius: 4px;
  }
}
```

---

*Este documento define la identidad visual completa de MediCore.
Cada decisión tiene una razón clínica o de usabilidad.
Nada es decorativo por accidente.*