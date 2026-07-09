import { allItems, setEmbedding, type Item } from '../db/db';
import { generarEmbedding } from './gemini';
import { supabase } from './supabase';
import { getHogarActual } from './home';

export interface Resultado {
  item: Item;
  score: number; // 0..1 (mayor = más relevante)
}

// Normaliza para comparar: minúsculas y sin acentos ("eléctrica" -> "electrica").
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Palabras vacías de preguntas ("¿dónde está la...?") que no aportan a la búsqueda.
// (Ya normalizadas, sin acentos.)
const STOPWORDS = new Set([
  'donde', 'esta', 'estan', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'en', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'se', 'que', 'cual',
  'cuales', 'y', 'o', 'a', 'lo', 'me', 'he', 'has', 'guarde', 'guardado', 'puse',
  'deje', 'dejado', 'tengo', 'hay', 'estaba', 'encuentro', 'busco', 'buscar', 'esta'
]);

// Palabras "de contenido" de una consulta (quita relleno). Si todo era relleno,
// devuelve las originales para no quedarnos sin nada que buscar.
function palabrasContenido(q: string): string[] {
  const todas = norm(q).split(/\s+/).filter(Boolean);
  const utiles = todas.filter((w) => !STOPWORDS.has(w));
  return utiles.length > 0 ? utiles : todas;
}

// Distancia de edición (Levenshtein) para tolerar erratas y variantes.
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + coste);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// ¿La palabra buscada casa con algún token del objeto? Substring en cualquier
// dirección o distancia de edición pequeña (tolerante a variantes: mantita/mantota).
function palabraCasa(w: string, tokens: string[]): boolean {
  const tol = w.length <= 3 ? 0 : w.length <= 4 ? 1 : 2;
  return tokens.some((t) =>
    t.includes(w) || w.includes(t) || levenshtein(t, w) <= tol
  );
}

// Búsqueda de texto tolerante (fallback sin IA / sin embeddings): sin acentos y
// con fuzzy, de modo que "manta electrica" o "mantota" encuentren "mantita eléctrica".
function coincideTexto(item: Item, q: string): boolean {
  const tokens = norm([
    item.nombre, item.habitacion, item.almacenaje, item.ubicacion,
    item.categoria ?? '', (item.etiquetas ?? []).join(' '), item.notas ?? ''
  ].join(' ')).split(/\s+/).filter(Boolean);

  return palabrasContenido(q).every((w) => palabraCasa(w, tokens));
}

// Búsqueda principal:
// - Embebe la consulta y busca por similitud coseno en el servidor (pgvector).
// - Si falla o no hay embeddings, cae a búsqueda de texto local.
// Umbral mínimo de similitud coseno (0..1). Por debajo, no se considera relevante.
// Ajustable: súbelo si aparecen cosas no relacionadas, bájalo si se queda corto.
const UMBRAL = 0.6;

export async function buscar(query: string): Promise<Resultado[]> {
  const q = query.trim();
  const items = await allItems();
  if (!q) return items.map((item) => ({ item, score: 1 }));

  // Coincidencias de texto (recall literal: acentos/prefijos), siempre válidas.
  const textuales = items.filter((i) => coincideTexto(i, q));

  const hogar_id = await getHogarActual();
  if (hogar_id) {
    try {
      const qVec = await generarEmbedding(q);
      if (qVec.length) {
        const { data, error } = await supabase.rpc('buscar_items', {
          // pgvector vía la API requiere el vector como string "[...]", no array.
          query_embedding: JSON.stringify(qVec),
          h: hogar_id,
          limite: 20
        });
        if (!error && data) {
          const filas = data as Array<Item & { score: number }>;
          // Solo lo que supera el umbral. Si nada lo supera, NO se rellena con
          // "los menos malos": buscar "perro" sin perros no debe devolver la manta.
          const semanticos = filas.filter((r) => r.score >= UMBRAL);
          const ids = new Set(semanticos.map((r) => r.id));
          const soloTexto = textuales
            .filter((i) => !ids.has(i.id))
            .map((item) => ({ item, score: 0.5 }));
          return [...semanticos.map((r) => ({ item: r as Item, score: r.score })), ...soloTexto]
            .sort((a, b) => b.score - a.score);
        }
      }
    } catch {
      // Si la IA/RPC falla, caemos solo a texto.
    }
  }

  return textuales.map((item) => ({ item, score: 1 }));
}

// Regenera el embedding de los objetos que no lo tengan (p. ej. guardados cuando
// la IA falló). Devuelve cuántos se han reindexado de los que faltaban.
export async function reindexarItems(): Promise<{ hechos: number; faltaban: number; error?: string }> {
  const items = await allItems();
  const faltan = items.filter((i) => !i.embedding);
  let hechos = 0;
  let error: string | undefined;
  for (const it of faltan) {
    try {
      const vec = await generarEmbedding(textoParaEmbedding(it));
      if (vec.length) { await setEmbedding(it.id, vec); hechos++; }
      else if (!error) error = 'La IA devolvió un embedding vacío.';
    } catch (e: any) {
      if (!error) error = String(e?.message ?? e); // guardamos el primer error real
    }
  }
  return { hechos, faltaban: faltan.length, error };
}

// Texto que representa a un objeto para generar su embedding.
export function textoParaEmbedding(item: {
  nombre: string; habitacion: string; almacenaje: string; ubicacion: string;
  categoria?: string; etiquetas?: string[]; notas?: string;
}): string {
  return [
    `Objeto: ${item.nombre}`,
    item.habitacion ? `Habitación: ${item.habitacion}` : '',
    item.almacenaje ? `Almacenaje: ${item.almacenaje}` : '',
    item.ubicacion ? `Ubicación: ${item.ubicacion}` : '',
    item.categoria ? `Categoría: ${item.categoria}` : '',
    item.etiquetas?.length ? `Etiquetas: ${item.etiquetas.join(', ')}` : '',
    item.notas ? `Notas: ${item.notas}` : ''
  ].filter(Boolean).join('. ');
}
