import { allItems, type Item } from '../db/db';
import { generarEmbedding } from './gemini';
import { supabase } from './supabase';
import { getHogarActual } from './home';

export interface Resultado {
  item: Item;
  score: number; // 0..1 (mayor = más relevante)
}

// Búsqueda de texto simple (fallback sin IA / sin embeddings).
function coincideTexto(item: Item, q: string): boolean {
  const hay = [
    item.nombre,
    item.habitacion,
    item.almacenaje,
    item.ubicacion,
    item.categoria ?? '',
    (item.etiquetas ?? []).join(' '),
    item.notas ?? ''
  ].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

// Búsqueda principal:
// - Embebe la consulta y busca por similitud coseno en el servidor (pgvector).
// - Si falla o no hay embeddings, cae a búsqueda de texto local.
export async function buscar(query: string): Promise<Resultado[]> {
  const q = query.trim();
  if (!q) {
    const items = await allItems();
    return items.map((item) => ({ item, score: 1 }));
  }

  const hogar_id = await getHogarActual();
  if (hogar_id) {
    try {
      const qVec = await generarEmbedding(q);
      if (qVec.length) {
        const { data, error } = await supabase.rpc('buscar_items', {
          query_embedding: qVec,
          h: hogar_id,
          limite: 20
        });
        if (!error && data && data.length > 0) {
          const filas = data as Array<Item & { score: number }>;
          const relevantes = filas.filter((r) => r.score >= 0.55);
          const base = relevantes.length > 0 ? relevantes : filas.slice(0, 5);
          return base.map((r) => ({ item: r, score: r.score }));
        }
      }
    } catch {
      // Si la IA/RPC falla, caemos al texto.
    }
  }

  const items = await allItems();
  return items.filter((i) => coincideTexto(i, q)).map((item) => ({ item, score: 1 }));
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
