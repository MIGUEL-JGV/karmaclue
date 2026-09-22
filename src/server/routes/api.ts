// src/server/routes/api.ts
import { Hono, type Context } from 'hono';
import { context, redis } from '@devvit/web/server';
import words from '../data/words.json';
import type {
  DailyConcept,
  GameRequest,
  GameResponse,
  GameStatus,
  RevealedLetter,
} from '../../shared/game';

const MAX_ATTEMPTS = 6;

type PickedWord = DailyConcept & {
  wordIndex: number;
};

type StoredGameState = {
  wordIndex: number;
  attempts: string[];
  gameStatus: GameStatus;
  gamesPlayed: number;
  revealedLetters: RevealedLetter[];
};

function defaultState(wordIndex: number): StoredGameState {
  return {
    wordIndex,
    attempts: [],
    gameStatus: 'PLAYING',
    gamesPlayed: 1,
    revealedLetters: [],
  };
}

// Máximo de letras extra que se pueden revelar (la inicial ya la da la pista)
function maxRevealsFor(word: string): number {
  return Math.max(1, Math.floor((word.length - 1) / 2));
}

// La fecha UTC actual se obtiene con el índice [0] del split para evitar arreglos rotos
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0] ?? '1970-01-01';
}

function wordAt(index: number): DailyConcept {
  const entry = words[index];
  if (!entry) {
    throw new Error(`Índice de palabra inválido: ${index}`);
  }
  return {
    concept: entry.word.toUpperCase(),
    category: entry.categoria,
    hint: `Palabra de ${entry.word.length} letras que empieza con la letra ${entry.word[0]?.toUpperCase() ?? '?'}.`,
  };
}

// Elige una palabra aleatoria del pool; evita repetir la última jugada
function pickWord(previousIndex?: number): PickedWord {
  if (words.length === 0) {
    throw new Error('El repositorio de palabras está vacío.');
  }
  let index = Math.floor(Math.random() * words.length);
  if (words.length > 1 && previousIndex !== undefined && index === previousIndex) {
    index = (index + 1) % words.length;
  }
  return { ...wordAt(index), wordIndex: index };
}

function toResponse(state: StoredGameState, today: DailyConcept): GameResponse {
  return {
    success: true,
    category: today.category,
    hint: today.hint,
    attempts: state.attempts,
    gameStatus: state.gameStatus,
    concept: state.gameStatus !== 'PLAYING' ? today.concept : null,
    gamesPlayed: state.gamesPlayed,
    revealedLetters: state.revealedLetters,
    maxReveals: maxRevealsFor(today.concept),
  };
}

function errorResponse(
  message: string,
  state: StoredGameState,
  today: DailyConcept
): GameResponse {
  return {
    success: false,
    category: today.category,
    hint: today.hint,
    attempts: state.attempts,
    gameStatus: 'PLAYING',
    concept: null,
    gamesPlayed: state.gamesPlayed,
    revealedLetters: state.revealedLetters,
    maxReveals: maxRevealsFor(today.concept),
    message,
  };
}

export const api = new Hono();

async function handleGameRequest(c: Context) {
  try {
    const body = await c.req.json<GameRequest>();
    const todayKey = getTodayKey();
    const userId = context.userId ?? 'usuario_anonimo';
    const userKey = `karmaclue:${userId}:${todayKey}`;

    // Cargar la partida activa del usuario (las jugadas dentro del día son ilimitadas)
    let gameState: StoredGameState | null = null;
    const raw = await redis.get(userKey);
    if (raw) {
      try {
        gameState = JSON.parse(raw) as StoredGameState;
      } catch {
        gameState = null;
      }
    }

    // Compatibilidad con partidas guardadas antes de la función de letras
    if (gameState && !Array.isArray(gameState.revealedLetters)) {
      gameState.revealedLetters = [];
    }

    // El pool se regenera entre versiones: si el índice guardado quedó fuera de
    // rango, se descarta el estado y se crea una partida fresca con una palabra válida.
    if (
      gameState &&
      (!Number.isInteger(gameState.wordIndex) ||
        gameState.wordIndex < 0 ||
        gameState.wordIndex >= words.length)
    ) {
      gameState = null;
    }

    // ACCIÓN A: Empezar una partida nueva (palabra distinta a la última)
    if (body.action === 'NEW_GAME') {
      const picked = pickWord(gameState?.wordIndex);
      gameState = {
        wordIndex: picked.wordIndex,
        attempts: [],
        gameStatus: 'PLAYING',
        gamesPlayed: (gameState?.gamesPlayed ?? 0) + 1,
        revealedLetters: [],
      };
      await redis.set(userKey, JSON.stringify(gameState));
      return c.json<GameResponse>(toResponse(gameState, picked));
    }

    // Sin partida previa: se crea automáticamente la primera del día
    if (!gameState) {
      const picked = pickWord();
      gameState = defaultState(picked.wordIndex);
      await redis.set(userKey, JSON.stringify(gameState));
      return c.json<GameResponse>(toResponse(gameState, picked));
    }

    const today = wordAt(gameState.wordIndex);

    // ACCIÓN B: Estado de la partida en curso
    if (body.action === 'GET_STATUS') {
      return c.json<GameResponse>(toResponse(gameState, today));
    }

    // ACCIÓN C: Enviar intento
    if (body.action === 'SUBMIT_GUESS') {
      const guess = body.guess?.trim().toUpperCase();
      if (!guess) {
        return c.json<GameResponse>(errorResponse('Escribe un concepto para enviar tu intento.', gameState, today));
      }
      if (gameState.gameStatus !== 'PLAYING') {
        return c.json<GameResponse>(errorResponse('Esta partida ya terminó. Empieza una nueva.', gameState, today));
      }
      if (gameState.attempts.includes(guess)) {
        return c.json<GameResponse>(errorResponse('Ya intentaste con esta palabra.', gameState, today));
      }

      gameState.attempts.push(guess);

      // Evaluar las condiciones de victoria o derrota
      if (guess === today.concept) {
        gameState.gameStatus = 'WON';
      } else if (gameState.attempts.length >= MAX_ATTEMPTS) {
        gameState.gameStatus = 'LOST';
      }

      // Persistir el estado actualizado de la partida
      await redis.set(userKey, JSON.stringify(gameState));

      return c.json<GameResponse>(toResponse(gameState, today));
    }

    // ACCIÓN D: Revelar una letra extra (pista opcional)
    if (body.action === 'REVEAL_LETTER') {
      const maxReveals = maxRevealsFor(today.concept);

      if (gameState.gameStatus !== 'PLAYING') {
        return c.json<GameResponse>(errorResponse('Esta partida ya terminó. Empieza una nueva.', gameState, today));
      }
      if (gameState.revealedLetters.length >= maxReveals) {
        return c.json<GameResponse>(errorResponse('No puedes pedir más letras en esta partida.', gameState, today));
      }

      // La pista ya muestra la inicial (índice 0); se revela otra posición al azar
      const alreadyRevealed = new Set(gameState.revealedLetters.map((r) => r.index));
      const candidates: number[] = [];
      for (let i = 1; i < today.concept.length; i += 1) {
        if (!alreadyRevealed.has(i)) {
          candidates.push(i);
        }
      }
      if (candidates.length === 0) {
        return c.json<GameResponse>(errorResponse('No quedan letras por revelar.', gameState, today));
      }

      const pickIndex = Math.floor(Math.random() * candidates.length);
      const index = candidates[pickIndex];
      if (index === undefined) {
        return c.json<GameResponse>(errorResponse('No quedan letras por revelar.', gameState, today));
      }
      gameState.revealedLetters.push({
        index,
        letter: today.concept[index] ?? '',
      });

      // Persistir el estado actualizado de la partida
      await redis.set(userKey, JSON.stringify(gameState));

      return c.json<GameResponse>(toResponse(gameState, today));
    }

    return c.json<GameResponse>(errorResponse('Acción no reconocida.', gameState, today));
  } catch (error) {
    console.error('Error en el endpoint /api:', error);
    return c.json<GameResponse>(
      {
        success: false,
        category: '',
        hint: '',
        attempts: [],
        gameStatus: 'PLAYING',
        concept: null,
        gamesPlayed: 1,
        revealedLetters: [],
        maxReveals: 1,
        message: 'Error interno al procesar la solicitud.',
      },
      500
    );
  }
}

// Devvit Web exige sub-rutas bajo /api (ej: /api/game, /api/init).
// Se registra también /api a secas como respaldo.
api.post('/', handleGameRequest);
api.post('/game', handleGameRequest);