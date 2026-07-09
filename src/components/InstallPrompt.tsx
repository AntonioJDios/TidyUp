import { useEffect, useState } from 'react';
import { IonToast } from '@ionic/react';

// En Android/Chrome el aviso de instalar (beforeinstallprompt) a veces no salta
// solo. Lo capturamos y ofrecemos NUESTRO botón "Instalar". (En iOS este evento
// no existe: allí se instala desde Safari -> Compartir -> Añadir a inicio.)
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();      // evita el mini-infobar de Chrome
      setDeferred(e);          // guardamos el evento para lanzarlo nosotros
    };
    window.addEventListener('beforeinstallprompt', handler);
    const instalada = () => setDeferred(null);
    window.addEventListener('appinstalled', instalada);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', instalada);
    };
  }, []);

  const instalar = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <IonToast
      isOpen={!!deferred}
      message="¿Instalar TidyUp en tu móvil?"
      position="bottom"
      buttons={[
        { text: 'Instalar', role: 'info', handler: instalar },
        { text: 'Ahora no', role: 'cancel', handler: () => setDeferred(null) }
      ]}
    />
  );
}
