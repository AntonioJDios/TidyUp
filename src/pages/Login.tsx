import { useState } from 'react';
import {
  IonContent, IonPage, IonInput, IonButton, IonItem, IonLabel, IonText,
  IonSpinner, useIonToast
} from '@ionic/react';
import { supabase } from '../services/supabase';

// Login por código OTP (6 dígitos) enviado al email. Usamos código en vez de
// enlace mágico para no depender de abrir un enlace a supabase.co (que en redes
// corporativas puede estar bloqueado); la verificación pasa por nuestro proxy /sb.
export default function Login() {
  const [present] = useIonToast();
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [fase, setFase] = useState<'email' | 'codigo'>('email');
  const [cargando, setCargando] = useState(false);

  const aviso = (msg: string, color = 'danger') =>
    present({ message: msg, duration: 2500, color, position: 'top' });

  const enviarCodigo = async () => {
    if (!email.trim()) { aviso('Escribe tu email.'); return; }
    setCargando(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true }
      });
      if (error) throw error;
      setFase('codigo');
      aviso('Te hemos enviado un código por email.', 'success');
    } catch (e: any) {
      aviso(e?.message ?? 'No se pudo enviar el código.');
    } finally { setCargando(false); }
  };

  const verificar = async () => {
    if (!codigo.trim()) { aviso('Escribe el código.'); return; }
    setCargando(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: codigo.trim(),
        type: 'email'
      });
      if (error) throw error;
      // El listener de sesión en App.tsx se encarga del resto.
    } catch (e: any) {
      aviso(e?.message ?? 'Código incorrecto o caducado.');
    } finally { setCargando(false); }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 420, margin: '0 auto', paddingTop: '15vh' }}>
          <h1 style={{ textAlign: 'center' }}>TidyUp</h1>
          <IonText color="medium">
            <p style={{ textAlign: 'center' }}>Recuerda dónde guardas las cosas en casa.</p>
          </IonText>

          {fase === 'email' ? (
            <>
              <IonItem>
                <IonLabel position="stacked">Tu email</IonLabel>
                <IonInput
                  type="email" inputmode="email" value={email} placeholder="tu@email.com"
                  onIonInput={(e) => setEmail(e.detail.value ?? '')}
                />
              </IonItem>
              <IonButton expand="block" style={{ marginTop: 20 }} disabled={cargando} onClick={enviarCodigo}>
                {cargando ? <IonSpinner name="dots" /> : 'Enviarme un código'}
              </IonButton>
            </>
          ) : (
            <>
              <IonText color="medium">
                <p>Escribe el código de 6 dígitos que hemos enviado a <strong>{email}</strong>.</p>
              </IonText>
              <IonItem>
                <IonLabel position="stacked">Código</IonLabel>
                <IonInput
                  type="text" inputmode="numeric" value={codigo} placeholder="123456"
                  onIonInput={(e) => setCodigo(e.detail.value ?? '')}
                />
              </IonItem>
              <IonButton expand="block" style={{ marginTop: 20 }} disabled={cargando} onClick={verificar}>
                {cargando ? <IonSpinner name="dots" /> : 'Entrar'}
              </IonButton>
              <IonButton expand="block" fill="clear" disabled={cargando} onClick={() => setFase('email')}>
                Cambiar de email
              </IonButton>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
