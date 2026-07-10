import { useEffect, useRef, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton, IonText, IonIcon,
  IonSegment, IonSegmentButton, IonLabel, IonSearchbar
} from '@ionic/react';
import { gitNetworkOutline } from 'ionicons/icons';
import { allItems, type Item } from '../db/db';

// Vista "grafo" de la casa: habitaciones -> muebles -> objetos como nodos que
// flotan, se repelen, se unen por muelles y rebotan en los bordes. Arrastrables
// con dedo/ratón. Motor de fuerzas propio (sin librería), dibujado en canvas.

interface Nodo {
  id: string; tipo: 'hab' | 'alm' | 'obj'; label: string;
  x: number; y: number; vx: number; vy: number; r: number; color: string;
}
interface Arista { a: Nodo; b: Nodo; rest: number; }

const REP = 1600, SPRING = 0.02, GRAV = 0.004, DAMP = 0.88, VMAX = 12;

type Nivel = 'hab' | 'alm' | 'todo';

export default function Grafo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [vacio, setVacio] = useState(false);
  const [nivel, setNivel] = useState<Nivel>('todo');
  const nivelRef = useRef<Nivel>('todo');
  const cambiarNivel = (n: Nivel) => { nivelRef.current = n; setNivel(n); };
  const [q, setQ] = useState('');
  const qRef = useRef('');
  const buscarEnGrafo = (v: string) => { qRef.current = v; setQ(v); };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const oscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const colorTexto = oscuro ? '#e2e8f0' : '#334155';

    let W = 0, H = 0;
    let nodos: Nodo[] = [];
    let aristas: Arista[] = [];
    let items: Item[] | null = null;
    let iniciado = false;
    let raf = 0;
    let arrastrado: Nodo | null = null;

    // Visibilidad según el nivel elegido. Al buscar, se muestra todo para poder
    // encontrar cualquier objeto aunque estés en "solo habitaciones".
    const rango = (t: Nodo['tipo']) => (t === 'hab' ? 0 : t === 'alm' ? 1 : 2);
    const maxRango = () => (nivelRef.current === 'hab' ? 0 : nivelRef.current === 'alm' ? 1 : 2);
    const visible = (n: Nodo) => (qRef.current.trim() ? true : rango(n.tipo) <= maxRango());
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const coincide = (n: Nodo) => {
      const query = norm(qRef.current.trim());
      return query.length > 0 && norm(n.label).includes(query);
    };

    const construir = (its: Item[]) => {
      const map = new Map<string, Nodo>();
      const cx = W / 2, cy = H / 2;
      const add = (id: string, tipo: Nodo['tipo'], label: string, r: number, color: string): Nodo => {
        const ya = map.get(id); if (ya) return ya;
        const n: Nodo = {
          id, tipo, label, r, color,
          x: cx + (Math.random() - 0.5) * W * 0.6,
          y: cy + (Math.random() - 0.5) * H * 0.6, vx: 0, vy: 0
        };
        map.set(id, n); nodos.push(n); return n;
      };
      for (const it of its) {
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
      for (let i = 0; i < nodos.length; i++) {
        if (!visible(nodos[i])) continue;
        for (let j = i + 1; j < nodos.length; j++) {
          if (!visible(nodos[j])) continue;
          const a = nodos[i], b = nodos[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1;
          const d = Math.sqrt(d2);
          const f = REP / d2, fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      for (const e of aristas) {
        if (!visible(e.a) || !visible(e.b)) continue;
        let dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = SPRING * (d - e.rest), fx = (dx / d) * f, fy = (dy / d) * f;
        e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
      }
      for (const n of nodos) {
        if (n === arrastrado || !visible(n)) continue;
        n.vx += (cx - n.x) * GRAV; n.vy += (cy - n.y) * GRAV;
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
      ctx.strokeStyle = oscuro ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.3)';
      ctx.lineWidth = 1;
      for (const e of aristas) {
        if (!visible(e.a) || !visible(e.b)) continue;
        ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
      }
      const hayBusqueda = qRef.current.trim().length > 0;
      for (const n of nodos) {
        if (!visible(n)) continue;
        const marcado = coincide(n);
        ctx.globalAlpha = hayBusqueda && !marcado ? 0.2 : 1;
        ctx.fillStyle = n.color;
        if (n.tipo === 'alm') {
          // Muebles/almacenajes: cuadrado (con esquinas redondeadas si el navegador puede).
          const s = n.r;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') ctx.roundRect(n.x - s, n.y - s, s * 2, s * 2, 4);
          else ctx.rect(n.x - s, n.y - s, s * 2, s * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
        }
        // Anillo de resaltado si coincide con la búsqueda.
        if (marcado) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = colorTexto;
        ctx.font = n.tipo === 'hab' ? 'bold 13px sans-serif' : n.tipo === 'alm' ? '12px sans-serif' : '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + n.r + 12);
      }
      ctx.globalAlpha = 1;
    };

    const bucle = () => { paso(); dibujar(); raf = requestAnimationFrame(bucle); };

    // Arranca solo cuando hay tamaño real (evita el canvas a 0 en la transición).
    const intentarIniciar = () => {
      if (iniciado || W === 0 || H === 0 || items === null || items.length === 0) return;
      construir(items); iniciado = true; bucle();
    };

    const medir = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        W = rect.width; H = rect.height;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      intentarIniciar();
    };

    const ro = new ResizeObserver(medir);
    ro.observe(canvas);

    // Arrastre (ratón + táctil vía pointer events).
    const pos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      const { x, y } = pos(e);
      let mejor: Nodo | null = null, md = Infinity;
      for (const n of nodos) {
        if (!visible(n)) continue;
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < n.r + 12 && d < md) { md = d; mejor = n; }
      }
      if (mejor) { arrastrado = mejor; canvas.setPointerCapture(e.pointerId); }
    };
    const onMove = (e: PointerEvent) => {
      if (!arrastrado) return;
      const { x, y } = pos(e);
      arrastrado.vx = x - arrastrado.x; arrastrado.vy = y - arrastrado.y;
      arrastrado.x = x; arrastrado.y = y;
    };
    const onUp = () => { arrastrado = null; };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    medir();
    allItems()
      .then((r) => { items = r; if (!r.length) setVacio(true); intentarIniciar(); })
      .catch(() => { items = []; setVacio(true); });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/casa" /></IonButtons>
          <IonTitle>Mi casa (grafo)</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={nivel} onIonChange={(e) => cambiarNivel(e.detail.value as Nivel)}>
            <IonSegmentButton value="hab"><IonLabel>Habitaciones</IonLabel></IonSegmentButton>
            <IonSegmentButton value="alm"><IonLabel>+ Muebles</IonLabel></IonSegmentButton>
            <IonSegmentButton value="todo"><IonLabel>Todo</IonLabel></IonSegmentButton>
          </IonSegment>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={q}
            debounce={0}
            placeholder="Resaltar en el grafo…"
            onIonInput={(e) => buscarEnGrafo(e.detail.value ?? '')}
          />
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={false}>
        {vacio ? (
          <div className="ion-padding ion-text-center" style={{ marginTop: '3rem' }}>
            <IonIcon icon={gitNetworkOutline} style={{ fontSize: 56, color: 'var(--ion-color-medium)' }} />
            <p><IonText color="medium">Guarda algún objeto y aquí verás tu casa como un grafo con el que jugar.</IonText></p>
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0 }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
            />
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
