export type GameStatus = 'PLAYING' | 'WON' | 'LOST';

export type GameAction = 'GET_STATUS' | 'NEW_GAME' | 'SUBMIT_GUESS' | 'REVEAL_LETTER';

export type GameRequest = {
  action: GameAction;
  guess?: string;
};

export type RevealedLetter = {
  index: number;
  letter: string;
};

export type LetterStatus = 'correct' | 'present' | 'absent';

export type LetterEval = {
  letter: string;
  status: LetterStatus;
};

export type GameAttempt = {
  word: string;
  letters: LetterEval[];
};

export type DailyConcept = {
  concept: string;
  category: string;
  hint: string;
};

export type GameResponse = {
  success: boolean;
  category: string;
  hint: string;
  attempts: GameAttempt[];
  gameStatus: GameStatus;
  concept: string | null;
  gamesPlayed: number;
  revealedLetters: RevealedLetter[];
  maxReveals: number;
  message?: string;
};