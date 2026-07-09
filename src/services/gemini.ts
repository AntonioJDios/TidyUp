import { supabase } from './supabase';

// Servicio de IA con Google Gemini.
//
// La clave NO vive en el cliente. Está en la variable de entorno GEMINI_KEY
// del servidor y solo la usa la función serverless `/api/gemini` (ver api/gemini.ts).
// El navegador llama a esa función; nunca habla con Google directamente ni conoce
// la clave. Así nadie tiene que configurar nada en su dispositivo.
//
// Modelos por defecto. Si Google publica versiones nuevas, cámbialos aquí
// o desde la pantalla de Ajustes (se guardan en localStorage del navegador).
const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';
const DEFAULT_EMBED_MODEL = 'gemini-embedding-001';
// Modelos deprecados que pudieran haber quedado guardados en localStorage.
const EMBED_DEPRECADOS = ['text-embedding-004'];

const TEXT_MODEL_STORAGE = 'gemini_text_model';
const EMBED_MODEL_STORAGE = 'gemini_embed_model';

// Endpoint de nuestra función serverless (mismo origen que la app).
const API_PROXY = '/api/gemini';

// Llama al proxy adjuntando el token de sesión de Supabase, para que la función
// pueda comprobar que quien llama es un usuario logueado de la app (y no gastar
// la clave de Gemini con peticiones anónimas de fuera).
async function llamarProxy(body: unknown): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(API_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`IA ${res.status}: ${t}`);
  }
  return res.json();
}

export function getTextModel(): string {
  return localStorage.getItem(TEXT_MODEL_STORAGE) || DEFAULT_TEXT_MODEL;
}
export function getEmbedModel(): string {
  const guardado = localStorage.getItem(EMBED_MODEL_STORAGE);
  if (!guardado || EMBED_DEPRECADOS.includes(guardado)) return DEFAULT_EMBED_MODEL;
  return guardado;
}
export function setModels(text: string, embed: string): void {
  localStorage.setItem(TEXT_MODEL_STORAGE, text || DEFAULT_TEXT_MODEL);
  localStorage.setItem(EMBED_MODEL_STORAGE, embed || DEFAULT_EMBED_MODEL);
}

export interface ConceptoExtraido {
  nombre: string;      // el objeto que se guarda
  habitacion: string;  // habitación (dormitorio, cocina, trastero…)
  almacenaje: string;  // mueble/contenedor (cómoda, armario, estantería…)
  ubicacion: string;   // sitio dentro del almacenaje (segundo cajón, balda de arriba…)
  categoria?: string;
  etiquetas?: string[];
}

async function generateContent(parts: unknown[]): Promise<string> {
  const data = await llamarProxy({ tipo: 'generar', model: getTextModel(), parts });
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
- "habitacion": la habitación de la casa donde se guarda (ej. "dormitorio", "cocina", "salón", "trastero", "garaje"; "" si no se menciona)
- "almacenaje": el mueble o contenedor donde se guarda (ej. "cómoda", "armario", "estantería", "cajonera", "caja"; "" si no se menciona)
- "ubicacion": el sitio o la POSICIÓN concreta respecto al almacenaje, tanto dentro como fuera (ej. "segundo cajón", "balda de arriba", "estante inferior", "encima", "debajo", "detrás", "al lado", "colgado"; "" si no se menciona)
- "categoria": una categoría breve en español (ej. "Herramientas", "Documentos", "Electrónica", "Cocina", "Ropa"; "" si no aplica)
- "etiquetas": array de 1 a 4 palabras clave útiles para buscarlo luego

Interpreta la frase aunque esté mal transcrita o incompleta, deduciendo la intención.

Ejemplo 1: "guardo el pasaporte en el segundo cajón de la cómoda del dormitorio" ->
{"nombre":"pasaporte","habitacion":"dormitorio","almacenaje":"cómoda","ubicacion":"segundo cajón","categoria":"Documentos","etiquetas":["pasaporte","documento","identificación"]}
Ejemplo 2: "he dejado los zapatos de deporte encima del armario del cuarto de dormir" ->
{"nombre":"zapatos de deporte","habitacion":"dormitorio","almacenaje":"armario","ubicacion":"encima","categoria":"Calzado","etiquetas":["zapatos","deporte","zapatillas"]}

Frase: "${texto}"`;
  const raw = await generateContent([{ text: prompt }]);
  return parseJson<ConceptoExtraido>(raw);
}

// Reconoce el objeto principal de una foto (dataURL base64) y sugiere datos.
export async function reconocerFoto(dataUrl: string): Promise<ConceptoExtraido> {
  const [meta, base64] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg';
  const prompt = `Mira esta foto de un objeto o una caja. Responde SOLO con JSON con las claves:
"nombre" (qué es, en español), "habitacion" (""), "almacenaje" (""), "ubicacion" (""), "categoria" (breve, en español), "etiquetas" (array de 1 a 4 palabras clave en español).
La foto solo dice QUÉ es el objeto, no dónde se guarda: deja "habitacion", "almacenaje" y "ubicacion" como "".`;
  const raw = await generateContent([
    { text: prompt },
    { inlineData: { mimeType: mime, data: base64 } }
  ]);
  return parseJson<ConceptoExtraido>(raw);
}

// Genera el vector de embedding de un texto (para la búsqueda RAG).
export async function generarEmbedding(texto: string): Promise<number[]> {
  const data = await llamarProxy({ tipo: 'embed', model: getEmbedModel(), texto });
  return data?.values ?? [];
}
