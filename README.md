# TidyUp

PWA para recordar **dónde guardas las cosas en casa**. Dictas o fotografías lo que
guardas, la IA (Google Gemini) extrae *qué* y *dónde*, y luego lo encuentras con
búsqueda inteligente (RAG) — aunque no recuerdes las palabras exactas.

Hecho con **Ionic + React + Vite + TypeScript**. Funciona como app web instalable
(PWA) y está lista para empaquetar como app móvil con Capacitor.

## Puesta en marcha

```bash
npm install
npm run dev       # desarrollo (http://localhost:5173)
npm run build     # build de producción (carpeta dist/)
npm run preview   # previsualizar el build
```

## Activar la IA

1. Consigue una clave gratis en Google AI Studio: https://aistudio.google.com/apikey
2. Abre la app → **Ajustes** → pega la clave → Guardar.
3. La clave se guarda solo en tu dispositivo (localStorage). Nunca sale al código.

Sin clave, la app funciona igualmente: guardas cosas a mano y buscas por texto.
Con clave, se encienden la voz, el reconocimiento de fotos y la búsqueda semántica.

## Cómo funciona por dentro

- **Datos**: IndexedDB (vía Dexie) en `src/db/db.ts`. Todo local, offline.
- **IA**: `src/services/gemini.ts` — extracción de conceptos, visión y embeddings.
- **Búsqueda RAG**: `src/services/search.ts` — similitud coseno sobre embeddings,
  con fallback a búsqueda de texto.
- **Pantallas**: `src/pages/` — Inicio, Añadir, Detalle, Ajustes.

## Convertir en app móvil (siguiente paso)

```bash
npm install @capacitor/core @capacitor/cli
npx cap init TidyUp com.tidyup.app
npm run build && npx cap add ios && npx cap add android
```

## Notas

- Los nombres de modelo por defecto (`gemini-2.0-flash`, `text-embedding-004`) se
  pueden cambiar en Ajustes si Google publica versiones nuevas.
- El dictado usa la API de voz del navegador (gratis, sin coste de IA).
