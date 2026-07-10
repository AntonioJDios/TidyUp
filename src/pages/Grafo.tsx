import { useEffect, useRef, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton, IonText, IonIcon
} from '@ionic/react';
import { gitNetworkOutline } from 'ionicons/icons';
import { allItems } from '../db/db';

// Vista "grafo" de la casa: habitaciones -> muebles -> objetos como nodos que
// flotan, se repelen, se unen por muelles y rebotan en los bordes. Arrastrables
// con dedo/ratón. Motor de fuerzas propio (sin librería), dibujado en canvas.
// No aporta nada funcional; es puro gustito visual.

interface Nodo {
  id: string;
  tipo: 'hab' | 'alm' | 'obj';
  label: string;
  x: number; y: number; vx: number; vy: number;
  r: number; color: string;
}
interface Arista { a: Nodo; b: Nodo; rest: number; }

const REP = 1600;      // fuerza de repulsión entre nodos
const SPRING = 0.02;   // rigidez de los muelles (aristas)
const GRAV = 0.004;    // atracción suave al centro
const DAMP = 0.88;     // rozamiento
const VMAX = 12;       // velocidad máxima

export default function Grafo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [vacio, setVacio] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0;
    let nodos: Nodo[] = [];
    let aristas: Arista[] = [];
    let arrastrado: Nodo | null = null;
    let raf = 0;
    const oscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const colorTexto = oscuro ? '#e2e8f0' : '#334155';

    const dimensionar = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const construir = async () => {
      const items = await allItems().catch(() => []);
      if (!items.length) { setVacio(true); return; }
      const map = new Map<string, Nodo>();
      const cx = W / 2, cy = H / 2;
      const add = (id: string, tipo: Nodo['tipo'], label: string, r: number, color: string): Nodo => {
        const ya = map.get(id);
        if (ya) return ya;
        const n: Nodo = {
          id, tipo, label, r, color,
          x: cx + (Math.random() - 0.5) * W * 0.6,
          y: cy + (Math.random() - 0.5) * H * 0.6,
          vx: 0, vy: 0
        };
        map.set(id, n); nodos.push(n); return n;
      };
      for (const it of items) {
        const hab = it.habitacion?.trim() || 'Sin habitación';
        const alm = it.almacenaje?.trim() || 'Sin mueble';
        const nh = add(`h:${hab}`, 'hab', hab, 24, '#3b5bdb');
        const na = add(`h:${hab}|a:${alm}`, 'alm', alm, 15, '#5c7cfa');
        const no = add(it.id, 'obj', it.nombre, 8, oscuro ? '#64748b' : '#cbd5e1');
        aristas.push({ a: nh, b: na, rest: 95 });
        aristas.push({ a: na, b: no, rest: 55 });
      }
    };

    const paso = () => {
      const cx = W / 2, cy = H / 2;
      // Repulsión entre todos los pares.
      for (let i = 0; i < nodos.length; i++) {
        for (let j = i + 1; j < nodos.length; j++) {
          const a = nodos[i], b = nodos[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1;
          const d = Math.sqrt(d2);
          const f = REP / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      // Muelles en las aristas.
      for (const e of aristas) {
        let dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = SPRING * (d - e.rest);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
      }
      // Integración + gravedad al centro + rozamiento + rebote en bordes.
      for (const n of nodos) {
        if (n === arrastrado) continue;
        n.vx += (cx - n.x) * GRAV;
        n.vy += (cy - n.y) * GRAV;
        n.vx *= DAMP; n.vy *= DAMP;
        n.vx = Math.max(-VMAX, Math.min(VMAX, n.vx));
        n.vy = Math.max(-VMAX, Math.min(VMAX, n.vy));
        n.x += n.vx; n.y += n.vy;
        if (n.x < n.r) { n.x = n.r; n.vx = -n.vx * 0.6; }
        if (n.x > W - n.r) { n.x = W - n.r; n.vx = -n.vx * 0.6; }
        if (n.y < n.r) { n.y = n.r; n.vy = -n.vy * 0.6; }
        if (n.y > H - n.r) { n.y = H - n.r; n.vy = -n.vy * 0.6; }
      }
    };

    const dibujar = () => {
      ctx.clearRect(0, 0, W, H);
      // Aristas.
      ctx.strokeStyle = oscuro ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.3)';
      ctx.lineWidth = 1;
      for (const e of aristas) {
        ctx.beginPath();
        ctx.moveTo(e.a.x, e.a.y);
        ctx.lineTo(e.b.x, e.b.y);
        ctx.stroke();
      }
      // Nodos + etiquetas.
      for (const n of nodos) {
        ctx.beginPath();
        ctx.fillStyle = n.color;
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colorTexto;
        ctx.font = n.tipo === 'hab' ? 'bold 13px sans-serif' : n.tipo === 'alm' ? '12px sans-serif' : '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + n.r + 12);
      }
    };

    const bucle = () => { paso(); dibujar(); raf = requestAnimationFrame(bucle); };

    // --- Arrastre (ratón + táctil vía pointer events) ---
    const posPuntero = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      const { x, y } = posPuntero(e);
      // Nodo más cercano bajo el dedo.
      let mejor: Nodo | null = null; let md = Infinity;
      for (const n of nodos) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < n.r + 10 && d < md) { md = d; mejor = n; }
      }
      if (mejor) { arrastrado = mejor; canvas.setPointerCapture(e.pointerId); }
    };
    const onMove = (e: PointerEvent) => {
      if (!arrastrado) return;
      const { x, y } = posPuntero(e);
      arrastrado.vx = x - arrastrado.x; // para el "fling" al soltar
      arrastrado.vy = y - arrastrado.y;
      arrastrado.x = x; arrastrado.y = y;
    };
    const onUp = () => { arrastrado = null; };

    dimensionar();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('resize', dimensionar);

    construir().then(() => { bucle(); });

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', dimensionar);
    };
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/casa" /></IonButtons>
          <IonTitle>Mi casa (grafo)</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={false}>
        {vacio ? (
          <div className="ion-padding ion-text-center" style={{ marginTop: '3rem' }}>
            <IonIcon icon={gitNetworkOutline} style={{ fontSize: 56, color: 'var(--ion-color-medium)' }} />
            <p><IonText color="medium">Guarda algún objeto y aquí verás tu casa como un grafo con el que jugar.</IonText></p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
          />
        )}
      </IonContent>
    </IonPage>
  );
}
