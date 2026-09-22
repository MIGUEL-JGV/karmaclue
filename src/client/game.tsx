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
  /* --- Audiencia de mascotas reactivas --- */
  @keyframes kcl-fox-idle {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-4px) scale(1.03); }
  }
  @keyframes kcl-symbol-pop {
    0% { transform: translateY(8px) scale(0.2); opacity: 0; }
    60% { transform: translateY(-4px) scale(1.25); opacity: 1; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  .kcl-crowd {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 8px;
    display: flex;
    justify-content: center;
    gap: 30px;
    z-index: 25;
    pointer-events: none;
  }
  .kcl-mascot {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .kcl-fox-body {
    font-size: 46px;
    line-height: 1;
    animation: kcl-fox-idle 3.2s ease-in-out infinite;
    transform-origin: 50% 90%;
  }
  .kcl-fox-body--jump { animation: kcl-fox-jump 0.9s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .kcl-fox-body--party { animation: kcl-fox-jump 0.9s ease-in-out infinite; }
  .kcl-fox-body--tremble { animation: kcl-fox-tremble 0.45s ease-in-out; }
  .kcl-fox-body--wobble { animation: kcl-fox-wobble 0.6s ease-in-out infinite; }
  .kcl-fox-ground {
    width: 36px;
    height: 7px;
    margin: -3px auto 0;
    background: radial-gradient(ellipse, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0) 70%);
    border-radius: 50%;
  }
  .kcl-mascot-symbol {
    min-height: 22px;
    font-size: 16px;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
    animation: kcl-symbol-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
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

// --- Sistema cartoon: audiencia de mascotas reactivas ---
type Mood =
  | 'idle'
  | 'thinking'
  | 'happy'
  | 'surprised'
  | 'tease'
  | 'mad'
  | 'sparkle'
  | 'party'
  | 'cry';

type Animal = {
  id: string;
  emoji: string;
  label: string;
};

const ANIMALS: Animal[] = [
  { id: 'fox', emoji: '🦊', label: 'Zorro' },
  { id: 'owl', emoji: '🦉', label: 'Búho' },
  { id: 'panda', emoji: '🐼', label: 'Panda' },
  { id: 'frog', emoji: '🐸', label: 'Rana' },
  { id: 'penguin', emoji: '🐧', label: 'Pingüino' },
];

const MOOD_CLASS: Record<Mood, string> = {
  idle: '',
  thinking: '',
  happy: 'kcl-fox-body--jump',
  surprised: 'kcl-fox-body--tremble',
  tease: 'kcl-fox-body--wobble',
  mad: 'kcl-fox-body--tremble',
  sparkle: 'kcl-fox-body--jump',
  party: 'kcl-fox-body--party',
  cry: 'kcl-fox-body--wobble',
};

const MOOD_SYMBOL: Record<Mood, string | null> = {
  idle: null,
  thinking: '···',
  happy: '😄',
  surprised: '😮',
  tease: '😏',
  mad: '💢',
  sparkle: '✨',
  party: '🎉',
  cry: '💧',
};

const ALL_IDLE: Mood[] = ANIMALS.map(() => 'idle');

const allMoods = (mood: Mood): Mood[] => ANIMALS.map(() => mood);

// Rota el patrón de reacciones para que el animal "líder" vaya cambiando entre intentos
const rotatePattern = (pattern: Mood[], shift: number): Mood[] =>
  pattern.map((_, i) => pattern[(i + shift) % pattern.length] ?? 'idle');

// Patrones de reacción del coro (los animales interactúan entre sí)
const REACTIONS = {
  good: ['happy', 'surprised', 'tease', 'idle', 'happy'],
  close: ['surprised', 'tease', 'happy', 'surprised', 'idle'],
  none: ['tease', 'mad', 'tease', 'mad', 'tease'],
  error: ['mad', 'surprised', 'mad', 'tease', 'surprised'],
  reveal: ['sparkle', 'happy', 'happy', 'surprised', 'happy'],
} satisfies Record<string, Mood[]>;

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

function AnimalSlot({
  animal,
  mood,
  moodKey,
  index,
}: {
  animal: Animal;
  mood: Mood;
  moodKey: number;
  index: number;
}) {
  const symbol = MOOD_SYMBOL[mood];
  const className = `kcl-fox-body ${MOOD_CLASS[mood]}`.trim();
  const delay = `${index * 90}ms`;

  return (
    <div className="kcl-mascot" aria-hidden="true">
      {symbol && (
        <div
          key={`${moodKey}-${index}`}
          className="kcl-mascot-symbol"
          style={{ animationDelay: delay }}
        >
          {mood === 'thinking' ? <ThinkingDots /> : symbol}
        </div>
      )}
      <div key={`body-${moodKey}-${index}`} className={className} style={{ animationDelay: delay }}>
        {animal.emoji}
      </div>
      <div className="kcl-fox-ground" />
    </div>
  );
}

function AnimalCrowd({ crowd, moodKey }: { crowd: Mood[]; moodKey: number }) {
  return (
    <div className="kcl-crowd" aria-hidden="true">
      {ANIMALS.map((animal, i) => (
        <AnimalSlot
          key={animal.id}
          animal={animal}
          mood={crowd[i] ?? 'idle'}
          moodKey={moodKey}
          index={i}
        />
      ))}
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
  const [crowd, setCrowd] = useState<Mood[]>(() => [...ALL_IDLE]);
  const [crowdKey, setCrowdKey] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const burstSeqRef = useRef(0);

  // Dispara una reacción del coro: los animales se miran entre sí y reaccionan
  const setCrowdMoods = (moods: Mood[]) => {
    setCrowd(moods);
    setCrowdKey((k) => k + 1);
  };

  const setAllMood = (mood: Mood) => setCrowdMoods(allMoods(mood));

  // Añade un bocadillo cómico flotante (posiciones deterministas, sin Math.random)
  const addBurst = (text: string) => {
    burstSeqRef.current += 1;
    const id = burstSeqRef.current;
    setBursts((bs) => [
      ...bs,
      { id, top: 12 + seeded(id) * 55, left: 4 + seeded(id + 13) * 75, text },
    ]);
  };

  // El coro vuelve a su estado de reposo al cabo de unos segundos
  useEffect(() => {
    if (crowd.every((m) => m === 'idle')) return;
    const t = setTimeout(() => setCrowd([...ALL_IDLE]), 3400);
    return () => clearTimeout(t);
  }, [crowd]);

  // Deriva los humores del coro a partir del resultado de un intento: los
  // animales reaccionan entre sí con patrones rotados (el "líder" cambia)
  const reactToResponse = (res: GameResponse) => {
    if (res.gameStatus === 'WON') {
      setAllMood('party');
      addBurst('¡GANASTE!');
      return;
    }
    if (res.gameStatus === 'LOST') {
      setAllMood('cry');
      addBurst('¡OH NO!');
      return;
    }
    const last = res.attempts[res.attempts.length - 1];
    const hasCorrect = last?.letters.some((l) => l.status === 'correct') ?? false;
    const hasPresent = last?.letters.some((l) => l.status === 'present') ?? false;
    const shift = crowdKey % ANIMALS.length;
    if (hasCorrect && !hasPresent) {
      setCrowdMoods(rotatePattern(REACTIONS.good, shift));
      addBurst('¡BIEN!');
    } else if (hasPresent) {
      setCrowdMoods(rotatePattern(REACTIONS.close, shift));
      addBurst('¡CASI!');
    } else {
      setCrowdMoods(rotatePattern(REACTIONS.none, shift));
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
        if (res.gameStatus === 'WON') {
          setCrowd(allMoods('party'));
          setCrowdKey((k) => k + 1);
        }
        if (res.gameStatus === 'LOST') {
          setCrowd(allMoods('cry'));
          setCrowdKey((k) => k + 1);
        }
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
      setCrowdMoods(rotatePattern(REACTIONS.error, crowdKey % ANIMALS.length));
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
      setCrowdMoods(allMoods('thinking'));
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
      setCrowdMoods(rotatePattern(REACTIONS.reveal, crowdKey % ANIMALS.length));
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
      <AnimalCrowd crowd={crowd} moodKey={crowdKey} />

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