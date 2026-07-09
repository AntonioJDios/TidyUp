import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Las variables públicas de Supabase que crea la integración de Vercel llevan
// prefijos (NEXT_PUBLIC_, o ninguno) que Vite NO expone al cliente por defecto.
// Aquí las re-mapeamos a import.meta.env.VITE_* para no tener que duplicarlas a
// mano en Vercel. SOLO las públicas (URL + anon key) — RLS protege los datos.
// NUNCA mapear aquí las POSTGRES_* (dan acceso directo a la BD, deben ser secretas).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ''); // '.' = dir actual; '' = carga también las sin prefijo
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const supabaseAnonKey =
    env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey)
    },
    // En `npm run dev` reproducimos el proxy /sb -> Supabase que en producción
    // hace vercel.json. (En un equipo con el bloqueo corporativo esto igualmente
    // sale desde la máquina, así que ahí conviene probar sobre el deploy de Vercel.)
    server: {
      proxy: {
        '/sb': {
          target: supabaseUrl || 'https://uhnjnjodvemawilejatl.supabase.co',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/sb/, '')
        }
      }
    },
    plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'TidyUp',
        short_name: 'TidyUp',
        description: 'Recuerda dónde guardas las cosas en casa.',
        theme_color: '#3b5bdb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
    ]
  };
});
