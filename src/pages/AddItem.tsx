import { useRef, useState, useEffect } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonButton, IonIcon, IonItem, IonLabel, IonInput, IonTextarea, IonList, IonChip,
  IonSpinner, IonText, IonToast, useIonToast
} from '@ionic/react';
import { micOutline, cameraOutline, sparkles, checkmarkOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { addItem, updateItem, knownLocations } from '../db/db';
import { extraerConcepto, reconocerFoto, generarEmbedding } from '../services/gemini';
import { textoParaEmbedding } from '../services/search';

// Reconocimiento de voz del navegador (gratis, sin API).
type SR = typeof window & { webkitSpeechRecognition?: any; SpeechRecognition?: any };

export default function AddItem() {
  const history = useHistory();
  const [present] = useIonToast();

  const [texto, setTexto] = useState('');       // frase libre / dictado
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [foto, setFoto] = useState<string | undefined>();
  const [notas, setNotas] = useState('');

  const [escuchando, setEscuchando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [ubicacionesPrevias, setUbicacionesPrevias] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);

  useEffect(() => { knownLocations().then(setUbicacionesPrevias); }, []);

  const aviso = (msg: string, color = 'danger') =>
    present({ message: msg, duration: 2500, color, position: 'top' });

  // --- VOZ ---
  const dictar = () => {
    const w = window as SR;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) { aviso('Tu navegador no soporta dictado por voz.'); return; }
    const rec = new Rec();
    rec.lang = 'es-ES';
    rec.interimResults = true;
    rec.continuous = false;
    recRef.current = rec;
    let final = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      setTexto((final + interim).trim());
    };
    rec.onend = async () => {
      setEscuchando(false);
      if (final.trim()) await interpretar(final.trim());
    };
    rec.onerror = () => { setEscuchando(false); aviso('No se pudo escuchar. Inténtalo de nuevo.'); };
    setEscuchando(true);
    rec.start();
  };

  // --- IA: interpretar texto ---
  const interpretar = async (frase: string) => {
    setProcesando(true);
    try {
      const c = await extraerConcepto(frase);
      if (c.nombre) setNombre(c.nombre);
      if (c.ubicacion) setUbicacion(c.ubicacion);
      if (c.categoria) setCategoria(c.categoria);
      if (c.etiquetas?.length) setEtiquetas(c.etiquetas);
    } catch {
      // Si la IA falla, no perdemos lo dictado: lo usamos como nombre.
      if (!nombre) setNombre(frase);
      aviso('La IA no pudo interpretar. Revisa los campos.');
    } finally { setProcesando(false); }
  };

  // --- FOTO ---
  const elegirFoto = () => fileRef.current?.click();
  const onFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setFoto(dataUrl);
      setProcesando(true);
      try {
        const c = await reconocerFoto(dataUrl);
        if (c.nombre && !nombre) setNombre(c.nombre);
        if (c.categoria && !categoria) setCategoria(c.categoria);
        if (c.etiquetas?.length && etiquetas.length === 0) setEtiquetas(c.etiquetas);
      } catch { aviso('No se pudo reconocer la foto.'); }
      finally { setProcesando(false); }
    };
    reader.readAsDataURL(file);
  };

  // --- GUARDAR ---
  const guardar = async () => {
    if (!nombre.trim()) { aviso('Ponle al menos un nombre.'); return; }
    setProcesando(true);
    try {
      const base = { nombre: nombre.trim(), ubicacion: ubicacion.trim(), categoria: categoria.trim(), etiquetas, notas: notas.trim(), foto };
      const id = await addItem(base);
      // Embedding en segundo plano; no bloquea el guardado. Si falla, el objeto
      // se seguirá encontrando por búsqueda de texto.
      try {
        const vec = await generarEmbedding(textoParaEmbedding(base));
        if (vec.length) await updateItem(id, { embedding: vec });
      } catch { /* no pasa nada: seguirá buscándose por texto */ }
      present({ message: 'Guardado', duration: 1200, color: 'success', position: 'top', icon: checkmarkOutline });
      history.replace('/home');
    } catch { aviso('No se pudo guardar.'); }
    finally { setProcesando(false); }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/home" /></IonButtons>
          <IonTitle>Guardé algo</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={guardar}>Guardar</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div className="ion-text-center" style={{ margin: '1rem 0 1.5rem' }}>
          <IonButton
            shape="round" size="large"
            color={escuchando ? 'danger' : 'primary'}
            onClick={escuchando ? () => recRef.current?.stop() : dictar}
          >
            <IonIcon slot="start" icon={micOutline} />
            {escuchando ? 'Escuchando… toca para parar' : 'Dictar'}
          </IonButton>
          <div style={{ marginTop: 12 }}>
            <IonButton fill="outline" size="small" onClick={elegirFoto}>
              <IonIcon slot="start" icon={cameraOutline} /> Foto
            </IonButton>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFoto} />
        </div>

        {foto && (
          <div className="ion-text-center" style={{ marginBottom: 12 }}>
            <img src={foto} alt="foto del objeto" style={{ maxWidth: '60%', borderRadius: 12 }} />
          </div>
        )}

        <IonItem>
          <IonLabel position="stacked">Frase (o dicta arriba)</IonLabel>
          <IonTextarea
            value={texto} autoGrow
            placeholder="Ej: guardo las pilas AA en el cajón del pasillo"
            onIonInput={(e) => setTexto(e.detail.value ?? '')}
          />
        </IonItem>
        <div className="ion-text-end" style={{ margin: '6px 0 4px' }}>
          <IonButton size="small" fill="clear" disabled={!texto.trim() || procesando} onClick={() => interpretar(texto)}>
            {procesando ? <IonSpinner name="dots" /> : <><IonIcon slot="start" icon={sparkles} /> Interpretar con IA</>}
          </IonButton>
        </div>

        <IonList>
          <IonItem>
            <IonLabel position="stacked">Objeto *</IonLabel>
            <IonInput value={nombre} placeholder="Pilas AA" onIonInput={(e) => setNombre(e.detail.value ?? '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Ubicación</IonLabel>
            <IonInput value={ubicacion} placeholder="Cajón del pasillo" onIonInput={(e) => setUbicacion(e.detail.value ?? '')} />
          </IonItem>
          {ubicacionesPrevias.length > 0 && (
            <div className="ion-padding-start ion-padding-bottom">
              <IonText color="medium"><small>Reutilizar: </small></IonText>
              {ubicacionesPrevias.slice(0, 8).map((u) => (
                <IonChip key={u} onClick={() => setUbicacion(u)}>{u}</IonChip>
              ))}
            </div>
          )}
          <IonItem>
            <IonLabel position="stacked">Categoría</IonLabel>
            <IonInput value={categoria} placeholder="Electrónica" onIonInput={(e) => setCategoria(e.detail.value ?? '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Notas</IonLabel>
            <IonTextarea value={notas} autoGrow onIonInput={(e) => setNotas(e.detail.value ?? '')} />
          </IonItem>
        </IonList>

        {etiquetas.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {etiquetas.map((t) => <IonChip key={t} color="primary">{t}</IonChip>)}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
