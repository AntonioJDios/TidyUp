import { useEffect, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonButton, IonIcon, IonList, IonItem, IonLabel, IonChip, IonText, useIonAlert
} from '@ionic/react';
import { trashOutline, locationOutline } from 'ionicons/icons';
import { useParams, useHistory } from 'react-router-dom';
import { getItem, deleteItem, type Item } from '../db/db';

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [item, setItem] = useState<Item | undefined>();
  const [presentAlert] = useIonAlert();

  useEffect(() => { getItem(Number(id)).then(setItem); }, [id]);

  const borrar = () => {
    presentAlert({
      header: '¿Borrar este objeto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Borrar', role: 'destructive', handler: async () => { await deleteItem(Number(id)); history.replace('/home'); } }
      ]
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/home" /></IonButtons>
          <IonTitle>{item?.nombre ?? 'Objeto'}</IonTitle>
          <IonButtons slot="end">
            <IonButton color="danger" onClick={borrar} aria-label="Borrar">
              <IonIcon slot="icon-only" icon={trashOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {item && (
          <>
            {item.foto && (
              <div className="ion-text-center" style={{ marginBottom: 16 }}>
                <img src={item.foto} alt={item.nombre} style={{ maxWidth: '80%', borderRadius: 12 }} />
              </div>
            )}
            <h1 style={{ marginTop: 0 }}>{item.nombre}</h1>
            <p style={{ fontSize: 18 }}>
              <IonIcon icon={locationOutline} style={{ verticalAlign: '-3px' }} /> {item.ubicacion || 'Sin ubicación'}
            </p>
            <IonList>
              {item.categoria && (
                <IonItem><IonLabel>Categoría</IonLabel><IonText slot="end">{item.categoria}</IonText></IonItem>
              )}
              {item.notas && (
                <IonItem><IonLabel className="ion-text-wrap"><h3>Notas</h3><p>{item.notas}</p></IonLabel></IonItem>
              )}
            </IonList>
            {item.etiquetas && item.etiquetas.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {item.etiquetas.map((t) => <IonChip key={t}>{t}</IonChip>)}
              </div>
            )}
            <p style={{ marginTop: 24 }}>
              <IonText color="medium"><small>Guardado el {new Date(item.creado).toLocaleDateString('es-ES')}</small></IonText>
            </p>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
