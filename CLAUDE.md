# TidyUp — guía para Claude

App para recordar **dónde se guardan las cosas en casa**. El usuario dicta o
fotografía lo que guarda, la IA (Google Gemini) extrae *qué* y *dónde*, y luego
lo encuentra con búsqueda semántica (RAG) aunque no recuerde las palabras exactas.

Este archivo es el punto de entrada para retomar el trabajo. Léelo antes de tocar nada.

## Principio de diseño (no negociable)

La app compite por **fricción mínima al guardar**, no por número de funciones.
Regla de oro: guardar un objeto debe costar **< 10 segundos y ~2 toques**.
Antes de añadir cualquier función, pregúntate si añade fricción al flujo de guardado.
Si la respuesta es sí, va detrás de una acción opcional, nunca en el camino principal.

## Stack

- **Ionic React 8** + **React 18** + **react-router-dom v5** (Ionic usa v5, no v6).
- **Vite 5** + **TypeScript** (strict).
- **PWA** vía `vite-plugin-pwa` (autoUpdate).
- **Supabase** (Postgres + Auth + Storage + `pgvector`) como backend de datos.
  Multiusuario: los datos se comparten por **hogar**. Requiere conexión (online).
- **Google Gemini** vía REST, a través de una función serverless propia (`api/gemini.ts`),
  no directamente desde el navegador (así la clave no se expone).
- **Vercel** para el deploy (estático + función serverless en `/api` + rewrites de proxy).
- Iconos: `ionicons`.

> **Proxy anti-bloqueo:** el navegador NO habla con `*.supabase.co` directamente
> (redes corporativas lo bloquean). Habla con `/sb/*` (mismo origen) y Vercel/Vite
> reenvían a Supabase por detrás (ver `vercel.json` y `vite.config.ts`). El cliente
> de Supabase (`src/services/supabase.ts`) apunta a `${origin}/sb`.

> **Nota histórica:** hubo una fase con Dexie/IndexedDB offline-first y BYOK (cada
> usuario metía su clave). Se abandonó: la clave está en el servidor (`GEMINI_KEY`) y
> los datos en Supabase. Ya no se usa Dexie.

## Comandos

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc + vite build -> dist/
npm run preview
npm run lint      # tsc --noEmit
```

## Estructura

```
api/
  gemini.ts             # función serverless Vercel: proxy a Gemini (usa GEMINI_KEY del server)
supabase/
  schema.sql            # esquema BD (hogares/miembros/items+vector) + RLS + RPC + Storage. Ejecutar en SQL Editor.
src/
  main.tsx              # bootstrap React
  App.tsx               # gate de sesión+hogar; si ok -> IonApp + rutas
  vite-env.d.ts         # tipos de import.meta.env (VITE_SUPABASE_*)
  theme/variables.css   # color primario #3b5bdb
  db/db.ts              # capa de datos Supabase: Item + CRUD + fotos(Storage) + ubicacionTexto()
  services/
    supabase.ts         # cliente Supabase apuntando al proxy /sb
    home.ts             # hogar actual: crear/unirse (RPC) + cache en localStorage
    gemini.ts           # IA (cliente): llama a /api/gemini; extraerConcepto, reconocerFoto, generarEmbedding
    search.ts           # RAG: RPC buscar_items (pgvector) + fallback texto; textoParaEmbedding
  pages/
    Login.tsx           # login por email + contraseña
    Onboarding.tsx      # crear hogar / unirse por código
    Home.tsx            # búsqueda + recientes + FAB "+"
    AddItem.tsx         # voz + foto + texto -> IA rellena campos -> guardar
    ItemDetail.tsx      # ver/borrar
    Settings.tsx        # código de invitación del hogar + cerrar sesión + modelos IA
public/                 # favicon.svg, icon-192.png, icon-512.png
vercel.json             # rewrites: /sb/* -> supabase.co (proxy) ; resto -> index.html (SPA)
```

## Cómo funciona

- **Auth** (`App.tsx` + `Login.tsx`): login por **email + contraseña** (elegido por
  simplicidad: no envía emails -> sin SMTP, y sin enlaces a supabase.co bloqueados).
  Requiere desactivar "Confirm email" en Supabase para iniciar sesión al registrarse.
  `App` hace de gate: sin sesión -> Login; con sesión pero sin hogar -> Onboarding; ok -> rutas.
- **Hogar** (`home.ts`): espacio compartido. `crear_hogar`/`unirse_a_hogar` (RPC).
  El hogar activo se cachea en `localStorage` (`hogar_id`). Compartir = pasar el
  `codigo_invitacion` (visible en Ajustes) a tu pareja.
- **Modelo de datos** (`db/db.ts`): `Item { id(uuid), nombre, habitacion, almacenaje,
  ubicacion, categoria?, etiquetas?, notas?, foto_path?, embedding?, creado, actualizado }`.
  La ubicación se descompone en habitacion -> almacenaje -> ubicacion (sitio dentro).
  Todo protegido por RLS (solo ves lo de tu hogar). Fotos en Storage privado (`fotos`),
  el item guarda solo la ruta; se muestran vía URL firmada (`fotoUrl`).
- **Añadir** (`AddItem.tsx`):
  1. Voz: Web Speech API del navegador (`webkitSpeechRecognition`, `lang=es-ES`).
     Gratis, no consume cuota de IA. Al terminar, la transcripción va a `interpretar()`.
  2. `interpretar(frase)` -> `extraerConcepto()` -> rellena nombre/habitacion/almacenaje/ubicacion/categoria/etiquetas.
  3. Foto: `<input type=file capture=environment>` -> dataURL -> `reconocerFoto()` (solo QUÉ es).
  4. Al guardar: se crea el Item; **después** se sube la foto a Storage y se genera el
     embedding, ambos en segundo plano (no bloquean). Si fallan, el objeto igual queda.
- **Buscar** (`search.ts`): embebe la query y llama a la RPC `buscar_items` (coseno en
  pgvector, umbral 0.55, fallback top-5). Si falla, búsqueda de texto local.
- **IA** (`gemini.ts` + `api/gemini.ts`): el cliente **no** conoce la clave. Llama a
  la función serverless `/api/gemini`, que habla con Google usando `GEMINI_KEY`
  (variable de entorno del servidor en Vercel, nunca en el cliente). Así nadie
  configura nada en su dispositivo. Solo los nombres de modelo viven en `localStorage`
  (`gemini_text_model`, `gemini_embed_model`); defaults `gemini-2.5-flash` (texto/visión)
  y `gemini-embedding-001` (embeddings, forzado a 768 dims para casar con `vector(768)`). Endpoint Google `v1beta`. `generateContent`
  fuerza `responseMimeType: application/json`. **Aviso:** `/api/gemini` no tiene auth
  → proxy abierto; aceptable para uso familiar, al abrir al público añadir login/rate-limiting.

## Convenciones

- Todo el texto de UI y los comentarios, en **español**.
- La clave de Gemini **nunca** en código ni en git: es la variable de entorno
  `GEMINI_KEY` en Vercel (server-side). En local, `.env` (ignorado por git).
- Ionic usa **react-router v5** — no migrar a v6 (rompe `IonRouterOutlet`).
- Los campos de la petición a Gemini van en **camelCase** (`inlineData`, `mimeType`).
- Toda llamada a Gemini pasa por `api/gemini.ts`; el cliente nunca llama a Google
  directamente. Mantener ese único punto de entrada.
- El cliente **nunca** llama a `*.supabase.co` directamente: siempre vía el proxy
  `/sb` (mismo origen). Motivo: redes corporativas bloquean el dominio de Supabase.
- Cambios de esquema: editar `supabase/schema.sql` (idempotente) y volver a ejecutarlo
  en el SQL Editor de Supabase. Mantener las políticas RLS al día.
- Las variables públicas de Supabase se re-mapean a `VITE_*` en `vite.config.ts`
  (no hace falta duplicarlas en Vercel). Nunca exponer `POSTGRES_*` ni service_role.

## Estado actual

Hecho: app completa migrada a **Supabase** (auth OTP + hogar compartido + datos con
RLS + fotos en Storage + búsqueda RAG con pgvector), IA vía `/api/gemini`, proxy `/sb`
anti-bloqueo, modelo de ubicación en 3 niveles (habitación/almacenaje/ubicación).
**Build verificado** (`npm run build` OK, sin errores de tipos). Repo en GitHub
(`AntonioJDios/TidyUp`, rama `main`).

**Pendiente de verificar (setup manual en Supabase + prueba real):**
1. Ejecutar `supabase/schema.sql` en el SQL Editor de Supabase (una vez).
2. Auth -> Providers -> Email: activado y **desactivar "Confirm email"** (para que el
   registro con email+contraseña inicie sesión al momento, sin enviar correo).
3. Confirmar `GEMINI_KEY` en Vercel (facturación de Gemini activa; free tier no va en UE).
4. Probar en el móvil el flujo completo: crear cuenta -> crear hogar -> guardar (voz/foto)
   -> buscar. Y que la pareja se une con el código de invitación.

## Próximos pasos sugeridos (en orden)

1. Completar el setup manual de arriba y validar el flujo end-to-end en el móvil.
2. Optimizar el bundle (~1.37 MB): code-splitting / `manualChunks` (aviso de Vite).
3. Blindar el proxy `/api/gemini` con auth (verificar JWT de Supabase) — hoy es abierto.
4. Empaquetar como app nativa con Capacitor (`@capacitor/camera` para la cámara).
5. Etiquetas QR para cajas del trastero (escanear -> ver/editar contenido).
6. Pulir diseño de pantallas y estados vacíos.
7. (Aparcado — solo si hay latencia real) Caché local de los objetos del hogar para
   buscar sin ir a Supabase en cada consulta. NO por escala (la RPC ya filtra por
   hogar_id con índice + RLS; miles de objetos de otros hogares no afectan). Diseño:
   IndexedDB (no localStorage: los embeddings ~6 KB c/u lo desbordan), + trigger en BD
   que suba `hogares.actualizado` al cambiar items -> el cliente compara ese timestamp
   y re-descarga solo si cambió -> coseno en local. Ojo: seguiría necesitando 1 llamada
   a Gemini por búsqueda (embeber la query).

## Trampas conocidas

- Web Speech API no existe en todos los navegadores (Firefox limitado). Hay guarda
  con aviso; en móvil real (Capacitor) usar un plugin de reconocimiento de voz.
- El plan gratuito de Gemini puede usar los datos para entrenar; si esto escala a
  muchos usuarios con fotos ajenas, pasar al plan de pago (no entrena con tus datos).
- `capture="environment"` solo activa cámara trasera en móvil; en escritorio abre
  selector de archivos. Es el comportamiento esperado.
