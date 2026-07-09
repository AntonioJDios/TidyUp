import { allItems, type Item } from '../db/db';
import { generarEmbedding } from './gemini';

export interface Resultado {
  item: Item;
  score: number; // 0..1 (mayor = más relevante)
}

// Similitud coseno entre dos vectores.
function coseno(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Búsqueda de texto simple (fallback sin IA).
function coincideTexto(item: Item, q: string): boolean {
  const hay = [
    item.nombre,
    item.ubicacion,
    item.categoria ?? '',
    (item.etiquetas ?? []).join(' '),
    item.notas ?? ''
  ].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

// Búsqueda principal:
// - Con clave de Gemini y embeddings guardados -> RAG (similitud semántica).
// - Si no, búsqueda de texto normal.
export async function buscar(query: string): Promise<Resultado[]> {
  const items = await allItems();
  const q = query.trim();
  if (!q) return items.map((item) => ({ item, score: 1 }));

  const conVector = items.filter((i) => i.embedding && i.embedding.length > 0);

  if (conVector.length > 0) {
    try {
      const qVec = await generarEmbedding(q);
      const ranked = conVector
        .map((item) => ({ item, score: coseno(qVec, item.embedding!) }))
        .sort((a, b) => b.score - a.score);

      // Nos quedamos con lo razonablemente parecido; si nada supera el umbral,
      // devolvemos igualmente los mejores para no dejar al usuario sin nada.
      const relevantes = ranked.filter((r) => r.score >= 0.55);
      const base = relevantes.length > 0 ? relevantes : ranked.slice(0, 5);

      // Añadimos coincidencias de texto que la semántica pudiera haberse dejado.
      const textuales = items
        .filter((i) => coincideTexto(i, q) && !base.some((b) => b.item.id === i.id))
        .map((item) => ({ item, score: 0.5 }));

      return [...base, ...textuales];
    } catch {
      // Si la IA falla, caemos al texto.
    }
  }

  return items
    .filter((i) => coincideTexto(i, q))
    .map((item) => ({ item, score: 1 }));
}

// Texto que representa a un objeto para generar su embedding.
export function textoParaEmbedding(item: {
  nombre: string; ubicacion: string; categoria?: string; etiquetas?: string[]; notas?: string;
}): string {
  return [
    `Objeto: ${item.nombre}`,
    `Ubicación: ${item.ubicacion}`,
    item.categoria ? `Categoría: ${item.categoria}` : '',
    item.etiquetas?.length ? `Etiquetas: ${item.etiquetas.join(', ')}` : '',
    item.notas ? `Notas: ${item.notas}` : ''
  ].filter(Boolean).join('. ');
}
