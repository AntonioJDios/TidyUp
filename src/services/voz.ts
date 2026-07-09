// Utilidades de voz del navegador: reconocimiento (Speech-to-Text) y locución
// (Text-to-Speech). Gratis, sin API. En navegadores sin soporte, degradan solas.

type SR = typeof window & { webkitSpeechRecognition?: any; SpeechRecognition?: any };

export function reconocimientoDisponible(): boolean {
  const w = window as SR;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// Escucha una frase y llama a onFinal con la transcripción. Devuelve un control
// para pararla manualmente.
export function escuchar(
  onFinal: (texto: string) => void,
  onError?: () => void
): { parar: () => void } {
  const w = window as SR;
  const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Rec) { onError?.(); return { parar: () => {} }; }
  const rec = new Rec();
  rec.lang = 'es-ES';
  rec.interimResults = false;
  rec.continuous = false;
  let final = '';
  rec.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
    }
  };
  rec.onend = () => { if (final.trim()) onFinal(final.trim()); };
  rec.onerror = () => onError?.();
  rec.start();
  return { parar: () => rec.stop() };
}

// Lee un texto en voz alta (español).
export function hablar(texto: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-ES';
  window.speechSynthesis.speak(u);
}
