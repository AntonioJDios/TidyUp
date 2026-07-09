import { createClient } from '@supabase/supabase-js';

// Apuntamos al proxy same-origin `/sb` (definido en vercel.json y en el server de
// Vite) en vez de a https://*.supabase.co directamente. Así el navegador solo
// habla con nuestro propio dominio y esquivamos el bloqueo corporativo de las
// URLs de Supabase. Vercel/Vite reenvían por detrás a Supabase de verdad.
const SUPABASE_URL = `${window.location.origin}/sb`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  // Aviso temprano y claro si falta la variable en el entorno de build.
  console.error('Falta VITE_SUPABASE_ANON_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel).');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Usamos código OTP (6 dígitos), no enlace mágico, así que no hay token en la URL.
    detectSessionInUrl: false
  }
});
