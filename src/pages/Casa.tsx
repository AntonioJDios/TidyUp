import { useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonButton, IonAccordion, IonAccordionGroup, IonItem, IonLabel, IonNote, IonIcon, IonText,
  IonSearchbar, useIonViewWillEnter
} from '@ionic/react';
import { homeOutline, cubeOutline, fileTrayOutline, locationOutline, gitNetworkOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { allItems, type Item } from '../db/db';

// Árbol: habitación -> almacenaje -> ubicación -> objetos. Se genera SOLO a partir
// de lo que el usuario ya ha guardado (no dibuja nada a mano).
type Almacenaje = Record<string, Item[]>;
type Habitacion = Record<string, Almacenaje>;
type Arbol = Record<string, Habitacion>;

const SIN_HAB = 'Sin habitación';
const SIN_ALM = 'Sin mueble';
const SIN_UBI = 'Sin sitio concreto';

const contarAlm = (a: Almacenaje) => Object.values(a).reduce((n, arr) => n + arr.length, 0);
const contarHab = (h: Habitacion) => Object.values(h).reduce((n, a) => n + contarAlm(a), 0);

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const coincide = (it: Item, q: string) => {
  const query = norm(q.trim());
  if (!query) return true;
  const heno = norm([
    it.nombre, it.habitacion, it.almacenaje, it.ubicacion,
    it.categoria ?? '', (it.etiquetas ?? []).join(' '), it.notas ?? ''
  ].join(' '));
  return heno.includes(query);
};

export default function Casa() {
  const history = useHistory();
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState('');

  useIonViewWillEnter(() => { allItems().then(setItems).catch(() => {}); });

  // Filtramos por la búsqueda y construimos el árbol de lo que queda.
  const filtrados = items.filter((it) => coincide(it, q));
  const arbol: Arbol = {};
  for (const it of filtrados) {
    const h = it.habitacion?.trim() || SIN_HAB;
    const m = it.almacenaje?.trim() || SIN_ALM;
    const u = it.ubicacion?.trim() || SIN_UBI;
    if (!arbol[h]) arbol[h] = {};
    if (!arbol[h][m]) arbol[h][m] = {};
    if (!arbol[h][m][u]) arbol[h][m][u] = [];
    arbol[h][m][u].push(it);
  }
  const habitaciones = Object.keys(arbol).sort();
  const buscando = q.trim().length > 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/home" /></IonButtons>
          <IonTitle>Mi casa</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => history.push('/grafo')} aria-label="Ver como grafo">
              <IonIcon slot="icon-only" icon={gitNetworkOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={q}
            debounce={0}
            placeholder="Buscar en tu casa…"
            onIonInput={(e) => setQ(e.detail.value ?? '')}
          />
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {items.length === 0 ? (
          <div className="ion-padding ion-text-center" style={{ marginTop: '3rem' }}>
            <IonIcon icon={homeOutline} style={{ fontSize: 56, color: 'var(--ion-color-medium)' }} />
            <p><IonText color="medium">
              Aún no hay nada. A medida que guardes cosas, aquí verás tu casa organizada
              sola: por habitaciones, muebles y cajones.
            </IonText></p>
          </div>
        ) : habitaciones.length === 0 ? (
          <div className="ion-padding ion-text-center" style={{ marginTop: '3rem' }}>
            <IonText color="medium"><p>Nada coincide con “{q}”.</p></IonText>
          </div>
        ) : (
          // Al buscar, abrimos todas las ramas coincidentes (value controlado).
          <IonAccordionGroup multiple {...(buscando ? { value: habitaciones } : {})}>
            {habitaciones.map((h) => (
              <IonAccordion key={h} value={h}>
                <IonItem slot="header">
                  <IonIcon icon={homeOutline} slot="start" color="primary" />
                  <IonLabel><strong>{h}</strong></IonLabel>
                  <IonNote slot="end">{contarHab(arbol[h])}</IonNote>
                </IonItem>
                <div slot="content">
                  <IonAccordionGroup multiple {...(buscando ? { value: Object.keys(arbol[h]) } : {})}>
                    {Object.keys(arbol[h]).sort().map((m) => (
                      <IonAccordion key={m} value={m}>
                        <IonItem slot="header" style={{ '--padding-start': '24px' } as React.CSSProperties}>
                          <IonIcon icon={fileTrayOutline} slot="start" color="medium" />
                          <IonLabel>{m}</IonLabel>
                          <IonNote slot="end">{contarAlm(arbol[h][m])}</IonNote>
                        </IonItem>
                        <div slot="content">
                          {Object.keys(arbol[h][m]).sort().map((u) => (
                            <div key={u}>
                              <IonItem lines="none" style={{ '--padding-start': '40px' } as React.CSSProperties}>
                                <IonIcon icon={locationOutline} slot="start" color="medium" style={{ fontSize: 15 }} />
                                <IonLabel color="medium"><small>{u}</small></IonLabel>
                              </IonItem>
                              {arbol[h][m][u].map((it) => (
                                <IonItem
                                  key={it.id} button detail
                                  style={{ '--padding-start': '56px' } as React.CSSProperties}
                                  onClick={() => history.push(`/item/${it.id}`)}
                                >
                                  <IonIcon icon={cubeOutline} slot="start" color="medium" />
                                  <IonLabel>{it.nombre}</IonLabel>
                                </IonItem>
                              ))}
                            </div>
                          ))}
                        </div>
                      </IonAccordion>
                    ))}
                  </IonAccordionGroup>
                </div>
              </IonAccordion>
            ))}
          </IonAccordionGroup>
        )}
      </IonContent>
    </IonPage>
  );
}
