import { useRegisterSW } from 'virtual:pwa-register/react';
import { IonToast } from '@ionic/react';

// Avisa cuando hay una versión nueva desplegada (Service Worker) y ofrece
// recargar para aplicarla. Resuelve el problema de la caché de la PWA: en vez de
// cerrar/reabrir a mano, el usuario ve "Nueva versión" y toca "Actualizar".
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();

  return (
    <IonToast
      isOpen={needRefresh}
      message="Hay una versión nueva de TidyUp."
      position="bottom"
      buttons={[
        { text: 'Actualizar', role: 'info', handler: () => updateServiceWorker(true) },
        { text: 'Ahora no', role: 'cancel', handler: () => setNeedRefresh(false) }
      ]}
    />
  );
}
