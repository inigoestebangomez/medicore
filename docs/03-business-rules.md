# 03-business-rules.md
## MediCore — Reglas de Negocio

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisitos:** `01-architecture.md`, `02-data-schema.md` aprobados

---

## Índice

1. [Convenciones de este Documento](#1-convenciones-de-este-documento)
2. [Módulo: Organización y Workspace](#2-módulo-organización-y-workspace)
3. [Módulo: Autenticación y Sesión](#3-módulo-autenticación-y-sesión)
4. [Módulo: Control de Acceso (RBAC)](#4-módulo-control-de-acceso-rbac)
5. [Módulo: Pacientes](#5-módulo-pacientes)
6. [Módulo: Consultas](#6-módulo-consultas)
7. [Módulo: Cirugías](#7-módulo-cirugías)
8. [Módulo: Imágenes Diagnósticas](#8-módulo-imágenes-diagnósticas)
9. [Módulo: Medicación](#9-módulo-medicación)
10. [Módulo: Escalas Clínicas](#10-módulo-escalas-clínicas)
11. [Módulo: Informes Clínicos con IA](#11-módulo-informes-clínicos-con-ia)
12. [Módulo: Analytics](#12-módulo-analytics)
13. [Módulo: Exportación y Portabilidad](#13-módulo-exportación-y-portabilidad)
14. [Reglas Transversales](#14-reglas-transversales)
15. [Casos de Uso Completos](#15-casos-de-uso-completos)

---

## 1. Convenciones de este Documento

### Notación de reglas

```
BR-[MÓDULO]-[NNN]  Regla de negocio numerada
UC-[MÓDULO]-[NNN]  Caso de uso numerado
```

### Notación de precondiciones/postcondiciones

Cada regla y caso de uso documenta:
- **Precondición:** estado del sistema necesario para que la regla aplique
- **Acción:** lo que ocurre
- **Postcondición:** estado del sistema tras la acción
- **Excepción:** qué ocurre si la regla no puede cumplirse

### Niveles de severidad de regla

- `[HARD]` — La aplicación impide físicamente la acción. Error 4xx en la API.
- `[SOFT]` — La aplicación advierte pero permite continuar. Warning en UI.
- `[AUDIT]` — La acción se permite pero se registra con detalle en audit log.
- `[INFO]` — Regla informativa, sin efecto de bloqueo.

---

## 2. Módulo: Organización y Workspace

### BR-ORG-001 — Creación de organización `[HARD]`
Un usuario autenticado puede crear una organización. Al crearla, el sistema le asigna automáticamente el rol `OWNER` en esa organización. Un usuario puede ser `OWNER` de múltiples organizaciones.

### BR-ORG-002 — Unicidad de slug `[HARD]`
El `slug` de una organización es único en todo el sistema (no solo dentro del tenant). El sistema genera un slug a partir del nombre de la organización, verificando unicidad y añadiendo sufijo numérico si hay colisión (`clinica-orl`, `clinica-orl-2`).

### BR-ORG-003 — Mínimo un OWNER `[HARD]`
Una organización debe tener siempre al menos un miembro con rol `OWNER`. No se puede degradar o eliminar al último `OWNER` sin transferir la propiedad primero.

### BR-ORG-004 — Invitación de miembros `[HARD]`
Solo los roles `OWNER` y `ADMIN` pueden invitar nuevos miembros. La invitación se envía por email con un token de un solo uso con TTL de 72 horas. El invitado debe tener o crear una cuenta en MediCore para aceptar la invitación.

### BR-ORG-005 — Un rol por organización por usuario `[HARD]`
Un usuario solo puede tener un rol dentro de una organización. Si necesita capacidades de dos roles, se le asigna el de mayor privilegio.

### BR-ORG-006 — Workspace de médico liberal `[INFO]`
Cuando un médico crea su primer workspace con tipo `SOLO_PRACTICE`, la organización se configura automáticamente con el nombre del médico como nombre del workspace, y el médico es el único miembro con rol `OWNER`. No se crean roles adicionales en la configuración inicial.

### BR-ORG-007 — Soft delete de organización `[HARD]` `[AUDIT]`
Solo el `OWNER` puede eliminar una organización. Al eliminarla:
1. La organización recibe `deletedAt = now()`
2. Todos los miembros pierden acceso inmediatamente
3. Los datos clínicos no se eliminan físicamente — permanecen bajo el período de retención legal
4. Se genera un registro de auditoría con todos los detalles
5. El `OWNER` recibe confirmación por email con resumen de los datos conservados

---

## 3. Módulo: Autenticación y Sesión

### BR-AUTH-001 — Proveedores OAuth permitidos `[HARD]`
Los únicos métodos de autenticación son OAuth 2.0 via Google Workspace y Microsoft Entra ID en el MVP. No existe autenticación por usuario/contraseña propia. Esto delega la gestión de credenciales y MFA a proveedores de nivel enterprise.

### BR-AUTH-002 — Sesión y tokens `[HARD]`
- El access token (JWT) tiene TTL de 15 minutos
- El refresh token tiene TTL de 7 días en dispositivos no recordados, 30 días en dispositivos recordados
- Los tokens se almacenan únicamente en cookies HttpOnly, nunca en localStorage
- El refresh token se rota en cada uso (rotation)

### BR-AUTH-003 — Expiración de sesión por inactividad `[HARD]`
La sesión expira tras 60 minutos de inactividad en la interfaz, independientemente del TTL del access token. Al expirar por inactividad, se redirige al login sin destruir la sesión del proveedor OAuth (el médico puede volver a entrar sin re-autenticarse con Google/Microsoft si su sesión del proveedor sigue activa).

### BR-AUTH-004 — Acceso sin organización `[HARD]`
Un usuario autenticado sin membresía en ninguna organización activa es redirigido a un flujo de onboarding para crear su primera organización o aceptar una invitación pendiente. No puede acceder a ningún módulo clínico.

### BR-AUTH-005 — Organización activa en sesión `[HARD]`
Cuando un usuario pertenece a múltiples organizaciones, debe seleccionar la organización activa al iniciar sesión. El `organizationId` activo se almacena en el JWT. Para cambiar de organización activa se requiere un endpoint dedicado que rota el token con el nuevo `organizationId`.

### BR-AUTH-006 — Audit log de autenticación `[AUDIT]`
Se registran en el audit log: login exitoso, login fallido (con IP), logout, expiración de sesión, cambio de organización activa, refresh de token.

---

## 4. Módulo: Control de Acceso (RBAC)

### Matriz de permisos por rol

```
Permiso                         OWNER   PHYSICIAN   VIEWER   ADMIN
────────────────────────────────────────────────────────────────────
── ORGANIZACIÓN ──
Ver configuración org            ✓         ✗          ✗        ✓
Editar configuración org         ✓         ✗          ✗        ✓
Gestionar miembros               ✓         ✗          ✗        ✓
Ver miembros                     ✓         ✗          ✗        ✓
Eliminar organización            ✓         ✗          ✗        ✗

── PACIENTES ──
Crear paciente                   ✓         ✓          ✗        ✗
Ver paciente                     ✓         ✓          ✓        ✗
Editar paciente                  ✓         ✓          ✗        ✗
Eliminar paciente (soft)         ✓         ✓          ✗        ✗
Exportar paciente (PDF/JSON)     ✓         ✓          ✗        ✗

── CONSULTAS ──
Crear consulta                   ✓         ✓          ✗        ✗
Ver consulta                     ✓         ✓          ✓        ✗
Editar consulta propia           ✓         ✓          ✗        ✗
Editar consulta de otro          ✓         ✗          ✗        ✗
Eliminar consulta (soft)         ✓         ✓          ✗        ✗

── CIRUGÍAS ──
Crear cirugía                    ✓         ✓          ✗        ✗
Ver cirugía                      ✓         ✓          ✓        ✗
Editar cirugía propia            ✓         ✓          ✗        ✗
Editar cirugía de otro           ✓         ✗          ✗        ✗
Eliminar cirugía (soft)          ✓         ✓          ✗        ✗

── IMÁGENES ──
Subir imagen                     ✓         ✓          ✗        ✗
Ver imagen                       ✓         ✓          ✓        ✗
Anotar imagen                    ✓         ✓          ✗        ✗
Eliminar imagen (soft)           ✓         ✓          ✗        ✗

── MEDICACIÓN ──
Prescribir                       ✓         ✓          ✗        ✗
Ver medicación                   ✓         ✓          ✓        ✗
Discontinuar                     ✓         ✓          ✗        ✗

── INFORMES ──
Generar informe (IA)             ✓         ✓          ✗        ✗
Ver informe                      ✓         ✓          ✓        ✗
Editar informe DRAFT             ✓         ✓          ✗        ✗
Editar informe REVIEWED          ✓         ✓          ✗        ✗
Firmar informe                   ✓         ✓          ✗        ✗
Eliminar informe DRAFT           ✓         ✓          ✗        ✗
Eliminar informe SIGNED          ✓         ✗          ✗        ✗

── ESCALAS ──
Registrar escala                 ✓         ✓          ✗        ✗
Ver escalas                      ✓         ✓          ✓        ✗

── ANALYTICS ──
Ver analytics de org             ✓         ✓          ✗        ✗
Exportar datos analytics         ✓         ✓          ✗        ✗

── AUDIT LOG ──
Ver audit log                    ✓         ✗          ✗        ✓
────────────────────────────────────────────────────────────────────
```

### BR-RBAC-001 — Propiedad de registro `[HARD]`
Un `PHYSICIAN` solo puede editar o eliminar los registros clínicos que él mismo creó (`createdBy == userId`). El `OWNER` puede editar o eliminar cualquier registro de la organización. Esta regla aplica a consultas, cirugías, informes y prescripciones.

### BR-RBAC-002 — VIEWER sin acceso a datos de contacto `[HARD]`
El rol `VIEWER` puede ver los datos clínicos pero **no** los datos de contacto del paciente (teléfono, email, dirección, documento de identidad). Estos campos se omiten en la respuesta de la API cuando el solicitante tiene rol `VIEWER`.

### BR-RBAC-003 — ADMIN sin acceso clínico `[HARD]`
El rol `ADMIN` gestiona el workspace (miembros, configuración) pero no tiene acceso a ningún dato clínico. Esta separación de responsabilidades es un control de seguridad deliberado.

### BR-RBAC-004 — Verificación en API, no solo en UI `[HARD]`
Todos los permisos se verifican en los guards de NestJS en cada petición HTTP. La matriz de permisos en el frontend es solo visual — no es una barrera de seguridad.

---

## 5. Módulo: Pacientes

### BR-PAT-001 — Generación de NHC `[HARD]`
Al crear un paciente, si no se proporciona un NHC externo, el sistema genera uno automáticamente con el formato `[AÑO]-[SECUENCIA]` (ej: `2026-00001`). La secuencia es por organización, no global. Si se proporciona un NHC externo (médico que migra de otro sistema), se valida que sea único dentro de la organización.

### BR-PAT-002 — Unicidad del paciente `[HARD]`
Antes de crear un paciente, el sistema busca posibles duplicados dentro de la organización comparando: apellidos + fecha de nacimiento + documento de identidad. Si encuentra coincidencias, muestra un aviso `[SOFT]` al médico con los pacientes similares encontrados, permitiéndole continuar si confirma que es un paciente nuevo.

### BR-PAT-003 — Datos mínimos obligatorios `[HARD]`
Para crear un paciente solo son obligatorios: `firstName`, `lastName`, `birthDate` y `sex`. Todos los demás campos son opcionales. Esto cubre el caso de pacientes de urgencia donde no se dispone de datos completos.

### BR-PAT-004 — Inmutabilidad del NHC `[HARD]`
Una vez asignado, el NHC de un paciente no puede modificarse. Es el identificador de referencia clínica permanente.

### BR-PAT-005 — Soft delete con verificación de dependencias `[HARD]`
No se puede eliminar (soft delete) un paciente que tenga cirugías en estado `SCHEDULED` en el futuro. Se debe cancelar o reasignar la cirugía primero.

### BR-PAT-006 — Registro de alergias como bloqueo `[SOFT]`
Si un paciente tiene alergias con `severity = ANAPHYLAXIS` y `status = ACTIVE`, la interfaz muestra un banner de alerta prominente en todas las vistas del paciente. Este banner no puede ser ocultado ni minimizado.

### BR-PAT-007 — Edad pediátrica `[INFO]`
Si la edad del paciente calculada desde `birthDate` es menor de 14 años, la interfaz marca al paciente como pediátrico con indicador visual. Esto es informativo y no modifica ningún flujo de negocio en el MVP.

---

## 6. Módulo: Consultas

### BR-CON-001 — Consulta requiere paciente activo `[HARD]`
No se puede crear una consulta para un paciente con `deletedAt != null`.

### BR-CON-002 — Fecha de consulta `[HARD]`
La fecha de una consulta no puede ser más de 24 horas en el futuro. Las citas se gestionan externamente (la aplicación no es un sistema de agenda en el MVP); la consulta se registra cuando ocurre.

### BR-CON-003 — Tipo FIRST_VISIT solo una vez `[SOFT]`
Si ya existe una consulta de tipo `FIRST_VISIT` para el paciente en la organización, el sistema advierte al médico si intenta crear otra consulta del mismo tipo. No bloquea — puede ser un error o una nueva primera visita tras un largo período.

### BR-CON-004 — Edición con trazabilidad `[AUDIT]`
Al editar una consulta ya guardada, el sistema registra en el audit log: qué campos cambiaron, valores anteriores y nuevos, usuario y timestamp. La consulta original no se destruye — el audit log es la trazabilidad.

### BR-CON-005 — Consulta POST_OP requiere cirugía `[SOFT]`
Si el tipo de consulta es `POST_OP`, el sistema sugiere vincularla a una cirugía existente del paciente. No es obligatorio, pero la vinculación enriquece el informe postoperatorio automático.

### BR-CON-006 — Diagnósticos en formato estándar `[HARD]`
Si se añaden códigos diagnósticos a una consulta, cada código debe incluir obligatoriamente: `system`, `code`, `description` y `type`. El código se valida contra el catálogo `@MediCore/clinical-codes` — no se pueden guardar códigos que no existan en el catálogo.

### BR-CON-007 — Límite de diagnósticos `[HARD]`
Una consulta puede tener un máximo de 1 diagnóstico `primary` y hasta 9 diagnósticos `secondary` o `differential`. Un diagnóstico `primary` es obligatorio si se añade cualquier código diagnóstico.

---

## 7. Módulo: Cirugías

### BR-SUR-001 — Cirugía requiere consentimiento `[SOFT]`
Al programar una cirugía (`status = SCHEDULED`), el sistema verifica si existe un `ConsentRecord` de tipo `SURGERY` activo (sin `revokedAt`) para el paciente. Si no existe, muestra un aviso. No bloquea — el consentimiento puede recogerse después.

### BR-SUR-002 — Clasificación ASA obligatoria al completar `[HARD]`
Para marcar una cirugía como `COMPLETED`, el campo `asa` es obligatorio. Un procedimiento quirúrgico completado sin clasificación ASA es inválido desde el punto de vista clínico y legal.

### BR-SUR-003 — Transiciones de estado permitidas `[HARD]`
```
SCHEDULED → COMPLETED    ✓ (cirugía realizada)
SCHEDULED → CANCELLED    ✓ (cancelada antes)
SCHEDULED → POSTPONED    ✓ (aplazada)
POSTPONED → SCHEDULED    ✓ (reprogramada)
POSTPONED → CANCELLED    ✓ (cancelada tras aplazamiento)
COMPLETED → *            ✗ (una cirugía completada no puede cambiar de estado)
CANCELLED → *            ✗ (una cirugía cancelada no puede reactivarse — se crea una nueva)
```

### BR-SUR-004 — Fecha de cirugía `[HARD]`
Una cirugía con estado `COMPLETED` debe tener una fecha igual o anterior a `now()`. Una cirugía con estado `SCHEDULED` puede tener fecha futura o pasada (registro retroactivo).

### BR-SUR-005 — Edición post-completada `[AUDIT]` `[SOFT]`
Una cirugía en estado `COMPLETED` puede editarse (para corregir errores de registro), pero cada edición genera un registro de auditoría detallado y requiere que el médico introduzca un motivo de la modificación.

### BR-SUR-006 — Checklist preoperatorio `[INFO]`
El `preOpChecklist` es un objeto JSONB de configuración libre. En el MVP, la aplicación proporciona una plantilla por defecto con los ítems más habituales en ORL, pero el médico puede personalizar los ítems para su práctica.

---

## 8. Módulo: Imágenes Diagnósticas

### BR-IMG-001 — Tipos de archivo permitidos `[HARD]`
Se aceptan los siguientes formatos:
- Imágenes: `image/jpeg`, `image/png`, `image/webp`
- DICOM: `application/dicom` (extensión `.dcm`)
- Vídeo endoscópico: `video/mp4`, `video/quicktime` (máx. 500MB)
- Documentos: `application/pdf`

Cualquier otro tipo MIME es rechazado con error 422.

### BR-IMG-002 — Tamaño máximo por archivo `[HARD]`
- Imágenes: 50MB por archivo
- DICOM: 200MB por archivo
- Vídeo: 500MB por archivo
- PDF: 25MB por archivo

### BR-IMG-003 — Límite de archivos por estudio `[HARD]`
Un `ImagingStudy` puede contener hasta 100 archivos. Para series DICOM con más de 100 imágenes, se recomienda comprimir en un archivo ZIP (tratado como un único archivo de tipo `application/zip`).

### BR-IMG-004 — Acceso via URL pre-firmada `[HARD]`
Los archivos en R2 nunca son públicamente accesibles. El acceso se proporciona siempre mediante URLs pre-firmadas con TTL de 15 minutos generadas en el backend tras verificar los permisos del usuario solicitante. La URL pre-firmada nunca se almacena en base de datos.

### BR-IMG-005 — Borrado físico diferido `[HARD]`
Al hacer soft delete de un `ImagingStudy`, los archivos en R2 **no** se eliminan inmediatamente. Se añaden a una cola de borrado con el mismo período de retención legal que la historia clínica. El borrado físico en R2 solo ocurre cuando el período de retención ha expirado.

### BR-IMG-006 — Metadatos DICOM `[INFO]`
Al subir un archivo DICOM, el backend extrae automáticamente los metadatos del encabezado DICOM (modalidad, fecha del estudio, descripción de la serie, equipo) y los almacena en el campo `physicalExam` del `ImagingStudy`. Los metadatos de identidad del paciente embebidos en el DICOM (nombre, fecha de nacimiento) son ignorados — en MediCore, el paciente se referencia por su `patientId`, no por los datos del DICOM.

---

## 9. Módulo: Medicación

### BR-MED-001 — Alertas de alergia `[HARD]`
Antes de persistir una nueva prescripción, el sistema compara el `drugName` y el `activeIngredient` contra las alergias activas del paciente. Si hay coincidencia de sustancia o de familia farmacológica:
- `severity = ANAPHYLAXIS`: **bloqueo total**, la prescripción no puede guardarse sin que el médico marque explícitamente "he leído y asumo el riesgo", que queda en el audit log.
- `severity = SEVERE | MODERATE`: advertencia prominente `[SOFT]`, el médico puede continuar.
- `severity = MILD`: aviso discreto `[INFO]`.

La comparación de familia farmacológica se realiza contra la base de datos de fármacos integrada en `@MediCore/clinical-codes` (basada en clasificación ATC).

### BR-MED-002 — Medicación activa exclusiva `[SOFT]`
Si ya existe una prescripción activa del mismo `activeIngredient` para el paciente, el sistema advierte de posible duplicación antes de guardar.

### BR-MED-003 — Discontinuación con motivo `[HARD]`
Para cambiar el estado de una prescripción de `ACTIVE` a `DISCONTINUED`, es obligatorio registrar el motivo de discontinuación en el campo `instructions` o en un campo `discontinuationReason` específico. Una prescripción sin motivo de discontinuación no puede ser marcada como discontinuada.

### BR-MED-004 — Receta en PDF `[INFO]`
La generación de la receta en PDF es una acción manual del médico, no automática. El PDF incluye: datos del médico (nombre, número de colegiado, especialidad), datos del paciente (nombre, fecha de nacimiento, NHC), medicamento, dosis, frecuencia, duración e instrucciones. No incluye el número de DNI del paciente por defecto (minimización de datos).

---

## 10. Módulo: Escalas Clínicas

### BR-SCA-001 — Estructura libre con tipo identificado `[HARD]`
Toda escala clínica debe tener un `scaleType` identificado (puede ser uno de los tipos predefinidos o `CUSTOM` con un nombre libre). El campo `scores` es un objeto JSONB sin validación de estructura en base de datos, pero con validación en aplicación según el tipo:
- Tipos predefinidos: el schema Zod específico de la escala se aplica
- Tipo `CUSTOM`: se acepta cualquier objeto JSON válido con al menos una clave

### BR-SCA-002 — Puntuación total calculada `[INFO]`
Para las escalas predefinidas con puntuación total (SNOT-22, DHI, VHI), el backend calcula y almacena el total automáticamente si no viene incluido en el `scores`. No se confía en el total enviado por el cliente — se recalcula siempre en el servidor.

### BR-SCA-003 — Evolución temporal `[INFO]`
Las escalas de un paciente para el mismo `scaleType` se ordenan cronológicamente para mostrar la evolución. Una consulta de analytics puede agregar la evolución de una escala a nivel de cohorte.

### BR-SCA-004 — Nueva escala personalizada `[INFO]`
Un médico con rol `OWNER` o `PHYSICIAN` puede definir una escala personalizada a nivel de organización. La definición incluye: nombre, descripción, ítems (campos del formulario) y lógica de puntuación. Las escalas personalizadas se almacenan en la tabla `Organization.settings` como parte de la configuración del workspace, no como una tabla propia en el MVP.

---

## 11. Módulo: Informes Clínicos con IA

### BR-REP-001 — Contexto mínimo para generación `[HARD]`
Para generar un informe con IA, se requiere como mínimo:
- Identificación del paciente (nombre, edad, sexo)
- Al menos un registro clínico fuente: consulta, cirugía, o conjunto de pruebas
- Tipo de informe seleccionado

Sin estos datos, el endpoint devuelve 422 con indicación de qué falta.

### BR-REP-002 — Informe creado en estado DRAFT `[HARD]`
Todo informe generado por IA (o creado manualmente) comienza en estado `DRAFT`. Un informe en `DRAFT` nunca se entrega al paciente ni se exporta como definitivo. El flujo obligatorio es: `DRAFT → REVIEWED → SIGNED`.

### BR-REP-003 — Edición libre en DRAFT y REVIEWED `[HARD]`
El médico puede editar libremente el contenido de un informe en estado `DRAFT` o `REVIEWED`. Cada edición actualiza `updatedAt` y `updatedBy`. El contenido generado por la IA no es el contenido final — es un borrador de trabajo.

### BR-REP-004 — Inmutabilidad del informe SIGNED `[HARD]`
Un informe en estado `SIGNED` no puede modificarse. Si el médico necesita corregirlo, debe:
1. Crear un nuevo informe de corrección (que hace referencia al informe original)
2. El informe original permanece en el sistema con su estado `SIGNED` y fecha de firma
3. El nuevo informe se marca como `amendedReportId = [id del original]`

Solo el `OWNER` puede eliminar (soft delete) un informe firmado, y queda registrado en el audit log.

### BR-REP-005 — Responsabilidad médica `[HARD]`
El informe firmado por el médico es su responsabilidad clínica y legal. El sistema incluye, en la firma del informe, un disclaimer no editable que indica:
> *"El presente informe ha sido elaborado con asistencia de herramientas de IA y ha sido revisado y firmado por el facultativo. El médico firmante asume la responsabilidad clínica del contenido."*

Este disclaimer es fijo y no puede ser eliminado por ningún rol.

### BR-REP-006 — Códigos diagnósticos en el informe `[SOFT]`
Al generar un informe, el sistema pre-rellena los códigos diagnósticos y de procedimiento a partir de la fuente (consulta o cirugía). Si la fuente no tiene códigos asignados, el sistema advierte al médico para que los añada antes de firmar. No bloquea, pero el informe sin codificación es considerado incompleto para analytics.

### BR-REP-007 — Retención del prompt IA `[AUDIT]`
El hash SHA-256 del prompt enviado al modelo de IA se almacena en `Report.aiPromptHash`. Esto permite: auditar qué contexto clínico generó qué informe, detectar si el mismo contexto genera outputs diferentes, y cumplir con requisitos futuros de explicabilidad de IA en entornos médicos.

### BR-REP-008 — Timeout y fallback de generación `[HARD]`
La generación de informe con IA es un proceso asíncrono (BullMQ). Si el job no completa en 60 segundos, se marca como fallido y el médico recibe una notificación. El informe queda en estado `DRAFT` con `content = ""` para que el médico pueda escribirlo manualmente.

### BR-REP-009 — Rate limiting de generación IA `[HARD]`
En el plan `FREE`, se permiten hasta 20 informes generados por IA al mes por organización. En el plan `PRO`, el límite es 200/mes. En `ENTERPRISE`, sin límite. Al alcanzar el límite, el médico puede crear informes manualmente pero no con IA.

---

## 12. Módulo: Analytics

### BR-ANA-001 — Datos anonimizados en visualizaciones `[HARD]`
Las visualizaciones de analytics muestran datos agregados. Ninguna visualización expone datos identificativos de un paciente individual, salvo en la vista "drill-down" donde el médico navega explícitamente desde un agregado hacia un paciente concreto (lo cual requiere permiso `VIEW_PATIENT`).

### BR-ANA-002 — Exportación para investigación `[HARD]` `[AUDIT]`
La exportación de datos de analytics para investigación genera un dataset anonimizado donde:
- Los identificadores de paciente son sustituidos por IDs aleatorios no reversibles
- Los datos de contacto son omitidos completamente
- Las fechas se redondean a mes/año (nunca día exacto)
- La exportación queda registrada en el audit log con: usuario, fecha, filtros aplicados, número de registros exportados

### BR-ANA-003 — Período mínimo de datos para analytics `[INFO]`
Las métricas de analytics tienen significado estadístico a partir de 20 pacientes o 50 consultas. Por debajo de estos umbrales, el sistema muestra los datos pero incluye un aviso de que el tamaño de muestra puede no ser representativo.

---

## 13. Módulo: Exportación y Portabilidad

### BR-EXP-001 — Exportación completa de paciente `[AUDIT]`
La exportación de un paciente genera un PDF clínico y/o un JSON estructurado con toda su historia clínica. Esta acción se registra siempre en el audit log (nombre del usuario exportador, fecha, formato). Cumple el derecho de portabilidad del Art. 20 RGPD.

### BR-EXP-002 — El JSON de exportación sigue estructura FHIR-compatible `[INFO]`
Aunque no se implementa HL7 FHIR en el MVP, el JSON de exportación usa nombres de campos y estructura compatible con FHIR R4. Esto facilita la futura interoperabilidad sin reescribir el exportador.

### BR-EXP-003 — El PDF de exportación incluye datos de la organización `[HARD]`
El PDF exportado de un paciente incluye el logotipo, nombre y datos de contacto de la organización/médico. Sin estos datos, el PDF no tiene validez como documento clínico entregable.

### BR-EXP-004 — No exportación de datos borrados `[HARD]`
Los registros clínicos con `deletedAt != null` no se incluyen en la exportación del paciente, salvo solicitud explícita del `OWNER` con motivo documentado.

---

## 14. Reglas Transversales

### BR-TRX-001 — Tenant isolation en todas las queries `[HARD]`
Toda query a base de datos que acceda a datos clínicos debe incluir el filtro `organizationId`. El `TenantInterceptor` de NestJS inyecta el `organizationId` del JWT en el contexto de la petición. Los repositorios Prisma reciben el `organizationId` como parámetro explícito y no opcional. Un Prisma middleware global verifica en desarrollo que ninguna query sobre tablas clínicas omite el filtro.

### BR-TRX-002 — Soft delete en queries `[HARD]`
Un Prisma middleware global añade automáticamente el filtro `deletedAt: null` a todas las queries de lectura sobre tablas con soft delete. Para acceder a registros borrados, se debe usar el método explícito `findWithDeleted()` del repositorio, solo disponible para roles `OWNER`.

### BR-TRX-003 — Timestamps gestionados por el servidor `[HARD]`
Los campos `createdAt`, `updatedAt`, `deletedAt` son siempre asignados por el servidor (Prisma/PostgreSQL). El cliente nunca envía timestamps — si los envía, son ignorados.

### BR-TRX-004 — IDs generados por el servidor `[HARD]`
Los UUIDs de todos los registros son generados por el servidor (`@default(uuid())`). El cliente no puede especificar el ID de un recurso al crearlo.

### BR-TRX-005 — Validación en servidor siempre `[HARD]`
La validación en el cliente (React Hook Form + Zod) es por conveniencia de UX. Toda petición al backend se valida independientemente usando el mismo schema Zod del paquete `@MediCore/contracts`. El cliente no es una fuente de verdad.

### BR-TRX-006 — Paginación obligatoria en listados `[HARD]`
Ningún endpoint de listado devuelve registros sin paginación. El tamaño de página por defecto es 20, el máximo es 100. Los endpoints que no respetan esta regla son rechazados en code review.

### BR-TRX-007 — Respuestas de error estandarizadas `[HARD]`
Todos los errores de la API siguen el formato:
```json
{
  "statusCode": 422,
  "error": "VALIDATION_ERROR",
  "message": "El campo birthDate es obligatorio",
  "details": [{ "field": "birthDate", "message": "Required" }],
  "requestId": "req_abc123"
}
```
El `requestId` permite correlacionar errores con el sistema de logs.

---

## 15. Casos de Uso Completos

### UC-PAT-001 — Alta de nuevo paciente

**Actor:** Médico (`PHYSICIAN` o `OWNER`)
**Precondición:** Usuario autenticado con organización activa

```
1. Médico abre "Nuevo Paciente"
2. Sistema muestra formulario de alta (campos mínimos obligatorios marcados)
3. Médico rellena: nombre, apellidos, fecha de nacimiento, sexo (mínimo)
4. Médico hace clic en "Guardar"
5. Sistema valida datos con Zod schema (BR-TRX-005)
6. Sistema busca posibles duplicados (BR-PAT-002)
   6a. [Si hay duplicados] Sistema muestra modal con pacientes similares
       → Médico confirma que es un paciente nuevo → continúa en paso 7
       → Médico selecciona paciente existente → flujo termina, navega al existente
   6b. [Sin duplicados] Continúa en paso 7
7. Sistema genera NHC (BR-PAT-001)
8. Sistema persiste el paciente con organizationId del JWT
9. Sistema registra en audit log: CREATE, Patient, {patientId}
10. Sistema navega a la ficha del nuevo paciente
11. Sistema muestra aviso: "Considere recoger el consentimiento de tratamiento de datos"
```

**Postcondición:** Paciente creado en la organización con NHC asignado
**Excepción paso 5:** Datos inválidos → formulario muestra errores inline, no se persiste

---

### UC-CON-001 — Registro de consulta con generación de informe

**Actor:** Médico (`PHYSICIAN` o `OWNER`)
**Precondición:** Paciente activo existe en la organización

```
1. Médico abre la ficha del paciente → pestaña "Consultas" → "Nueva Consulta"
2. Sistema carga el formulario de consulta con fecha = hoy (editable)
3. Médico selecciona tipo de consulta
4. Médico rellena: motivo de consulta (obligatorio), exploración, diagnóstico, plan
5. [Opcional] Médico añade códigos CIE-10/SNOMED usando el buscador integrado
6. [Opcional] Médico registra escalas clínicas vinculadas
7. Médico hace clic en "Guardar Consulta"
8. Sistema valida datos (BR-TRX-005, BR-CON-006, BR-CON-007)
9. Sistema persiste la consulta
10. Sistema registra en audit log: CREATE, Consultation
11. [Si el médico activó "Generar informe"] Sistema encola job de generación IA (BR-REP-001)
    → Sistema muestra: "Generando informe... estará listo en unos segundos"
    → Job completa → informe aparece en estado DRAFT en la pestaña "Informes"
    → Job falla → notificación al médico (BR-REP-008)
12. Sistema actualiza el timeline del paciente
```

**Postcondición:** Consulta persistida; informe en DRAFT si se solicitó generación

---

### UC-SUR-001 — Registro completo de cirugía

**Actor:** Médico (`PHYSICIAN` o `OWNER`)
**Precondición:** Paciente activo existe; no tiene el mismo procedimiento en estado SCHEDULED

```
FASE PRE-OPERATORIA:
1. Médico crea la cirugía en estado SCHEDULED con: tipo de procedimiento, fecha
2. Sistema verifica consentimiento quirúrgico (BR-SUR-001) → aviso si falta
3. Médico completa el checklist preoperatorio
4. Médico asigna clasificación ASA (opcional en esta fase)

FASE INTRAOPERATORIA (el día de la cirugía):
5. Médico abre la cirugía y cambia estado a COMPLETED
6. Sistema verifica que ASA está rellenado (BR-SUR-002)
7. Médico rellena: duración, técnica quirúrgica (JSONB libre), hallazgos, complicaciones
8. Médico registra códigos de procedimiento CIE-10-PCS / SNOMED

FASE POST-OPERATORIA:
9. Médico añade notas post-operatorias y protocolo de revisiones
10. Médico solicita generación del informe quirúrgico (IA)
11. Sistema genera informe en DRAFT con toda la información de la cirugía
```

**Postcondición:** Cirugía en estado COMPLETED con informe quirúrgico en DRAFT

---

### UC-REP-001 — Ciclo de vida de un informe clínico

**Actor:** Médico (`PHYSICIAN` o `OWNER`)
**Precondición:** Existe al menos una consulta o cirugía como fuente

```
GENERACIÓN:
1. Médico selecciona tipo de informe y fuente clínica
2. Sistema construye el contexto (datos del paciente + consulta/cirugía + códigos)
3. Sistema envía prompt al modelo Claude via Anthropic API
4. Sistema recibe respuesta y crea Report en estado DRAFT
5. Sistema almacena hash del prompt (BR-REP-007)

REVISIÓN:
6. Médico lee el informe generado
7. Médico edita el contenido libremente (título, párrafos, diagnósticos)
8. Médico cambia estado a REVIEWED (indica que ha leído y revisado el borrador)

FIRMA:
9. Médico hace clic en "Firmar Informe"
10. Sistema muestra modal de confirmación con el disclaimer legal (BR-REP-005)
11. Médico confirma la firma
12. Sistema cambia estado a SIGNED, registra signedAt y signedBy
13. Sistema encola la generación del PDF
14. PDF generado → URL almacenada en Report.pdfUrl (clave R2, no URL directa)
15. Sistema registra en audit log: SIGN, Report

ENTREGA:
16. Médico descarga o envía el PDF al paciente
    (La URL de descarga es una URL pre-firmada R2 con TTL 15min — BR-IMG-004)
```

**Postcondición:** Informe en estado SIGNED con PDF disponible; no modificable

---

### UC-ANA-001 — Análisis de casos por diagnóstico

**Actor:** Médico (`PHYSICIAN` o `OWNER`)
**Precondición:** La organización tiene al menos 20 pacientes con diagnósticos codificados

```
1. Médico navega a Analytics → "Análisis por Diagnóstico"
2. Médico filtra por: código CIE-10 (ej: J32 — Rinosinusitis crónica), período (último año)
3. Sistema ejecuta query agregada sobre consultations.diagnosis_codes (GIN index)
4. Sistema muestra: nº de casos, distribución por edad/sexo, escalas SNOT-22 asociadas,
   tasa de derivación a cirugía, tiempo medio entre primera consulta y cirugía
5. [Si N < 20] Sistema muestra aviso de tamaño de muestra (BR-ANA-003)
6. Médico puede hacer drill-down en un caso individual → navega a la ficha del paciente
7. Médico puede exportar el dataset anonimizado (BR-ANA-002)
```

**Postcondición:** Médico obtiene visión epidemiológica de su práctica clínica

---