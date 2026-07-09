// Función serverless de Vercel: proxy hacia Google Gemini.
//
// Esconde la clave de la API. El navegador llama AQUÍ (mismo origen, /api/gemini)
// y esta función habla con Google usando GEMINI_KEY, que vive SOLO como variable
// de entorno del servidor en Vercel y nunca llega al cliente.
//
// Configura la variable en Vercel: Project -> Settings -> Environment Variables
//   GEMINI_KEY = tu_clave_de_google_ai_studio
//
// Aviso: sin autenticación este endpoint es un "proxy abierto"; cualquiera que
// descubra la URL puede gastar la cuota. Aceptable para uso familiar con URL
// discreta y plan gratuito. Al abrirlo al público, añadir login/rate-limiting.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Tipado laxo (req/res) para no depender de @vercel/node; esta carpeta la
// compila Vercel aparte, fuera del tsc del proyecto.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const key = process.env.GEMINI_KEY;
  if (!key) {
    res.status(500).json({ error: 'Falta la variable de entorno GEMINI_KEY en el servidor.' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
    const { tipo, model, parts, texto } = body;

    if (tipo === 'generar') {
      const r = await fetch(`${API_BASE}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        })
      });
      const data = await r.json();
      if (!r.ok) {
        res.status(r.status).json({ error: JSON.stringify(data) });
        return;
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      res.status(200).json({ text });
      return;
    }

    if (tipo === 'embed') {
      const r = await fetch(`${API_BASE}/${model}:embedContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text: texto }] }
        })
      });
      const data = await r.json();
      if (!r.ok) {
        res.status(r.status).json({ error: JSON.stringify(data) });
        return;
      }
      res.status(200).json({ values: data?.embedding?.values ?? [] });
      return;
    }

    res.status(400).json({ error: `Tipo de petición desconocido: ${tipo}` });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
}
