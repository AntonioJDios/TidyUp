import Dexie, { type Table } from 'dexie';

// Un objeto guardado en algún lugar de la casa.
export interface Item {
  id?: number;
  nombre: string;          // "Pilas AA"
  ubicacion: string;       // "Cajón del pasillo"
  categoria?: string;      // "Electrónica", "Documentos"...
  etiquetas?: string[];    // ["pilas", "recambio"]
  notas?: string;
  foto?: string;           // dataURL (base64) opcional
  embedding?: number[];    // vector para búsqueda RAG
  creado: number;          // timestamp
  actualizado: number;
}

class AppDB extends Dexie {
  items!: Table<Item, number>;

  constructor() {
    super('dondeLoGuarde');
    this.version(1).stores({
      // Índices: id autoincremental + campos por los que filtramos/ordenamos.
      items: '++id, nombre, ubicacion, categoria, creado'
    });
  }
}

export const db = new AppDB();

export async function addItem(item: Omit<Item, 'id' | 'creado' | 'actualizado'>): Promise<number> {
  const now = Date.now();
  return db.items.add({ ...item, creado: now, actualizado: now });
}

export async function updateItem(id: number, cambios: Partial<Item>): Promise<void> {
  await db.items.update(id, { ...cambios, actualizado: Date.now() });
}

export async function deleteItem(id: number): Promise<void> {
  await db.items.delete(id);
}

export async function getItem(id: number): Promise<Item | undefined> {
  return db.items.get(id);
}

export async function allItems(): Promise<Item[]> {
  return db.items.orderBy('creado').reverse().toArray();
}

// Lista de ubicaciones ya usadas (para reutilizar y no reescribir).
export async function knownLocations(): Promise<string[]> {
  const items = await db.items.toArray();
  const set = new Set(items.map((i) => i.ubicacion).filter(Boolean));
  return Array.from(set).sort();
}
