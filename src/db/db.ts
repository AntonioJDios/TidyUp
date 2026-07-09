import { supabase } from '../services/supabase';
import { getHogarActual } from '../services/home';

// Un objeto guardado en algún lugar de la casa. La ubicación se descompone en
// habitación -> almacenaje -> ubicación (sitio dentro del almacenaje).
export interface Item {
  id: string;
  nombre: string;          // "Pilas AA"
  habitacion: string;      // "Dormitorio"
  almacenaje: string;      // "Cómoda"
  ubicacion: string;       // "Segundo cajón"
  categoria?: string;      // "Electrónica", "Documentos"...
  etiquetas?: string[];    // ["pilas", "recambio"]
  notas?: string;
  foto_path?: string | null; // ruta en el bucket 'fotos' (no la imagen)
  embedding?: number[];    // vector para búsqueda RAG
  creado: string;          // ISO timestamptz
  actualizado: string;
}

export type NuevoItem = {
  nombre: string;
  habitacion: string;
  almacenaje: string;
  ubicacion: string;
  categoria?: string;
  etiquetas?: string[];
  notas?: string;
};

export async function addItem(item: NuevoItem): Promise<string> {
  const hogar_id = await getHogarActual();
  if (!hogar_id) throw new Error('SIN_HOGAR');
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('items')
    .insert({
      hogar_id,
      nombre: item.nombre,
      habitacion: item.habitacion ?? '',
      almacenaje: item.almacenaje ?? '',
      ubicacion: item.ubicacion ?? '',
      categoria: item.categoria ?? '',
      etiquetas: item.etiquetas ?? [],
      notas: item.notas ?? '',
      creado_por: userData.user?.id ?? null
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateItem(id: string, cambios: Partial<Item>): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ ...cambios, actualizado: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const item = await getItem(id);
  if (item?.foto_path) {
    await supabase.storage.from('fotos').remove([item.foto_path]);
  }
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

export async function getItem(id: string): Promise<Item | undefined> {
  const { data, error } = await supabase.from('items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export async function allItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('creado', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// --- FOTOS (Storage privado) ---

// Sube una foto (dataURL) al bucket privado y devuelve su path. Ruta: <hogar>/<item>.jpg
export async function subirFoto(itemId: string, dataUrl: string): Promise<string> {
  const hogar_id = await getHogarActual();
  if (!hogar_id) throw new Error('SIN_HOGAR');
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${hogar_id}/${itemId}.jpg`;
  const { error } = await supabase.storage
    .from('fotos')
    .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
  if (error) throw error;
  return path;
}

// URL firmada temporal (1 h) para mostrar una foto privada.
export async function fotoUrl(path?: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const { data, error } = await supabase.storage.from('fotos').createSignedUrl(path, 60 * 60);
  if (error) return undefined;
  return data.signedUrl;
}

// Texto legible de la ubicación completa: "Dormitorio · Cómoda · Segundo cajón".
export function ubicacionTexto(i: Pick<Item, 'habitacion' | 'almacenaje' | 'ubicacion'>): string {
  return [i.habitacion, i.almacenaje, i.ubicacion]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

// --- Reutilización de valores ya usados (para chips en el formulario) ---
async function distintos(campo: 'habitacion' | 'almacenaje'): Promise<string[]> {
  const items = await allItems();
  return Array.from(new Set(items.map((i) => i[campo]).filter(Boolean))).sort();
}
export const knownHabitaciones = () => distintos('habitacion');
export const knownAlmacenajes = () => distintos('almacenaje');
