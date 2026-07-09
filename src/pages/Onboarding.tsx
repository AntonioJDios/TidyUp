import { useState } from 'react';
import {
  IonContent, IonPage, IonInput, IonButton, IonItem, IonLabel, IonText,
  IonSpinner, IonSegment, IonSegmentButton, useIonToast
} from '@ionic/react';
import { crearHogar, unirseAHogar } from '../services/home';
import { supabase } from '../services/supabase';

// Se muestra cuando el usuario está autenticado pero aún no pertenece a ningún
// hogar: puede crear uno nuevo o unirse a uno existente con un código.
export default function Onboarding({ onListo }: { onListo: () => void }) {
  const [present] = useIonToast();
  const [modo, setModo] = useState<'crear' | 'unirse'>('crear');
  const [nombre, setNombre] = useState('Mi hogar');
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);

  const aviso = (msg: string, color = 'danger') =>
    present({ message: msg, duration: 2500, color, position: 'top' });

  const accion = async () => {
    setCargando(true);
    try {
      if (modo === 'crear') {
        await crearHogar(nombre.trim() || 'Mi hogar');
      } else {
        if (!codigo.trim()) { aviso('Escribe el código de invitación.'); setCargando(false); return; }
        await unirseAHogar(codigo.trim());
      }
      onListo();
    } catch (e: any) {
      aviso(e?.message ?? 'No se pudo completar. Inténtalo de nuevo.');
    } finally { setCargando(false); }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 420, margin: '0 auto', paddingTop: '12vh' }}>
          <h1 style={{ textAlign: 'center' }}>Tu hogar</h1>
          <IonText color="medium">
            <p style={{ textAlign: 'center' }}>
              Un hogar es el espacio compartido. Crea el tuyo o únete al de tu pareja con su código.
            </p>
          </IonText>

          <IonSegment value={modo} onIonChange={(e) => setModo(e.detail.value as 'crear' | 'unirse')} style={{ marginBottom: 16 }}>
            <IonSegmentButton value="crear"><IonLabel>Crear hogar</IonLabel></IonSegmentButton>
            <IonSegmentButton value="unirse"><IonLabel>Unirme</IonLabel></IonSegmentButton>
          </IonSegment>

          {modo === 'crear' ? (
            <IonItem>
              <IonLabel position="stacked">Nombre del hogar</IonLabel>
              <IonInput value={nombre} placeholder="Mi hogar" onIonInput={(e) => setNombre(e.detail.value ?? '')} />
            </IonItem>
          ) : (
            <IonItem>
              <IonLabel position="stacked">Código de invitación</IonLabel>
              <IonInput value={codigo} placeholder="A1B2C3"
                onIonInput={(e) => setCodigo((e.detail.value ?? '').toUpperCase())} />
            </IonItem>
          )}

          <IonButton expand="block" style={{ marginTop: 20 }} disabled={cargando} onClick={accion}>
            {cargando ? <IonSpinner name="dots" /> : (modo === 'crear' ? 'Crear hogar' : 'Unirme al hogar')}
          </IonButton>

          <IonButton expand="block" fill="clear" color="medium" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}
