import { useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonAccordion, IonAccordionGroup, IonItem, IonLabel, IonNote, IonIcon, IonText,
  useIonViewWillEnter
} from '@ionic/react';
import { homeOutline, cubeOutline, fileTrayOutline, locationOutline } from 'ionicons/icons';
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

export default function Casa() {
  const history = useHistory();
  const [arbol, setArbol] = useState<Arbol>({});
  const [total, setTotal] = useState(0);

  useIonViewWillEnter(() => {
    allItems().then((items) => {
      const a: Arbol = {};
      for (const it of items) {
        const h = it.habitacion?.trim() || SIN_HAB;
        const m = it.almacenaje?.trim() || SIN_ALM;
        const u = it.ubicacion?.trim() || SIN_UBI;
        if (!a[h]) a[h] = {};
        if (!a[h][m]) a[h][m] = {};
        if (!a[h][m][u]) a[h][m][u] = [];
        a[h][m][u].push(it);
      }
      setArbol(a);
      setTotal(items.length);
    }).catch(() => {});
  });

  const habitaciones = Object.keys(arbol).sort();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/home" /></IonButtons>
          <IonTitle>Mi casa</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {total === 0 ? (
          <div className="ion-padding ion-text-center" style={{ marginTop: '3rem' }}>
            <IonIcon icon={homeOutline} style={{ fontSize: 56, color: 'var(--ion-color-medium)' }} />
            <p><IonText color="medium">
              Aún no hay nada. A medida que guardes cosas, aquí verás tu casa organizada
              sola: por habitaciones, muebles y cajones.
            </IonText></p>
          </div>
        ) : (
          <IonAccordionGroup multiple>
            {habitaciones.map((h) => (
              <IonAccordion key={h} value={h}>
                <IonItem slot="header">
                  <IonIcon icon={homeOutline} slot="start" color="primary" />
                  <IonLabel><strong>{h}</strong></IonLabel>
                  <IonNote slot="end">{contarHab(arbol[h])}</IonNote>
                </IonItem>
                <div slot="content">
                  <IonAccordionGroup multiple>
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
