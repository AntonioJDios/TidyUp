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
- **Dexie 4** sobre IndexedDB para persistencia local (offline-first).
- **Google Gemini** vía REST, a través de una función serverless propia (`api/gemini.ts`),
  no directamente desde el navegador (así la clave no se expone).
- **Vercel** para el deploy (estático + función serverless en `/api`).
- Iconos: `ionicons`.

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
src/
  main.tsx              # bootstrap React
  App.tsx               # IonApp + rutas (/home /add /item/:id /settings)
  theme/variables.css   # color primario #3b5bdb
  db/db.ts              # Dexie: modelo Item + CRUD + knownLocations()
  services/
    gemini.ts           # IA (cliente): llama a /api/gemini; extraerConcepto, reconocerFoto, generarEmbedding
    search.ts           # RAG: buscar() por coseno + fallback texto
  pages/
    Home.tsx            # búsqueda + recientes + FAB "+"
    AddItem.tsx         # voz + foto + texto -> IA rellena campos -> guardar
    ItemDetail.tsx      # ver/borrar
    Settings.tsx        # modelos de Gemini (localStorage); la clave NO, va en el server
public/                 # favicon.svg, icon-192.png, icon-512.png
vercel.json             # rewrite SPA (todo -> index.html)
```

## Cómo funciona

- **Modelo de datos** (`db/db.ts`): `Item { nombre, ubicacion, categoria?,
  etiquetas?, notas?, foto?(dataURL), embedding?(number[]), creado, actualizado }`.
- **Añadir** (`AddItem.tsx`):
  1. Voz: Web Speech API del navegador (`webkitSpeechRecognition`, `lang=es-ES`).
     Gratis, no consume cuota de IA. Al terminar, la transcripción va a `interpretar()`.
  2. `interpretar(frase)` -> `extraerConcepto()` -> rellena nombre/ubicacion/categoria/etiquetas.
  3. Foto: `<input type=file capture=environment>` -> dataURL -> `reconocerFoto()`.
  4. Al guardar: se crea el Item y **después** se genera el embedding en segundo
     plano (no bloquea el guardado). Si falla, el objeto igual se busca por texto.
- **Buscar** (`search.ts`): si hay embeddings guardados, embebe la query y ordena
  por similitud coseno (umbral 0.55, con fallback a top-5); si falla o no hay, texto.
- **IA** (`gemini.ts` + `api/gemini.ts`): el cliente **no** conoce la clave. Llama a
  la función serverless `/api/gemini`, que habla con Google usando `GEMINI_KEY`
  (variable de entorno del servidor en Vercel, nunca en el cliente). Así nadie
  configura nada en su dispositivo. Solo los nombres de modelo viven en `localStorage`
  (`gemini_text_model`, `gemini_embed_model`); defaults `gemini-2.0-flash` (texto/visión)
  y `text-embedding-004` (embeddings). Endpoint Google `v1beta`. `generateContent`
  fuerza `responseMimeType: application/json`. **Aviso:** `/api/gemini` no tiene auth
  → proxy abierto; aceptable para uso familiar, al abrir al público añadir login/rate-limiting.

## Convenciones

- Todo el texto de UI y los comentarios, en **español**.
- La clave de Gemini **nunca** en código ni en git: es la variable de entorno
  `GEMINI_KEY` en Vercel (server-side). En local, `.env` (ignorado por git).
- Ionic usa **react-router v5** — no migrar a v6 (rompe `IonRouterOutlet`).
- Los campos de la petición a Gemini van en **camelCase** (`inlineData`, `mimeType`).
- Toda llamada a Gemini pasa por `api/gemini.ts`; el cliente nunca llama a Google
  directamente. Mantener ese único punto de entrada (facilita mover a Supabase luego).
- El único backend es la función `/api/gemini`. El resto sigue siendo cliente/offline.

## Estado actual

Hecho: scaffold completo, CRUD local, integración Gemini (texto/voz/foto/embeddings),
búsqueda RAG con fallback, las 4 pantallas, PWA + iconos, README.
**Build verificado** (`npm install && npm run build` OK, sin errores de tipos).
Repo en GitHub (`AntonioJDios/TidyUp`, rama `main`).
La IA ya pasa por la función serverless `/api/gemini` (clave en `GEMINI_KEY`).

**Pendiente de verificar**: probar el flujo real desplegado en Vercel con la
`GEMINI_KEY` configurada (voz, foto, búsqueda) en un móvil real.

## Próximos pasos sugeridos (en orden)

1. Desplegar en Vercel (importar repo de GitHub) y configurar la variable de
   entorno `GEMINI_KEY`. Probar el flujo real (voz, foto, búsqueda) en el móvil.
2. Optimizar el bundle (1.25 MB): code-splitting / `manualChunks` (aviso de Vite).
3. Empaquetar como app nativa con Capacitor:
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init TidyUp com.tidyup.app
   npm run build && npx cap add ios && npx cap add android
   ```
   Para la cámara nativa, considerar `@capacitor/camera` en vez del input HTML.
4. Sincronización entre dispositivos (pareja/familia): migrar de solo-IndexedDB a
   Supabase (`pgvector` para los embeddings) manteniendo el modo offline.
5. Etiquetas QR para cajas del trastero (escanear -> ver/editar contenido).
6. Pulir diseño de pantallas y estados vacíos.

## Trampas conocidas

- Web Speech API no existe en todos los navegadores (Firefox limitado). Hay guarda
  con aviso; en móvil real (Capacitor) usar un plugin de reconocimiento de voz.
- El plan gratuito de Gemini puede usar los datos para entrenar; si esto escala a
  muchos usuarios con fotos ajenas, pasar al plan de pago (no entrena con tus datos).
- `capture="environment"` solo activa cámara trasera en móvil; en escritorio abre
  selector de archivos. Es el comportamiento esperado.
