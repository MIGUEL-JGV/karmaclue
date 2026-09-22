// src/client/game.tsx
import { useEffect, useState, type FormEvent } from 'react';
import type { GameRequest, GameResponse, GameStatus, RevealedLetter } from '../shared/game';

const API_PATH = '/api/game';
const REQUEST_TIMEOUT_MS = 15000;

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
  const [attempts, setAttempts] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('PLAYING');
  const [category, setCategory] = useState('Cargando...');
  const [hint, setHint] = useState('Conectando al servidor...');
  const [secretConcept, setSecretConcept] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gamesPlayed, setGamesPlayed] = useState(1);
  const [revealedLetters, setRevealedLetters] = useState<RevealedLetter[]>([]);
  const [maxReveals, setMaxReveals] = useState(1);

  // Ordinal abreviado para mostrar la posición de una letra revelada (1ª, 4ª...)
  const ordinal = (n: number) => `${n}ª`;

  const maxAttempts = 6;

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
        setErrorMsg(res.message ?? 'Error al obtener datos del juego.');
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
      setErrorMsg(res.message ?? 'Error al validar el concepto.');
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
      setErrorMsg(res.message ?? 'Error al iniciar una nueva partida.');
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
      setErrorMsg(res.message ?? 'Error al pedir la letra.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#878A8C', backgroundColor: '#FFFFFF' }}>
        <h3>Cargando KarmaClue...</h3>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '100%', boxSizing: 'border-box', fontFamily: 'sans-serif', backgroundColor: '#FFFFFF', minHeight: '100vh' }}>
      
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EDEFF1', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#1A1A1B' }}>🧩 KarmaClue</h2>
        <span style={{ fontWeight: 'bold', color: '#7C7C7C', fontSize: '14px' }}>Partida #{gamesPlayed} · Intento {attempts.length}/{maxAttempts}</span>
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
              <strong>{revealedLetters.map((r) => `${ordinal(r.index + 1)}: ${r.letter}`).join(' · ')}</strong>
            </span>
          ) : (
            <span>¿Atascado? Puedes pedir una letra extra.</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleReveal}
          disabled={submitting || gameStatus !== 'PLAYING' || revealedLetters.length >= maxReveals}
          style={{ backgroundColor: '#FFB000', color: '#1A1A1B', border: 'none', padding: '6px 12px', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', opacity: submitting || gameStatus !== 'PLAYING' || revealedLetters.length >= maxReveals ? 0.6 : 1 }}
        >
          🔠 Pedir letra {revealedLetters.length}/{maxReveals}
        </button>
      </div>

      {/* Historial de Intentos */}
      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1A1A1B' }}>Tus intentos:</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {attempts.map((guess, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #EDEFF1', borderRadius: '6px', backgroundColor: '#FFFFFF', fontSize: '14px' }}>
              <span style={{ fontWeight: 'bold', color: '#1A1A1B' }}>{guess}</span>
              <span style={{ color: secretConcept === guess || (gameStatus === 'WON' && idx === attempts.length - 1) ? '#46D160' : '#EA0027', fontWeight: 'bold' }}>
                {secretConcept === guess || (gameStatus === 'WON' && idx === attempts.length - 1) ? '✅ Correcto' : '❌ Incorrecto'}
              </span>
            </div>
          ))}
          {attempts.length === 0 && (
            <div style={{ textAlign: 'center', color: '#7C7C7C', padding: '20px 0', fontSize: '13px' }}>
              Escribe abajo tu primer concepto...
            </div>
          )}
        </div>
      </div>

      {errorMsg && <div style={{ color: '#EA0027', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>{errorMsg}</div>}

      {/* Entrada de Texto y Formulario */}
      {gameStatus === 'PLAYING' ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
          <input
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
            Enviar
          </button>
        </form>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '20px', padding: '15px', borderTop: '2px dashed #EDEFF1' }}>
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
            🎮 Jugar otra vez
          </button>
          <p style={{ color: '#7C7C7C', fontSize: '12px', marginTop: '10px' }}>¡Sigue jugando! Cada partida tiene una palabra nueva.</p>
        </div>
      )}
    </div>
  );
}

export default KarmaClueGame;