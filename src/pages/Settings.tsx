import { useEffect, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonButton, IonList, IonItem, IonLabel, IonInput, IonText, IonNote, IonIcon, useIonToast
} from '@ionic/react';
import { copyOutline, logOutOutline } from 'ionicons/icons';
import { getTextModel, getEmbedModel, setModels } from '../services/gemini';
import { supabase } from '../services/supabase';
import { getMisHogares, getHogarActual, type Hogar } from '../services/home';

export default function Settings() {
  const [present] = useIonToast();
  const [textModel, setTextModel] = useState(getTextModel());
  const [embedModel, setEmbedModel] = useState(getEmbedModel());
  const [hogar, setHogar] = useState<Hogar | undefined>();

  useEffect(() => {
    (async () => {
      const [hogares, actual] = await Promise.all([getMisHogares(), getHogarActual()]);
      setHogar(hogares.find((h) => h.id === actual) ?? hogares[0]);
    })().catch(() => {});
  }, []);

  const guardar = () => {
    setModels(textModel, embedModel);
    present({ message: 'Ajustes guardados', duration: 1500, color: 'success', position: 'top' });
  };

  const copiarCodigo = async () => {
    if (!hogar) return;
    try { await navigator.clipboard.writeText(hogar.codigo_invitacion); } catch { /* ignore */ }
    present({ message: 'Código copiado', duration: 1200, color: 'success', position: 'top' });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/home" /></IonButtons>
          <IonTitle>Ajustes</IonTitle>
          <IonButtons slot="end"><IonButton strong onClick={guardar}>Guardar</IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <h2 style={{ marginTop: 0 }}>Tu hogar</h2>
        <IonText color="medium">
          <p>Comparte este código con tu pareja para que se una al mismo hogar y veáis las mismas cosas.</p>
        </IonText>
        <IonList>
          <IonItem>
            <IonLabel>
              <h3>{hogar?.nombre ?? 'Mi hogar'}</h3>
              <p style={{ fontSize: 22, letterSpacing: 2, fontWeight: 700 }}>{hogar?.codigo_invitacion ?? '—'}</p>
            </IonLabel>
            <IonButton slot="end" fill="clear" onClick={copiarCodigo} aria-label="Copiar código">
              <IonIcon slot="icon-only" icon={copyOutline} />
            </IonButton>
          </IonItem>
        </IonList>

        <IonButton expand="block" fill="outline" color="medium" style={{ marginTop: 12 }} onClick={() => supabase.auth.signOut()}>
          <IonIcon slot="start" icon={logOutOutline} /> Cerrar sesión
        </IonButton>

        <h2 style={{ marginTop: 28 }}>IA (avanzado)</h2>
        <IonText color="medium">
          <p>La IA (Gemini) da la voz, el reconocimiento de fotos y la búsqueda inteligente.
          Funciona sin configurar nada: la clave la gestiona el servidor.</p>
        </IonText>

        <IonList>
          <IonItem>
            <IonLabel position="stacked">Modelo de texto/visión</IonLabel>
            <IonInput value={textModel} onIonInput={(e) => setTextModel(e.detail.value ?? '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Modelo de embeddings</IonLabel>
            <IonInput value={embedModel} onIonInput={(e) => setEmbedModel(e.detail.value ?? '')} />
          </IonItem>
        </IonList>

        <IonNote className="ion-padding">
          <p>Estos valores son avanzados; los predeterminados funcionan bien.
          Cámbialos solo si Google publica modelos nuevos.</p>
        </IonNote>
      </IonContent>
    </IonPage>
  );
}
