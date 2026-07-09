import { useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonButton, IonList, IonItem, IonLabel, IonInput, IonText, IonNote, useIonToast
} from '@ionic/react';
import { getTextModel, getEmbedModel, setModels } from '../services/gemini';

export default function Settings() {
  const [present] = useIonToast();
  const [textModel, setTextModel] = useState(getTextModel());
  const [embedModel, setEmbedModel] = useState(getEmbedModel());

  const guardar = () => {
    setModels(textModel, embedModel);
    present({ message: 'Ajustes guardados', duration: 1500, color: 'success', position: 'top' });
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
