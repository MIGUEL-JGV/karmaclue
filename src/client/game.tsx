// src/client/game.tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { GameAttempt, GameRequest, GameResponse, GameStatus, RevealedLetter } from '../shared/game';

const API_PATH = '/api/game';
const REQUEST_TIMEOUT_MS = 15000;

// Animaciones CSS puras (sin dependencias): flip de casillas, shake de error,
// pop-in, confeti, spinner, pulse, contador vivo, toast y fade general.
const GAME_CSS = `
  @keyframes kcl-popIn {
    0% { transform: scale(0.6); opacity: 0; }
    60% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes kcl-flipIn {
    0% { transform: rotateX(90deg); opacity: 0.4; }
    60% { transform: rotateX(-10deg) scale(1.08, 0.94); opacity: 1; }
    100% { transform: rotateX(0deg) scale(1, 1); opacity: 1; }
  }
  @keyframes kcl-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }
  @keyframes kcl-fall {
    0% { transform: translateY(-40px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  @keyframes kcl-slideUp {
    0% { transform: translateY(16px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  @keyframes kcl-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes kcl-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
  }
  @keyframes kcl-bump {
    0% { transform: scale(1); }
    40% { transform: scale(1.25); color: #0079D3; }
    100% { transform: scale(1); }
  }
  @keyframes kcl-fadeInUp {
    0% { transform: translateY(10px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  .kcl-fade { animation: kcl-fadeInUp 0.4s ease-out both; }
  .kcl-letter { animation: kcl-popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
  .kcl-letter--flip { animation: kcl-flipIn 0.5s ease-out both; }
  .kcl-shake-box { animation: kcl-shake 0.4s ease-in-out; }
  .kcl-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: kcl-spin 0.7s linear infinite;
    margin-right: 6px;
    vertical-align: middle;
  }
  .kcl-pulse { animation: kcl-pulse 1.6s ease-in-out infinite; }
  .kcl-bump { display: inline-block; animation: kcl-bump 0.35s ease-out; }
  .kcl-reveal { display: inline-block; animation: kcl-popIn 0.3s ease-out both; }
  .kcl-toast { animation: kcl-slideUp 0.3s ease-out both; }
  .kcl-endpanel { animation: kcl-slideUp 0.45s ease-out both; }
  .kcl-confetti {
    position: fixed;
    top: 0;
    z-index: 20;
    pointer-events: none;
    animation: kcl-fall 3s ease-in forwards;
  }

  /* --- Sistema cartoon: mascota 🦊 + bocadillos + efectos cómicos --- */
  @keyframes kcl-fox-jump {
    0% { transform: translateY(0) scale(1, 1); }
    15% { transform: translateY(0) scale(1.08, 0.92); }
    40% { transform: translateY(-26px) scale(0.94, 1.08); }
    60% { transform: translateY(0) scale(1.06, 0.94); }
    75% { transform: translateY(-3px) scale(0.98, 1.02); }
    100% { transform: translateY(0) scale(1, 1); }
  }
  @keyframes kcl-fox-tremble {
    0%, 100% { transform: rotate(0deg); }
    20% { transform: rotate(-6deg); }
    40% { transform: rotate(6deg); }
    60% { transform: rotate(-4deg); }
    80% { transform: rotate(4deg); }
  }
  @keyframes kcl-fox-wobble {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-8deg); }
    75% { transform: rotate(8deg); }
  }
  @keyframes kcl-bubble-pop {
    0% { transform: scale(0.2); opacity: 0; }
    70% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes kcl-dots {
    0%, 100% { opacity: 0.2; transform: translateY(0); }
    50% { opacity: 1; transform: translateY(-3px); }
  }
  @keyframes kcl-stars-spin {
    0% { transform: rotate(0deg) scale(0.5); opacity: 0; }
    40% { opacity: 1; }
    100% { transform: rotate(360deg) scale(1.4); opacity: 0; }
  }
  @keyframes kcl-tear {
    0% { transform: translateY(0) scale(0.6); opacity: 0; }
    30% { opacity: 1; }
    100% { transform: translateY(16px) rotate(30deg) scale(1.1); opacity: 0; }
  }
  @keyframes kcl-burst-pop {
    0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
    35% { transform: scale(1.3) rotate(6deg); opacity: 1; }
    70% { transform: scale(1) rotate(0deg); opacity: 1; }
    100% { transform: scale(1.4) rotate(8deg); opacity: 0; }
  }
  @keyframes kcl-dance {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    20% { transform: translateY(-8px) rotate(-6deg); }
    40% { transform: translateY(0) rotate(0deg); }
    60% { transform: translateY(-6px) rotate(6deg); }
    80% { transform: translateY(0) rotate(0deg); }
  }
  /* --- Zorro caminante de cuerpo completo --- */
  @keyframes kcl-fox-cross {
    0% { transform: translateX(0) scaleX(-1); }
    46% { transform: translateX(calc(100vw - 100px)) scaleX(-1); }
    50% { transform: translateX(calc(100vw - 100px)) scaleX(1); }
    96% { transform: translateX(0) scaleX(1); }
    100% { transform: translateX(0) scaleX(-1); }
  }
  @keyframes kcl-fox-slide {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(calc(100vw - 100px)); }
  }
  @keyframes kcl-fox-bob {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-3px) rotate(2deg); }
  }
  @keyframes kcl-fox-leg-swing {
    0%, 100% { transform: rotate(18deg); }
    50% { transform: rotate(-18deg); }
  }
  @keyframes kcl-fox-tail-wave {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(26deg); }
  }
  .kcl-fox2-root {
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100vw;
    height: 96px;
    z-index: 25;
    pointer-events: none;
    transition: transform 0.3s ease, opacity 0.3s ease;
  }
  .kcl-fox2-root--muted {
    transform: translateY(24px) scale(0.6);
    opacity: 0.7;
  }
  .kcl-fox2-root--paused .kcl-fox-anim {
    animation-play-state: paused !important;
  }
  .kcl-fox-travel {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 96px;
    animation: kcl-fox-cross 44s linear infinite;
  }
  .kcl-fox-slide {
    position: absolute;
    left: 0;
    bottom: 84px;
    height: 0;
    animation: kcl-fox-slide 44s linear infinite;
  }
  .kcl-fox2 {
    position: relative;
    width: 96px;
    height: 84px;
    animation: kcl-fox-bob 0.5s ease-in-out infinite;
  }
  .kcl-fox2--jump { animation: kcl-fox-jump 0.9s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .kcl-fox2--party { animation: kcl-fox-jump 0.9s ease-in-out infinite; }
  .kcl-fox2--tremble { animation: kcl-fox-tremble 0.45s ease-in-out; }
  .kcl-fox2--wobble { animation: kcl-fox-wobble 0.6s ease-in-out infinite; }
  .kcl-fox2-head {
    position: absolute;
    left: 24px;
    top: 6px;
    width: 36px;
    height: 32px;
    background: #f29a38;
    border-radius: 50% 50% 45% 45%;
    z-index: 3;
  }
  .kcl-fox2-ear {
    position: absolute;
    top: -9px;
    width: 13px;
    height: 15px;
    background: #f29a38;
    border-radius: 50% 0 50% 0;
  }
  .kcl-fox2-ear--l { left: 2px; transform: rotate(-8deg); }
  .kcl-fox2-ear--r { right: 2px; transform: scaleX(-1) rotate(-8deg); }
  .kcl-fox2-ear::after {
    content: '';
    position: absolute;
    left: 3px;
    top: 3px;
    width: 7px;
    height: 8px;
    background: #3a2412;
    border-radius: 50% 0 50% 0;
  }
  .kcl-fox2-eye {
    position: absolute;
    top: 13px;
    width: 4px;
    height: 5px;
    background: #2b1b12;
    border-radius: 50%;
  }
  .kcl-fox2-eye--l { left: 9px; }
  .kcl-fox2-eye--r { right: 9px; }
  .kcl-fox2-snout {
    position: absolute;
    left: 9px;
    bottom: -2px;
    width: 18px;
    height: 12px;
    background: #fff3df;
    border-radius: 0 0 9px 9px;
  }
  .kcl-fox2-snout::after {
    content: '';
    position: absolute;
    left: 7px;
    top: 1px;
    width: 4px;
    height: 4px;
    background: #2b1b12;
    border-radius: 50%;
  }
  .kcl-fox2-body {
    position: absolute;
    left: 0;
    bottom: 6px;
    width: 72px;
    height: 38px;
    background: #f29a38;
    border-radius: 15px 15px 10px 10px;
    z-index: 1;
  }
  .kcl-fox2-belly {
    position: absolute;
    left: 14px;
    bottom: 6px;
    width: 32px;
    height: 18px;
    background: #fff3df;
    border-radius: 8px 8px 6px 6px;
  }
  .kcl-fox2-tail {
    position: absolute;
    right: -34px;
    bottom: 12px;
    width: 34px;
    height: 13px;
    background: #f29a38;
    border-radius: 10px;
    transform-origin: left center;
    animation: kcl-fox-tail-wave 0.5s ease-in-out infinite;
    z-index: 0;
  }
  .kcl-fox2-tail::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    width: 13px;
    height: 13px;
    background: #ffffff;
    border-radius: 50%;
  }
  .kcl-fox2-leg {
    position: absolute;
    bottom: 0;
    width: 10px;
    height: 18px;
    background: #e07f1f;
    border-radius: 4px;
    transform-origin: top center;
    z-index: 2;
  }
  .kcl-fox2-leg--fl { left: 2px; animation: kcl-fox-leg-swing 0.5s ease-in-out infinite; }
  .kcl-fox2-leg--bl { left: 16px; animation: kcl-fox-leg-swing 0.5s ease-in-out infinite; animation-delay: -0.25s; }
  .kcl-fox2-leg--fr { left: 44px; animation: kcl-fox-leg-swing 0.5s ease-in-out infinite; animation-delay: -0.25s; }
  .kcl-fox2-leg--br { left: 59px; animation: kcl-fox-leg-swing 0.5s ease-in-out infinite; }
  .kcl-fox-bubble {
    position: absolute;
    bottom: -2px;
    left: 32px;
    background: #ffffff;
    border: 2px solid #1a1a1b;
    border-radius: 12px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: bold;
    color: #1a1a1b;
    box-shadow: 2px 2px 0 rgba(26, 26, 27, 0.2);
    animation: kcl-bubble-pop 0.35s ease-out both;
    white-space: nowrap;
  }
  .kcl-fox-bubble::after {
    content: '';
    position: absolute;
    left: 18px;
    top: 100%;
    border: 7px solid transparent;
    border-top-color: #ffffff;
  }
  .kcl-fox-bubble::before {
    content: '';
    position: absolute;
    left: 16px;
    top: 100%;
    border: 8px solid transparent;
    border-top-color: #1a1a1b;
  }
  .kcl-fox-stars {
    position: absolute;
    inset: -8px;
    font-size: 18px;
    animation: kcl-stars-spin 1s ease-out forwards;
    pointer-events: none;
  }
  .kcl-fox-tears {
    position: absolute;
    left: 12px;
    top: 55%;
    font-size: 18px;
    animation: kcl-tear 0.9s ease-in infinite;
    pointer-events: none;
  }
  .kcl-dots span {
    display: inline-block;
    animation: kcl-dots 1s ease-in-out infinite;
    padding: 0 1px;
  }
  .kcl-burst-pop {
    position: fixed;
    z-index: 24;
    pointer-events: none;
    font-weight: bold;
    font-size: 16px;
    color: #ff4500;
    text-shadow: 1px 1px 0 #ffffff;
    animation: kcl-burst-pop 1.1s ease-out forwards;
    white-space: nowrap;
  }
  .kcl-dance-letter {
    display: inline-block;
    animation: kcl-dance 0.7s ease-in-out infinite;
  }
  .kcl-btn {
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .kcl-btn:hover:not(:disabled) { transform: scale(1.05); }
  .kcl-btn:active:not(:disabled) { transform: scale(0.93); }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
    }
  }
`;

const ERROR_BASE: GameResponse = {
  success: false,
  category: '',
  hint: '',
  attempts: [],
  gameStatus: 'PLAYING',
  concept: null,
  gamesPlayed: 1,
  revealedLetters: [],
  maxReveals: 1,
};

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  emoji: string;
  fontSize: number;
};

// PRNG determinista puro (sin Math.random): garantiza el mismo confeti en cada
// render y respeta la regla de pureza de React.
const seeded = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const CONFETTI: ConfettiPiece[] = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: seeded(i) * 100,
  delay: seeded(i + 40) * 0.8,
  duration: 2.2 + seeded(i + 80) * 1.2,
  emoji: ['🎉', '🎊', '✨', '⭐', '🟩'][i % 5] ?? '🎉',
  fontSize: 14 + seeded(i + 120) * 14,
}));

// --- Sistema cartoon: mascota reactiva 🦊 ---
type FoxMood =
  | 'idle'
  | 'thinking'
  | 'happy'
  | 'surprised'
  | 'tease'
  | 'mad'
  | 'sparkle'
  | 'party'
  | 'cry';

type FoxLook = {
  reactClass: string;
  bubble: string | null;
  extra?: 'stars' | 'tears';
};

const FOX_LOOKS: Record<FoxMood, FoxLook> = {
  idle: { reactClass: '', bubble: null },
  thinking: { reactClass: '', bubble: '···' },
  happy: { reactClass: 'kcl-fox2--jump', bubble: '¡Genial!' },
  surprised: { reactClass: 'kcl-fox2--tremble', bubble: '¿¿Cómo??' },
  tease: { reactClass: 'kcl-fox2--wobble', bubble: '¡Casi!' },
  mad: { reactClass: 'kcl-fox2--tremble', bubble: '¡Jsjs!' },
  sparkle: { reactClass: 'kcl-fox2--jump', bubble: '✨ ¡Toma!', extra: 'stars' },
  party: { reactClass: 'kcl-fox2--party', bubble: '¡¡WAZA!!' },
  cry: { reactClass: 'kcl-fox2--wobble', bubble: '¡Oh no!', extra: 'tears' },
};

type Burst = {
  id: number;
  top: number;
  left: number;
  text: string;
};

// Puntos suspensivos ondulantes para el estado "pensando"
function ThinkingDots() {
  return (
    <span className="kcl-dots" aria-hidden="true">
      <span>·</span>
      <span>·</span>
      <span>·</span>
    </span>
  );
}

function FoxMascot({ mood, foxKey, muted }: { mood: FoxMood; foxKey: number; muted: boolean }) {
  const look = FOX_LOOKS[mood];
  const reacting = mood !== 'idle';

  const rootClass = [
    'kcl-fox2-root',
    muted || reacting ? 'kcl-fox2-root--paused' : '',
    muted ? 'kcl-fox2-root--muted' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} aria-hidden="true">
      <div className="kcl-fox-travel kcl-fox-anim">
        <div
          className={reacting ? `kcl-fox2 ${look.reactClass}` : 'kcl-fox2 kcl-fox-anim'}
          key={reacting ? foxKey : 'walk'}
        >
          <div className="kcl-fox2-head">
            <span className="kcl-fox2-ear kcl-fox2-ear--l" />
            <span className="kcl-fox2-ear kcl-fox2-ear--r" />
            <span className="kcl-fox2-eye kcl-fox2-eye--l" />
            <span className="kcl-fox2-eye kcl-fox2-eye--r" />
            <span className="kcl-fox2-snout" />
            {look.extra === 'stars' && <span className="kcl-fox-stars">✨</span>}
            {look.extra === 'tears' && <span className="kcl-fox-tears">💧</span>}
          </div>
          <div className="kcl-fox2-body">
            <span className="kcl-fox2-belly" />
            <span className="kcl-fox2-tail kcl-fox-anim" />
          </div>
          <span className="kcl-fox2-leg kcl-fox2-leg--fl kcl-fox-anim" />
          <span className="kcl-fox2-leg kcl-fox2-leg--bl kcl-fox-anim" />
          <span className="kcl-fox2-leg kcl-fox2-leg--fr kcl-fox-anim" />
          <span className="kcl-fox2-leg kcl-fox2-leg--br kcl-fox-anim" />
        </div>
      </div>
      {look.bubble && (
        <div className="kcl-fox-slide kcl-fox-anim">
          <div className="kcl-fox-bubble">
            {mood === 'thinking' ? <ThinkingDots /> : look.bubble}
          </div>
        </div>
      )}
    </div>
  );
}

// La comunicación usa fetch relativo a /api, que en Devvit Web el runtime de Reddit
// redirige automáticamente hacia el servidor serverless local (Hono) con el token de auth.
async function gameApiCall(request: GameRequest): Promise<GameResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(API_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: GameResponse = await response.json();
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ...ERROR_BASE,
        message: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
      };
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Error en la llamada de API:', err);
    return {
      ...ERROR_BASE,
      message: `Error al conectar con el servidor (${detail}). Verifica tu conexión e inténtalo de nuevo.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function KarmaClueGame() {
  const [inputValue, setInputValue] = useState('');
  const [attempts, setAttempts] = useState<GameAttempt[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('PLAYING');
  const [category, setCategory] = useState('Cargando...');
  const [hint, setHint] = useState('Conectando al servidor...');
  const [secretConcept, setSecretConcept] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gamesPlayed, setGamesPlayed] = useState(1);
  const [revealedLetters, setRevealedLetters] = useState<RevealedLetter[]>([]);
  const [maxReveals, setMaxReveals] = useState(1);
  const [foxMood, setFoxMood] = useState<FoxMood>('idle');
  const [foxKey, setFoxKey] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [inputFocused, setInputFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const burstSeqRef = useRef(0);

  // Cambia el humor del zorro y re-lanza su animación
  const setFox = (mood: FoxMood) => {
    setFoxMood(mood);
    setFoxKey((k) => k + 1);
  };

  // Añade un bocadillo cómico flotante (posiciones deterministas, sin Math.random)
  const addBurst = (text: string) => {
    burstSeqRef.current += 1;
    const id = burstSeqRef.current;
    setBursts((bs) => [
      ...bs,
      { id, top: 12 + seeded(id) * 55, left: 4 + seeded(id + 13) * 75, text },
    ]);
  };

  // La mascota vuelve a su estado de reposo al cabo de unos segundos
  useEffect(() => {
    if (foxMood === 'idle') return;
    const t = setTimeout(() => setFoxMood('idle'), 3200);
    return () => clearTimeout(t);
  }, [foxMood]);

  // Deriva el humor del resultado de un intento
  const reactToResponse = (res: GameResponse) => {
    if (res.gameStatus === 'WON') {
      setFox('party');
      addBurst('¡GANASTE!');
      return;
    }
    if (res.gameStatus === 'LOST') {
      setFox('cry');
      addBurst('¡OH NO!');
      return;
    }
    const last = res.attempts[res.attempts.length - 1];
    const hasCorrect = last?.letters.some((l) => l.status === 'correct') ?? false;
    const hasPresent = last?.letters.some((l) => l.status === 'present') ?? false;
    if (hasCorrect && !hasPresent) {
      setFox('happy');
      addBurst('¡BIEN!');
    } else if (hasPresent) {
      setFox('surprised');
      addBurst('¡CASI!');
    } else {
      setFox('tease');
      addBurst('¡NOP!');
    }
  };

  // Ordinal abreviado para mostrar la posición de una letra revelada (1ª, 4ª...)
  const ordinal = (n: number) => `${n}ª`;

  const maxAttempts = 6;

  // Muestra un error en el toast y lo auto-oculta a los 3.5s
  const showError = (msg: string) => {
    setErrorMsg(msg);
    setErrorKey((k) => k + 1);
  };

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(''), 3500);
    return () => clearTimeout(t);
  }, [errorMsg]);

  // Carga inicial del juego al arrancar el componente
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      const res = await gameApiCall({ action: 'GET_STATUS' });
      if (cancelled) return;
      if (res.success) {
        setAttempts(res.attempts);
        setGameStatus(res.gameStatus);
        setCategory(res.category);
        setHint(res.hint);
        setGamesPlayed(res.gamesPlayed);
        setRevealedLetters(res.revealedLetters);
        setMaxReveals(res.maxReveals);
        if (res.concept) setSecretConcept(res.concept);
        if (res.gameStatus === 'WON') setFox('party');
        if (res.gameStatus === 'LOST') setFox('cry');
      } else {
        showError(res.message ?? 'Error al obtener datos del juego.');
      }
      setLoading(false);
    };

    void start();

    // Respaldo para que la pantalla nunca se quede congelada en "Cargando..."
    const guard = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, REQUEST_TIMEOUT_MS + 500);

    return () => {
      cancelled = true;
      clearTimeout(guard);
    };
  }, []);

  // Manejador para el envío de un nuevo intento
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const guess = inputValue.trim();
    if (!guess || gameStatus !== 'PLAYING' || submitting) return;

    setErrorMsg('');
    setSubmitting(true);
    const res = await gameApiCall({ action: 'SUBMIT_GUESS', guess });
    setSubmitting(false);

    if (res.success) {
      setAttempts(res.attempts);
      setGameStatus(res.gameStatus);
      setCategory(res.category);
      setHint(res.hint);
      setGamesPlayed(res.gamesPlayed);
      setRevealedLetters(res.revealedLetters);
      setMaxReveals(res.maxReveals);
      if (res.concept) setSecretConcept(res.concept);
      setInputValue('');
      reactToResponse(res);
    } else {
      setShaking(true);
      inputRef.current?.focus();
      setFox('mad');
      addBurst('¡JSJS!');
      showError(res.message ?? 'Error al validar el concepto.');
    }
  };

  // Manejador para empezar una partida nueva
  const handleNewGame = async () => {
    if (submitting) return;
    setErrorMsg('');
    setSubmitting(true);
    const res = await gameApiCall({ action: 'NEW_GAME' });
    setSubmitting(false);

    if (res.success) {
      setAttempts(res.attempts);
      setGameStatus(res.gameStatus);
      setCategory(res.category);
      setHint(res.hint);
      setGamesPlayed(res.gamesPlayed);
      setRevealedLetters(res.revealedLetters);
      setMaxReveals(res.maxReveals);
      setSecretConcept(null);
      setInputValue('');
      setFox('thinking');
      addBurst('¡NUEVA PARTIDA!');
    } else {
      showError(res.message ?? 'Error al iniciar una nueva partida.');
    }
  };

  // Manejador para revelar una letra extra (pista opcional)
  const handleReveal = async () => {
    if (submitting || gameStatus !== 'PLAYING' || revealedLetters.length >= maxReveals) return;
    setErrorMsg('');
    setSubmitting(true);
    const res = await gameApiCall({ action: 'REVEAL_LETTER' });
    setSubmitting(false);

    if (res.success) {
      setRevealedLetters(res.revealedLetters);
      setMaxReveals(res.maxReveals);
      setFox('sparkle');
      addBurst('✨ ¡Toma!');
    } else {
      showError(res.message ?? 'Error al pedir la letra.');
    }
  };

  const canReveal =
    !submitting && gameStatus === 'PLAYING' && revealedLetters.length < maxReveals;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#878A8C', backgroundColor: '#FFFFFF' }}>
        <h3 className="kcl-pulse">Cargando KarmaClue...</h3>
      </div>
    );
  }

  return (
    <div className="kcl-fade" style={{ padding: '20px', maxWidth: '100%', boxSizing: 'border-box', fontFamily: 'sans-serif', backgroundColor: '#FFFFFF', minHeight: '100vh' }}>
      <style>{GAME_CSS}</style>

      {/* Confeti al ganar */}
      {gameStatus === 'WON' &&
        CONFETTI.map((c) => (
          <span
            key={c.id}
            className="kcl-confetti"
            style={{ left: `${c.left}%`, fontSize: c.fontSize, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}
          >
            {c.emoji}
          </span>
        ))}

      {/* Bocadillos cómicos flotantes */}
      {bursts.map((b) => (
        <span
          key={b.id}
          className="kcl-burst-pop"
          onAnimationEnd={() => setBursts((bs) => bs.filter((x) => x.id !== b.id))}
          style={{ top: `${b.top}%`, left: `${b.left}%` }}
        >
          {b.text}
        </span>
      ))}

      {/* Mascota caricatura reactiva */}
      <FoxMascot mood={foxMood} foxKey={foxKey} muted={inputFocused} />

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EDEFF1', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#1A1A1B' }}>🧩 KarmaClue</h2>
        <span style={{ fontWeight: 'bold', color: '#7C7C7C', fontSize: '14px' }}>
          Partida #{gamesPlayed} ·{' '}
          <span className="kcl-bump" key={attempts.length}>
            Intento {attempts.length}/{maxAttempts}
          </span>
        </span>
      </div>

      {/* Tarjeta de Pistas */}
      <div style={{ backgroundColor: '#F6F8FA', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#FF4500' }}>💡 Tema: {category}</div>
        <div style={{ fontSize: '12px', color: '#4A4A4A', marginTop: '4px' }}>Pista: {hint}</div>
      </div>

      {/* Letras reveladas (pista opcional) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: '#4A4A4A', flex: 1 }}>
          {revealedLetters.length > 0 ? (
            <span>
              🔤 Letras reveladas:{' '}
              {revealedLetters.map((r, i) => (
                <span key={r.index} className="kcl-reveal">
                  <strong>
                    {ordinal(r.index + 1)}: {r.letter}
                  </strong>
                  {i < revealedLetters.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </span>
          ) : (
            <span>¿Atascado? Puedes pedir una letra extra.</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleReveal}
          disabled={!canReveal}
          className={canReveal ? 'kcl-pulse kcl-btn' : 'kcl-btn'}
          style={{ backgroundColor: '#FFB000', color: '#1A1A1B', border: 'none', padding: '6px 12px', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', opacity: canReveal ? 1 : 0.6 }}
        >
          {submitting && canReveal ? <span className="kcl-spinner" /> : null}
          🔠 Pedir letra {revealedLetters.length}/{maxReveals}
        </button>
      </div>

      {/* Historial de Intentos */}
      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1A1A1B' }}>Tus intentos:</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {attempts.map((attempt, idx) => {
            const isWinner =
              secretConcept === attempt.word ||
              (gameStatus === 'WON' && idx === attempts.length - 1);
            const isLast = idx === attempts.length - 1;
            const correct = attempt.letters.filter((l) => l.status === 'correct').length;
            const present = attempt.letters.filter((l) => l.status === 'present').length;
            const absent = attempt.letters.filter((l) => l.status === 'absent').length;
            return (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  border: isWinner ? '1px solid #46D160' : '1px solid #EDEFF1',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {attempt.letters.map((item, li) => (
                    <span
                      key={li}
                      className={isLast ? 'kcl-letter--flip' : 'kcl-letter'}
                      style={{
                        display: 'inline-flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '30px',
                        height: '30px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        color: item.status === 'absent' ? '#FFFFFF' : '#1A1A1B',
                        backgroundColor:
                          item.status === 'correct'
                            ? '#46D160'
                            : item.status === 'present'
                              ? '#FFB000'
                              : '#878A8C',
                        animationDelay: isLast ? `${li * 0.06}s` : `${li * 0.03}s`,
                      }}
                    >
                      {item.letter}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#7C7C7C' }}>
                  {isWinner
                    ? '✅ ¡Correcto!'
                    : `🟩 ${correct} en su sitio · 🟨 ${present} presente(s) · ⬜ ${absent} ausente(s)`}
                </div>
              </div>
            );
          })}
          {attempts.length === 0 && (
            <div style={{ textAlign: 'center', color: '#7C7C7C', padding: '20px 0', fontSize: '13px' }}>
              Escribe abajo tu primer concepto...
            </div>
          )}
        </div>
      </div>

      {/* Toast de errores */}
      {errorMsg && (
        <div style={{ position: 'fixed', bottom: '16px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 30, pointerEvents: 'none' }}>
          <div
            key={errorKey}
            className="kcl-toast"
            style={{ color: '#FFF', backgroundColor: '#EA0027', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', fontWeight: 'bold', maxWidth: '90%', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', textAlign: 'center' }}
          >
            {errorMsg}
          </div>
        </div>
      )}

      {/* Entrada de Texto y Formulario */}
      {gameStatus === 'PLAYING' ? (
        <form
          onSubmit={handleSubmit}
          onAnimationEnd={() => setShaking(false)}
          className={shaking ? 'kcl-shake-box' : ''}
          style={{ display: 'flex', gap: '8px', marginTop: '15px' }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Escribe aquí..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            style={{ flex: 1, padding: '10px 14px', border: '1px solid #CCC', borderRadius: '20px', outline: 'none', fontSize: '14px' }}
          />
          <button
            type="submit"
            disabled={submitting}
            className="kcl-btn"
            style={{ backgroundColor: '#0079D3', color: '#FFF', border: 'none', padding: '0 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <span className="kcl-spinner" /> : null}
            Enviar
          </button>
        </form>
      ) : (
        <div className="kcl-endpanel" style={{ textAlign: 'center', marginTop: '20px', padding: '15px', borderTop: '2px dashed #EDEFF1' }}>
          <h3 style={{ color: gameStatus === 'WON' ? '#46D160' : '#EA0027', margin: '0 0 6px 0', fontSize: '16px' }}>
            {gameStatus === 'WON' ? '🎉 ¡Ganaste!' : '💀 Fin del juego'}
          </h3>
          <p style={{ margin: '0 0 10px 0', fontSize: '13px' }}>
            El concepto era:{' '}
            {gameStatus === 'WON' && secretConcept ? (
              <span>
                👑{' '}
                {secretConcept.split('').map((ch, i) => (
                  <span
                    key={i}
                    className="kcl-dance-letter"
                    style={{ animationDelay: `${i * 0.09}s`, color: '#46D160', fontWeight: 'bold', fontSize: '18px' }}
                  >
                    {ch}
                  </span>
                ))}
              </span>
            ) : (
              <strong style={{ color: '#0079D3' }}>{secretConcept}</strong>
            )}
          </p>
          <button
            type="button"
            onClick={handleNewGame}
            disabled={submitting}
            className="kcl-btn"
            style={{ backgroundColor: '#0079D3', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <span className="kcl-spinner" /> : null}
            🎮 Jugar otra vez
          </button>
          <p style={{ color: '#7C7C7C', fontSize: '12px', marginTop: '10px' }}>¡Sigue jugando! Cada partida tiene una palabra nueva.</p>
        </div>
      )}
    </div>
  );
}

export default KarmaClueGame;