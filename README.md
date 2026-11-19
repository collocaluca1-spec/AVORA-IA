# AVORA AI

Panel privado de marketing supervisado para **AVORA TRAVEL**: estudio creativo, aprobaciones, calendario editorial y estructura para el agente de contenido. Ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

Stack: React 19 + Vite + Tailwind 4 · Supabase (Auth, Postgres con RLS, Storage) · Netlify (hosting + Functions).

## Puesta en marcha

### 1. Supabase
1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Aplicar las migraciones de `supabase/migrations/` en orden (SQL Editor, o `supabase db push` con la CLI vinculada al proyecto).
3. Authentication → Providers → Email: **desactivar "Allow new users to sign up"** (el panel es privado).
4. Authentication → URL Configuration: agregar la URL de Netlify y `http://localhost:5173` como redirect URLs.
5. Invitar al primer usuario (Authentication → Users → Invite) y, en el SQL Editor, darle rol de administrador:
   ```sql
   update public.profiles set role = 'admin' where email = 'tu-correo@dominio.com';
   ```
   Los siguientes usuarios se habilitan desde el panel (Configuración → Equipo).

### 2. Variables de entorno
Copiar `.env.example` a `.env`:
- **Públicas** (navegador): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Servidor** (solo Netlify, nunca `VITE_`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y, cuando corresponda, las claves de IA, Instagram y n8n.

### 3. Local
```bash
npm install
npm run dev          # solo frontend
npx netlify dev      # frontend + funciones /api/* (requiere Netlify CLI)
```

### 4. Netlify
Conectar el repositorio; `netlify.toml` ya define build, funciones, redirecciones SPA y encabezados de seguridad. Cargar las variables en Site settings → Environment variables.

## Pruebas
```bash
npm test                              # dominio compartido (flujo, precios, formatos, agente)
npm run typecheck
PGURL=postgres://postgres@localhost:5432 ./supabase/tests/run_local.sh   # reglas SQL + RLS en Postgres local
```

## Reglas del sistema
- Nada se publica sin aprobación de un administrador; editar algo aprobado exige aprobarlo de nuevo.
- Las integraciones no configuradas se muestran como "No configurado"; solo el servidor puede cambiar su estado.
- La publicación automática está bloqueada en la base de datos hasta que Instagram esté conectado.
- No se generan precios. Un contenido con precio exige un enlace verificable a la fuente.
- Las claves secretas viven solo en el servidor.
