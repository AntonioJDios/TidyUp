import { useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonButton, IonList, IonItem, IonLabel, IonInput, IonText, IonNote, useIonToast
} from '@ionic/react';
import { getApiKey, setApiKey, getTextModel, getEmbedModel, setModels } from '../services/gemini';

export default function Settings() {
  const [present] = useIonToast();
  const [key, setKey] = useState(getApiKey());
  const [textModel, setTextModel] = useState(getTextModel());
  const [embedModel, setEmbedModel] = useState(getEmbedModel());

  const guardar = () => {
    setApiKey(key);
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
          Tu clave se guarda <strong>solo en este dispositivo</strong>.</p>
        </IonText>

        <IonList>
          <IonItem>
            <IonLabel position="stacked">Clave de API de Gemini</IonLabel>
            <IonInput type="password" value={key} placeholder="AIza…"
              onIonInput={(e) => setKey(e.detail.value ?? '')} />
          </IonItem>
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
          <p>¿No tienes clave? Consíguela gratis en Google AI Studio
          (<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>).
          El plan gratuito basta para uso personal.</p>
        </IonNote>
      </IonContent>
    </IonPage>
  );
}
