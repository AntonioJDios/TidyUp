import { useState } from 'react';
import {
  IonContent, IonPage, IonInput, IonButton, IonItem, IonLabel, IonText,
  IonSpinner, IonSegment, IonSegmentButton, useIonToast
} from '@ionic/react';
import { supabase } from '../services/supabase';

// Login por email + contraseña. Elegido por ser lo más simple para empezar: no
// envía emails (sin SMTP) y no depende de enlaces a supabase.co (bloqueados en
// redes corporativas). Requiere desactivar "Confirm email" en Supabase para que
// el registro inicie sesión al momento.
export default function Login() {
  const [present] = useIonToast();
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const aviso = (msg: string, color = 'danger') =>
    present({ message: msg, duration: 2800, color, position: 'top' });

  const acceder = async () => {
    if (!email.trim() || !password) { aviso('Escribe email y contraseña.'); return; }
    setCargando(true);
    try {
      if (modo === 'registro') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          // Pasa si "Confirm email" sigue activo en Supabase.
          aviso('Cuenta creada. Si te pide confirmar por email, desactiva "Confirm email" en Supabase.', 'warning');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      // El listener de sesión en App.tsx se encarga del resto.
    } catch (e: any) {
      aviso(e?.message ?? 'No se pudo acceder.');
    } finally { setCargando(false); }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 420, margin: '0 auto', paddingTop: '12vh' }}>
          <h1 style={{ textAlign: 'center' }}>TidyUp</h1>
          <IonText color="medium">
            <p style={{ textAlign: 'center' }}>Recuerda dónde guardas las cosas en casa.</p>
          </IonText>

          <IonSegment value={modo} onIonChange={(e) => setModo(e.detail.value as 'entrar' | 'registro')} style={{ marginBottom: 16 }}>
            <IonSegmentButton value="entrar"><IonLabel>Entrar</IonLabel></IonSegmentButton>
            <IonSegmentButton value="registro"><IonLabel>Crear cuenta</IonLabel></IonSegmentButton>
          </IonSegment>

          <IonItem>
            <IonLabel position="stacked">Email</IonLabel>
            <IonInput type="email" inputmode="email" value={email} placeholder="tu@email.com"
              onIonInput={(e) => setEmail(e.detail.value ?? '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Contraseña</IonLabel>
            <IonInput type="password" value={password} placeholder="••••••••"
              onIonInput={(e) => setPassword(e.detail.value ?? '')} />
          </IonItem>

          <IonButton expand="block" style={{ marginTop: 20 }} disabled={cargando} onClick={acceder}>
            {cargando ? <IonSpinner name="dots" /> : (modo === 'registro' ? 'Crear cuenta' : 'Entrar')}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}
