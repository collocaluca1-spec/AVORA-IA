# AVORA AI · Arquitectura

Panel privado para planificar, crear, aprobar y (más adelante) publicar el contenido de Instagram de AVORA TRAVEL.
Principio rector: **automatización supervisada**. La IA propone; una persona aprueba; recién entonces el sistema publica.

## 1. Vista general

```
Navegador (React + Vite + Tailwind)          Netlify Functions (servidor)          Servicios externos
──────────────────────────────────           ─────────────────────────────         ──────────────────
Panel privado ── anon key + JWT ──► Supabase (Auth, Postgres+RLS, Storage)
      │                                   ▲
      └── /api/* con JWT del usuario ──► funciones ── service role ─┘
                                          │
                                          ├── IA de texto / imagen / video   (Fase 2-3)
                                          ├── Instagram Graph API            (Fase 3)
                                          └── n8n (webhooks firmados)        (Fase 3)
```

- **El navegador** solo conoce la URL de Supabase y la *anon key* (pública por diseño). Todo acceso a datos pasa por RLS.
- **El servidor** (Netlify Functions) guarda todas las claves secretas: service role de Supabase, claves de IA, token de Instagram, secreto de n8n.
- **La base de datos es la fuente de verdad de las reglas**: el flujo de aprobación, la política de precios y el bloqueo de publicación automática están en triggers y constraints, no solo en la interfaz.

## 2. Estructura del proyecto

```
avora-ai/
├─ shared/                  Dominio compartido navegador/servidor (sin dependencias)
│  ├─ content.ts            Formatos (1080×1350, 1080×1080, 1080×1920, reel, carrusel), estados
│  ├─ workflow.ts           Máquina de estados de aprobación
│  ├─ contentChecks.ts      Controles de calidad + política de precios
│  ├─ integrations.ts       Catálogo de integraciones y sus variables de entorno
│  └─ agent/                Lógica determinística del agente (estaciones, anti-repetición)
├─ src/                     Frontend
│  ├─ auth/                 Sesión Supabase + perfil/rol
│  ├─ lib/api/              Acceso a datos (una capa por entidad)
│  ├─ components/ui/        Sistema de diseño (Button, Card, Field, Modal, Toast…)
│  ├─ components/content/   Piezas de dominio (vista previa Instagram, acciones de flujo…)
│  ├─ components/layout/    AppShell (barra lateral + navegación móvil)
│  └─ pages/                Dashboard, Estudio, Contenidos, Aprobaciones, Calendario, Agente, Configuración, Actividad
├─ netlify/
│  ├─ functions/            Endpoints /api/* (integrations-check, agent)
│  └─ lib/                  Auth del servidor, cliente service role, agente (providers, tasks, runner)
├─ supabase/
│  ├─ migrations/           Esquema, RLS, triggers, storage
│  └─ tests/                Pruebas SQL de reglas y RLS (corren en Postgres local)
└─ docs/
```

## 3. Modelo de datos

| Tabla | Para qué | Quién escribe |
|---|---|---|
| `profiles` | Usuario ↔ rol (`admin`, `editor`, o sin acceso) | Trigger al crear usuario; admin asigna roles |
| `content_items` | Cada pieza: título, descripción, hashtags, formato, estado, fecha, precio+fuente | Equipo (sujeto al flujo) |
| `content_assets` | Material visual en Storage (orden, dimensiones, origen upload/IA) | Equipo |
| `content_events` | Historial por contenido (creado, enviado, aprobado, rechazado con motivo…) | Solo triggers |
| `workflow_transitions` | Transiciones permitidas y quién puede hacerlas | Migraciones |
| `app_settings` | Identidad de marca, frecuencia, preferencias, automatizaciones | Solo admin |
| `integrations` | Estado real de cada integración | **Solo servidor** |
| `content_ideas` | Banco de ideas (manuales o del agente) | Equipo / servidor |
| `agent_runs` | Ejecuciones del agente con entrada, salida y fuentes | Solo servidor |
| `activity_log` | Registro de acciones y errores, solo inserción | Triggers, equipo (a su nombre), servidor |

Storage: bucket **privado** `content-media`; el panel usa URLs firmadas de 1 hora.

## 4. Flujo de aprobación

```
Borrador ──enviar──► Pendiente ──aprobar (admin)──► Aprobado ──programar──► Programado ──(servidor)──► Publicando ──► Publicado
   ▲  ▲                 │                              │  ▲                    │                          │
   │  └──── volver ─────┤                              │  └─ cancelar ─────────┘                          └──► Error
   │                    └──rechazar (admin, motivo)──► Rechazado ──reabrir──► Borrador
   └── Generando (servidor, IA)
```

Reglas aplicadas en la base de datos (`content_items_enforce_workflow`):
- Desde el panel solo se crea en Borrador o Pendiente. Nadie puede autoaprobarse escribiendo `approved_at`.
- Solo un admin aprueba o rechaza; rechazar exige motivo.
- Programar exige fecha futura. Reprogramar mantiene la aprobación.
- **Editar texto, formato o material de algo aprobado/programado lo devuelve a Pendiente.** La versión que se publica es siempre la aprobada.
- Generando, Publicando y Publicado solo los maneja el servidor. Lo publicado no se edita ni se borra.

## 5. Seguridad

- Supabase Auth con email y contraseña; crear cuenta no da acceso (rol nulo). Recomendado: desactivar registros públicos en Supabase.
- RLS en todas las tablas; helpers `is_team_member()` / `is_admin()`.
- Claves secretas solo en variables de entorno de Netlify sin prefijo `VITE_`.
- Encabezados de seguridad y `noindex` en `netlify.toml`.
- Errores de interfaz y del servidor quedan en `activity_log`.

## 6. Integraciones sin simulación

Cada integración tiene un estado que **solo escribe el servidor**:
`No configurado` → `Credenciales cargadas · sin verificar` → `Conectado` (tras verificación real) / `Error`.

- Fase 1: `/api/integrations-check` solo detecta presencia de variables. Nunca marca "Conectado".
- La publicación automática está bloqueada por trigger mientras Instagram no esté `connected`, y se apaga sola si deja de estarlo.
- El agente responde `503 not_configured` si no hay proveedor. No hay respuestas de ejemplo.

## 7. Agente de contenido

`netlify/lib/agent/`:
- `providers.ts`: interfaz `TextProvider`. Fase 2 agrega un adaptador por proveedor.
- `brandContext.ts`: arma las instrucciones desde `app_settings` (tono, reglas, destinos, temporada objetivo).
- `tasks.ts`: investigar destinos, proponer ideas, textos comerciales, consejos, recomendaciones por temporada.
- `runner.ts`: registra la ejecución, exige fuentes en tareas de investigación, descarta ideas repetidas (`recent_topics` + similitud de títulos), destinos excluidos o que mencionen precios.

Todo lo que produzca el agente entra como idea o borrador y pasa por aprobación.

## 8. Fases

| Fase | Alcance | Estado |
|---|---|---|
| 1 | Panel: auth, DB, estudio, aprobaciones, calendario, configuración, registro | **Esta entrega** |
| 2 | IA de texto (adaptador + agente) e IA de imágenes | Pendiente |
| 3 | Instagram Graph API (verificación real, publicación programada), IA de video, n8n | Pendiente |
| 4 | Proveedores turísticos como fuente verificable de precios | Pendiente |
