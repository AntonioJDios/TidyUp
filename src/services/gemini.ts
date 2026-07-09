// Servicio de IA con Google Gemini.
//
// La clave NO vive en el cliente. Está en la variable de entorno GEMINI_KEY
// del servidor y solo la usa la función serverless `/api/gemini` (ver api/gemini.ts).
// El navegador llama a esa función; nunca habla con Google directamente ni conoce
// la clave. Así nadie tiene que configurar nada en su dispositivo.
//
// Modelos por defecto. Si Google publica versiones nuevas, cámbialos aquí
// o desde la pantalla de Ajustes (se guardan en localStorage del navegador).
const DEFAULT_TEXT_MODEL = 'gemini-2.0-flash';
const DEFAULT_EMBED_MODEL = 'text-embedding-004';

const TEXT_MODEL_STORAGE = 'gemini_text_model';
const EMBED_MODEL_STORAGE = 'gemini_embed_model';

// Endpoint de nuestra función serverless (mismo origen que la app).
const API_PROXY = '/api/gemini';

export function getTextModel(): string {
  return localStorage.getItem(TEXT_MODEL_STORAGE) || DEFAULT_TEXT_MODEL;
}
export function getEmbedModel(): string {
  return localStorage.getItem(EMBED_MODEL_STORAGE) || DEFAULT_EMBED_MODEL;
}
export function setModels(text: string, embed: string): void {
  localStorage.setItem(TEXT_MODEL_STORAGE, text || DEFAULT_TEXT_MODEL);
  localStorage.setItem(EMBED_MODEL_STORAGE, embed || DEFAULT_EMBED_MODEL);
}

export interface ConceptoExtraido {
  nombre: string;
  ubicacion: string;
  categoria?: string;
  etiquetas?: string[];
}

async function generateContent(parts: unknown[]): Promise<string> {
  const res = await fetch(API_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'generar', model: getTextModel(), parts })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`IA ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data?.text ?? '';
}

function parseJson<T>(raw: string): T {
  // Gemini a veces envuelve el JSON en ```json ... ```; lo limpiamos.
  const clean = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(clean) as T;
}

// A partir de texto libre ("guardo las pilas AA en el cajón del pasillo")
// extrae objeto + ubicación + categoría + etiquetas.
export async function extraerConcepto(texto: string): Promise<ConceptoExtraido> {
  const prompt = `Eres el asistente de una app para recordar dónde se guardan las cosas en casa.
Analiza esta frase en español y extrae la información. Responde SOLO con JSON válido con estas claves:
- "nombre": el objeto que se guarda (string, singular o plural según corresponda)
- "ubicacion": dónde se guarda (string; deja "" si no se menciona)
- "categoria": una categoría breve en español (ej. "Herramientas", "Documentos", "Electrónica", "Cocina", "Ropa"; "" si no aplica)
- "etiquetas": array de 1 a 4 palabras clave útiles para buscarlo luego

Frase: "${texto}"`;
  const raw = await generateContent([{ text: prompt }]);
  return parseJson<ConceptoExtraido>(raw);
}

// Reconoce el objeto principal de una foto (dataURL base64) y sugiere datos.
export async function reconocerFoto(dataUrl: string): Promise<ConceptoExtraido> {
  const [meta, base64] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg';
  const prompt = `Mira esta foto de un objeto o una caja. Responde SOLO con JSON con las claves:
"nombre" (qué es, en español), "ubicacion" (""), "categoria" (breve, en español), "etiquetas" (array de 1 a 4 palabras clave en español).`;
  const raw = await generateContent([
    { text: prompt },
    { inlineData: { mimeType: mime, data: base64 } }
  ]);
  return parseJson<ConceptoExtraido>(raw);
}

// Genera el vector de embedding de un texto (para la búsqueda RAG).
export async function generarEmbedding(texto: string): Promise<number[]> {
  const res = await fetch(API_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'embed', model: getEmbedModel(), texto })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embedding ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data?.values ?? [];
}
