import { useEffect, useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, IonSpinner, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './services/supabase';
import { getHogarActual } from './services/home';

import Home from './pages/Home';
import AddItem from './pages/AddItem';
import ItemDetail from './pages/ItemDetail';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import UpdatePrompt from './components/UpdatePrompt';
import InstallPrompt from './components/InstallPrompt';

/* Estilos base de Ionic (obligatorios) */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/text-alignment.css';

import './theme/variables.css';

setupIonicReact();

function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
  );
}

export default function App() {
  const [cargando, setCargando] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [hogarId, setHogarId] = useState<string | null>(null);

  // Resuelve el hogar del usuario tras autenticarse.
  const resolverHogar = async () => {
    try {
      setHogarId(await getHogarActual());
    } catch {
      setHogarId(null);
    }
  };

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return;
      setSession(data.session);
      if (data.session) await resolverHogar();
      setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) await resolverHogar();
      else setHogarId(null);
    });
    return () => { activo = false; sub.subscription.unsubscribe(); };
  }, []);

  if (cargando) {
    return <IonApp><Centrado><IonSpinner /></Centrado></IonApp>;
  }

  if (!session) {
    return <IonApp><InstallPrompt /><Login /></IonApp>;
  }

  if (!hogarId) {
    return <IonApp><Onboarding onListo={resolverHogar} /></IonApp>;
  }

  return (
    <IonApp>
      <UpdatePrompt />
      <InstallPrompt />
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/home" component={Home} />
          <Route exact path="/add" component={AddItem} />
          <Route exact path="/item/:id" component={ItemDetail} />
          <Route exact path="/settings" component={Settings} />
          <Route exact path="/">
            <Redirect to="/home" />
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}
