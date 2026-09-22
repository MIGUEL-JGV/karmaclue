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
    100% { transform: rotateX(0deg); opacity: 1; }
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

  const inputRef = useRef<HTMLInputElement>(null);

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
    } else {
      setShaking(true);
      inputRef.current?.focus();
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
          className={canReveal ? 'kcl-pulse' : ''}
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
          <p style={{ margin: '0 0 10px 0', fontSize: '13px' }}>El concepto era: <strong style={{ color: '#0079D3' }}>{secretConcept}</strong></p>
          <button
            type="button"
            onClick={handleNewGame}
            disabled={submitting}
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