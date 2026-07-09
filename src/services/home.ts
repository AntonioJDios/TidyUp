import { supabase } from './supabase';

// Gestión del "hogar" (espacio compartido). Un usuario puede pertenecer a uno o
// varios hogares; guardamos el activo en memoria + localStorage.

export interface Hogar {
  id: string;
  nombre: string;
  codigo_invitacion: string;
  creado: string;
}

const HOGAR_STORAGE = 'hogar_id';
let hogarCache: string | null = null;

export async function getMisHogares(): Promise<Hogar[]> {
  const { data, error } = await supabase.from('hogares').select('*').order('creado');
  if (error) throw error;
  return data ?? [];
}

// Devuelve el id del hogar activo, o null si el usuario aún no pertenece a ninguno.
export async function getHogarActual(): Promise<string | null> {
  if (hogarCache) return hogarCache;
  const cached = localStorage.getItem(HOGAR_STORAGE);
  const hogares = await getMisHogares();
  if (hogares.length === 0) return null;
  // Si el cacheado sigue siendo válido, lo usamos; si no, el primero.
  const elegido = hogares.find((h) => h.id === cached) ?? hogares[0];
  setHogarActual(elegido.id);
  return elegido.id;
}

export function setHogarActual(id: string): void {
  hogarCache = id;
  localStorage.setItem(HOGAR_STORAGE, id);
}

export function olvidarHogar(): void {
  hogarCache = null;
  localStorage.removeItem(HOGAR_STORAGE);
}

export async function crearHogar(nombre: string): Promise<Hogar> {
  const { data, error } = await supabase.rpc('crear_hogar', { nombre });
  if (error) throw error;
  const hogar = data as Hogar;
  setHogarActual(hogar.id);
  return hogar;
}

export async function unirseAHogar(codigo: string): Promise<Hogar> {
  const { data, error } = await supabase.rpc('unirse_a_hogar', { codigo });
  if (error) throw error;
  const hogar = data as Hogar;
  setHogarActual(hogar.id);
  return hogar;
}
