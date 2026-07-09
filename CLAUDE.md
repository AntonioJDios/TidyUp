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
  gemini.ts             # función serverless Vercel: proxy a Gemini (usa GEMINI_KEY); valida sesión + rate limit
supabase/
  schema.sql            # esquema BD (hogares/miembros/items+vector) + RLS + RPC + Storage + rate limit. Ejecutar en SQL Editor.
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
    search.ts           # RAG: RPC buscar_items (pgvector, umbral 0.6) + fallback texto fuzzy (Levenshtein, stopwords); textoParaEmbedding
    voz.ts              # Web Speech: escuchar() (STT) + hablar() (TTS)
  pages/
    Login.tsx           # login por email + contraseña
    Onboarding.tsx      # crear hogar / unirse por código
    Home.tsx            # búsqueda + preguntar por voz (responde con voz+texto) + recientes + FAB "+"
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
  pgvector). Solo devuelve lo que supera el **umbral 0.6** (sin relleno de "top-N"), más
  coincidencias de **texto fuzzy** (sin acentos, Levenshtein, quitando stopwords de
  preguntas). Si la IA/RPC falla, solo texto.
- **Preguntar por voz** (`Home.tsx` + `voz.ts`): botón que escucha una pregunta
  ("¿dónde está la mantita eléctrica?"), busca, y **responde por voz (TTS) y en texto**.
  Si hay varios resultados (mismo objeto en distintos sitios) los menciona todos con su
  **fecha de guardado** (hasta 3 + "y N más"). La lista también muestra la fecha por fila.
- **IA** (`gemini.ts` + `api/gemini.ts`): el cliente **no** conoce la clave. Llama a
  la función serverless `/api/gemini`, que habla con Google usando `GEMINI_KEY`
  (variable de entorno del servidor en Vercel, nunca en el cliente). Así nadie
  configura nada en su dispositivo. Solo los nombres de modelo viven en `localStorage`
  (`gemini_text_model`, `gemini_embed_model`); defaults `gemini-2.5-flash` (texto/visión)
  y `gemini-embedding-001` (embeddings, forzado a 768 dims para casar con `vector(768)`). Endpoint Google `v1beta`. `generateContent`
  fuerza `responseMimeType: application/json`.
- **Auth + rate limiting** (`api/gemini.ts`): cada llamada adjunta el token de sesión
  de Supabase. La función llama a la RPC `consumir_cuota_ia(limite)` que **valida la
  sesión (auth.uid()) Y suma 1 al uso diario** en una sola llamada: sin token válido ->
  401; si el usuario supera el límite/día -> 429. El límite es la variable de entorno
  **`IA_LIMITE_DIARIO`** en Vercel (default 1000 para pruebas; poner ~200 en público).
  Así solo usuarios logueados
  gastan la clave y ningún abusón dispara la factura. El contador vive en la tabla
  `ia_uso` (una fila por usuario y día).

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

Hecho: app completa sobre **Supabase** (auth email+contraseña + hogar compartido + datos
con RLS + búsqueda RAG con pgvector), IA vía `/api/gemini` con **auth + rate limiting**,
proxy `/sb` anti-bloqueo, modelo de ubicación en 3 niveles (habitación/almacenaje/
ubicación), preguntar por voz con respuesta hablada. Las **fotos** existen en el código
(Storage privado) pero el botón está pensado para dejarse como **premium** (son el mayor
coste de storage; ahora mismo uso residual sin fotos).
**Build verificado** (`npm run build` OK, sin errores de tipos). Repo en GitHub
(`AntonioJDios/TidyUp`, rama `main`).

**Pendiente de verificar (setup manual en Supabase + prueba real):**
1. Ejecutar `supabase/schema.sql` en el SQL Editor de Supabase. **Re-ejecutar tras
   cualquier cambio del esquema** (es idempotente); incluye la tabla `ia_uso` y la RPC
   `consumir_cuota_ia` del rate limiting — sin ellas, `/api/gemini` responde 401.
2. Auth -> Providers -> Email: activado y **desactivar "Confirm email"** (para que el
   registro con email+contraseña inicie sesión al momento, sin enviar correo).
3. Confirmar `GEMINI_KEY` en Vercel (facturación de Gemini activa; free tier no va en UE).
4. Probar en el móvil el flujo completo: crear cuenta -> crear hogar -> guardar (voz)
   -> buscar / preguntar por voz. Y que la pareja se une con el código de invitación.

## Modelo de negocio (previsto, NO implementado aún)

- **Freemium**: gratis hasta **~15 objetos**; **~5 €/año** por hogar para uso ilimitado
  (y, en su caso, fotos como extra premium). El límite de objetos **no está activado**
  todavía (ahora es de uso personal, sin límite). Se enciende al abrir al público.
- **Economía** (precios Gemini: 2.5-flash $0,075/M in + $0,30/M out; embedding-001
  $0,025/M): **guardar ≈ $0,00008**, **buscar ≈ despreciable**. Uso residual ->
  **~$0,0003/usuario/mes**; moderado -> **~$0,0025**. Una suscripción de 5 €/año cubre
  ~67.000 guardados. El coste de IA es **despreciable**; lo caro a escala son los fijos
  (Vercel/Supabase Pro) y las **fotos** (Storage) -> por eso las fotos van a premium.
  Supabase/Vercel gratis aguantan **miles** de usuarios **sin fotos**.
- **Riesgo real = picos/abuso**, no el uso normal -> por eso el rate limiting (ya hecho).
- Cuando se cobre: **Vercel Pro** (uso comercial) + **Stripe/RevenueCat**. GDPR (datos UE).

### Techo sin cobrar (cuántos usuarios aguanta gratis, sin fotos)
- El cuello de botella **no es Gemini** (a decenas de miles = unas pocas decenas de $/mes),
  sino la **BD de Supabase**: cada objeto con su embedding `vector(768)` ocupa ~6 KB
  (vector + índice HNSW) -> 500 MB free ≈ ~85.000 objetos ≈ **~1.000-3.000 usuarios**
  (según objetos/usuario). Ese es el primer muro.
- **100% gratis (0 €)**: ~1.000-3.000 usuarios activos. Vercel Hobby vale porque sin
  cobrar no es uso comercial. Gemini lo absorbes: ~$1-8/mes a esa escala.
- **Solo con Supabase Pro (~25 $/mes)**: BD 8 GB (~1,3M objetos) + 100k MAU ->
  **decenas de miles** de usuarios **sin cobrarles**. Siguiente muro: Auth MAU / banda Vercel.
- Conclusión: cobrar **no es por coste** (es ridículo), sino cuando quieras autofinanciar
  o sacar beneficio. Se puede tener miles de usuarios gratis indefinidamente.

## Próximos pasos sugeridos (en orden)

1. Completar el setup manual de arriba y validar el flujo end-to-end en el móvil.
2. Optimizar el bundle (~1.37 MB): code-splitting / `manualChunks` (aviso de Vite).
3. Decidir sobre las fotos: ocultar el botón (dejarlas como premium) o mantenerlas.
4. Al abrir al público: activar límite freemium (15 objetos) + pago (Stripe/RevenueCat).
5. Empaquetar como app nativa con Capacitor (`@capacitor/camera`). Ojo: en WebView de iOS
   el reconocimiento de voz NO va -> plugin nativo; y las rutas `/sb` y `/api` habría que
   volverlas absolutas (en nativo el HTML no se sirve desde Vercel).
6. Etiquetas QR para cajas del trastero (escanear -> ver/editar contenido).
7. Pulir diseño de pantallas y estados vacíos. Falta **editar** objetos (hoy: crear/borrar).
8. (Aparcado — solo si hay latencia real) Caché local de los objetos del hogar para
   buscar sin ir a Supabase en cada consulta. NO por escala (la RPC ya filtra por
   hogar_id con índice + RLS; miles de objetos de otros hogares no afectan). Diseño:
   IndexedDB (no localStorage: los embeddings ~6 KB c/u lo desbordan), + trigger en BD
   que suba `hogares.actualizado` al cambiar items -> el cliente compara ese timestamp
   y re-descarga solo si cambió -> coseno en local. Ojo: seguiría necesitando 1 llamada
   a Gemini por búsqueda (embeber la query).

## Trampas conocidas

- **Gemini en la UE no tiene free tier**: da error `429 limit: 0` con clave gratuita.
  Hay que activar **facturación** (de pago). El de pago **no** entrena con tus datos.
- **Los modelos de Gemini se deprecan**: `gemini-2.0-flash` y `text-embedding-004`
  dejaron de existir (404). Defaults actuales: `gemini-2.5-flash` y `gemini-embedding-001`.
  `getEmbedModel()` ignora modelos deprecados guardados en localStorage.
- **pgvector vía la API de Supabase**: el vector hay que mandarlo/leerlo como **string**
  `"[...]"`, no como array JS, o se guarda null sin avisar (ver `setEmbedding` y la RPC).
- **Embeddings**: `gemini-embedding-001` da 3072 dims por defecto; se fuerzan **768**
  (`outputDimensionality`) para casar con `vector(768)`. Si se cambia, migrar la columna.
- **Web Speech API** no existe en todos los navegadores (Firefox limitado). Hay guarda
  con aviso. En **WebView de iOS (Capacitor) el reconocimiento NO funciona** -> plugin nativo.
- `capture="environment"` solo activa cámara trasera en móvil; en escritorio abre
  selector de archivos. Es el comportamiento esperado.
- **PWA cachea (autoUpdate)**: tras desplegar, hay que cerrar/reabrir la app (o
  desregistrar el service worker) para ver la versión nueva.
