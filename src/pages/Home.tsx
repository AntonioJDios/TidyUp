import { useEffect, useState, useCallback } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonButton,
  IonIcon, IonSearchbar, IonList, IonItem, IonLabel, IonNote, IonFab, IonFabButton,
  IonText, useIonViewWillEnter
} from '@ionic/react';
import { settingsOutline, addOutline, cubeOutline, locationOutline, micOutline, volumeHighOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { buscar, type Resultado } from '../services/search';
import { ubicacionTexto, fotoUrl } from '../db/db';
import { escuchar, hablar, reconocimientoDisponible } from '../services/voz';
import { extraerObjetoBusqueda } from '../services/gemini';

export default function Home() {
  const history = useHistory();
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [total, setTotal] = useState(0);
  const [escuchando, setEscuchando] = useState(false);
  const [respuesta, setRespuesta] = useState<string | null>(null);

  const fechaCorta = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

  // Compone la respuesta hablada/escrita. Si hay varios resultados (p. ej. el
  // mismo objeto guardado en dos sitios distintos), los menciona todos con su
  // fecha, para saber dónde está cada uno y cuál es el más reciente.
  const componerRespuesta = (r: Resultado[]): string => {
    if (r.length === 0) return 'No he encontrado nada guardado sobre eso.';

    const describe = (res: Resultado) => {
      const it = res.item;
      const donde = ubicacionTexto(it) || 'sin ubicación anotada';
      return `${it.nombre} en ${donde} (guardado el ${fechaCorta(it.creado)})`;
    };

    if (r.length === 1) {
      const it = r[0].item;
      const donde = ubicacionTexto(it);
      return donde
        ? `${it.nombre} está en ${donde}. Lo guardaste el ${fechaCorta(it.creado)}.`
        : `${it.nombre} está guardado, pero no anotaste dónde. Lo guardaste el ${fechaCorta(it.creado)}.`;
    }

    const top = r.slice(0, 3).map(describe);
    const extra = r.length > 3 ? `; y ${r.length - 3} más` : '';
    return `He encontrado ${r.length}: ${top.join('; ')}${extra}.`;
  };

  const preguntarPorVoz = () => {
    if (!reconocimientoDisponible()) return;
    setRespuesta(null);
    setEscuchando(true);
    escuchar(
      async (frase) => {
        try {
          // La IA identifica el objeto de la pregunta ("quiero buscar el
          // ordenador" -> "ordenador") y buscamos solo eso.
          let objeto = frase;
          try { objeto = await extraerObjetoBusqueda(frase); } catch { /* si falla, la frase entera */ }
          setQuery(objeto); // actualiza también la lista y muestra qué entendió
          const r = await buscar(objeto);
          const texto = componerRespuesta(r);
          setRespuesta(texto);
          hablar(texto);
        } finally {
          setEscuchando(false);
        }
      },
      () => setEscuchando(false)
    );
  };

  const refrescar = useCallback(async (q: string) => {
    setCargando(true);
    const r = await buscar(q);
    setResultados(r);
    if (!q) setTotal(r.length);
    setCargando(false);
    // Resolvemos las URLs firmadas de las fotos (privadas) en segundo plano.
    const mapa: Record<string, string> = {};
    await Promise.all(
      r.filter(({ item }) => item.foto_path).map(async ({ item }) => {
        const url = await fotoUrl(item.foto_path);
        if (url) mapa[item.id] = url;
      })
    );
    setFotos(mapa);
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

        {reconocimientoDisponible() && (
          <div className="ion-text-center" style={{ margin: '4px 0 8px' }}>
            <IonButton
              size="small" fill="outline"
              color={escuchando ? 'danger' : 'primary'}
              onClick={preguntarPorVoz}
              disabled={escuchando}
            >
              <IonIcon slot="start" icon={micOutline} />
              {escuchando ? 'Escuchando…' : 'Preguntar por voz'}
            </IonButton>
          </div>
        )}

        {respuesta && (
          <IonItem color="light" lines="none" style={{ margin: '0 8px', borderRadius: 12 }}>
            <IonIcon icon={volumeHighOutline} slot="start" color="primary" />
            <IonLabel className="ion-text-wrap"><strong>{respuesta}</strong></IonLabel>
            <IonButton slot="end" fill="clear" aria-label="Repetir" onClick={() => hablar(respuesta)}>
              <IonIcon slot="icon-only" icon={volumeHighOutline} />
            </IonButton>
          </IonItem>
        )}

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
          {resultados.map(({ item, score }) => (
            <IonItem key={item.id} button detail onClick={() => history.push(`/item/${item.id}`)}>
              {fotos[item.id]
                ? <img src={fotos[item.id]} alt="" slot="start" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                : <IonIcon icon={cubeOutline} slot="start" color="medium" />}
              <IonLabel>
                <h2>{item.nombre}</h2>
                <p><IonIcon icon={locationOutline} style={{ verticalAlign: '-2px', fontSize: 14 }} /> {ubicacionTexto(item) || 'Sin ubicación'}</p>
                <p style={{ fontSize: 12, opacity: 0.7 }}>Guardado el {fechaCorta(item.creado)}</p>
              </IonLabel>
              <div slot="end" style={{ textAlign: 'right' }}>
                {query && (
                  <IonNote color={score >= 0.6 ? 'success' : 'medium'} style={{ fontWeight: 700 }}>
                    {(score * 100).toFixed(1)}%
                  </IonNote>
                )}
                {item.categoria && <div><IonNote>{item.categoria}</IonNote></div>}
              </div>
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
