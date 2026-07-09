import { useEffect, useState, useCallback } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonButton,
  IonIcon, IonSearchbar, IonList, IonItem, IonLabel, IonNote, IonFab, IonFabButton,
  IonText, useIonViewWillEnter
} from '@ionic/react';
import { settingsOutline, addOutline, cubeOutline, locationOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { buscar, type Resultado } from '../services/search';

export default function Home() {
  const history = useHistory();
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [total, setTotal] = useState(0);

  const refrescar = useCallback(async (q: string) => {
    setCargando(true);
    const r = await buscar(q);
    setResultados(r);
    if (!q) setTotal(r.length);
    setCargando(false);
  }, []);

  useIonViewWillEnter(() => { refrescar(query); });
  useEffect(() => {
    const t = setTimeout(() => refrescar(query), 250);
    return () => clearTimeout(t);
  }, [query, refrescar]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>TidyUp</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => history.push('/settings')} aria-label="Ajustes">
              <IonIcon slot="icon-only" icon={settingsOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonSearchbar
          value={query}
          debounce={0}
          placeholder="Buscar tijeras, pasaporte, pilas…"
          onIonInput={(e) => setQuery(e.detail.value ?? '')}
        />

        <div className="ion-padding-start ion-padding-top">
          <IonText color="medium">
            <small>{query ? `${resultados.length} resultado(s)` : `${total} cosa(s) guardadas`}</small>
          </IonText>
        </div>

        {resultados.length === 0 && !cargando && (
          <div className="ion-padding ion-text-center" style={{ marginTop: '3rem' }}>
            <IonIcon icon={cubeOutline} style={{ fontSize: 56, color: 'var(--ion-color-medium)' }} />
            <p><IonText color="medium">
              {query ? 'Nada por aquí. Prueba con otras palabras.' : 'Aún no has guardado nada. Toca “+” para empezar.'}
            </IonText></p>
          </div>
        )}

        <IonList>
          {resultados.map(({ item }) => (
            <IonItem key={item.id} button detail onClick={() => history.push(`/item/${item.id}`)}>
              {item.foto
                ? <img src={item.foto} alt="" slot="start" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                : <IonIcon icon={cubeOutline} slot="start" color="medium" />}
              <IonLabel>
                <h2>{item.nombre}</h2>
                <p><IonIcon icon={locationOutline} style={{ verticalAlign: '-2px', fontSize: 14 }} /> {item.ubicacion || 'Sin ubicación'}</p>
              </IonLabel>
              {item.categoria && <IonNote slot="end">{item.categoria}</IonNote>}
            </IonItem>
          ))}
        </IonList>

        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton onClick={() => history.push('/add')} aria-label="Añadir cosa">
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      </IonContent>
    </IonPage>
  );
}
