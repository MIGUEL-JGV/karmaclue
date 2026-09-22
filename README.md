# karmaclue

Juego de adivinanzas para Reddit construido con la plataforma web de Devvit.
Cada partida propone un concepto oculto perteneciente a un tema; el jugador
dispone de 6 intentos y recibe un feedback letra por letra: cuáles están en la
posición correcta, cuáles están en la palabra pero en otro lugar y cuáles no
están.

## Características

- **Partidas multirronda**: una palabra nueva por partida, jugadas ilimitadas dentro del mismo día.
- **Pool temático curado**: `src/server/data/words.json` con 3.643 palabras repartidas en 32 temas. Se regenera con `npm run words` a partir de las listas de `tools/themes/`.
- **Feedback letra por letra**: cada intento se evalúa al estilo Wordle (correcta, presente o ausente), con manejo correcto de letras duplicadas.
- **Pistas**: la inicial siempre visible más hasta 3 letras extra por partida; la pista prioriza revelar posiciones que el jugador aún no ha resuelto.
- **Animaciones CSS puras** (sin dependencias): flip de casillas estilo Wordle, confeti al ganar, toast de errores, spinner y más, con soporte de `prefers-reduced-motion`.
- **Validación**: el intento debe tener la misma longitud que el concepto oculto y no repetir palabras ya probadas.

## Stack

| Tecnología  | Uso                                  | Documentación                        |
| ----------- | ------------------------------------ | ------------------------------------ |
| React 19    | Interfaz del webView (iframe)        | https://react.dev                    |
| Vite        | Compilación del webView              | https://vite.dev                     |
| Hono        | Lógica de backend (servidor HTTP)    | https://hono.dev                     |
| Devvit Web  | Runtime serverless + APIs de Reddit (`redis`, `reddit`, `context`) | https://developers.reddit.com |
| TypeScript  | Tipado de extremo a extremo          | https://www.typescriptlang.org       |

## Estructura

- `/src/server` — Backend serverless.
  - `index.ts`: Aplicación Hono (`/api` la concatena `/internal/triggers`).
  - `routes/api.ts`: endpoint `POST /api/game` (y `/api` como respaldo).
  - `routes/triggers.ts`: crea el post inicial de la app al instalarse (`onAppInstall`).
  - `core/post.ts`: creación del post de Devvit.
  - `data/words.json`: repositorio local de palabras `{ word, categoria }`.
- `/src/client` — Frontend ejecutado dentro del iframe de reddit.com (los entrypoints se registran en `devvit.json`).
  - `game.html` / `game.tsx`: vista expandida del juego y su UI.
  - `splash.html` / `splash.tsx`: vista inline del feed (usa el mismo componente de juego).
- `/src/shared/game.ts` — Tipos compartidos entre cliente y servidor.
- `/tools` — Generador del pool (`generate-words.mjs`) y listas curadas por tema (`themes/*.mjs`).

## Requisitos

- Node.js >= 24.18.0 (ver `.nvmrc`).
- Cuenta de Reddit conectada a Reddit for Developers.

## Comandos

| Comando             | Descripción                                                          |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Arranca el servidor de desarrollo para jugar en vivo dentro de Reddit |
| `npm run build`     | Compila los proyectos de cliente y servidor                          |
| `npm run deploy`    | Sube una nueva versión de la app                                     |
| `npm run launch`    | Publica la app para revisión                                         |
| `npm run login`     | Conecta tu CLI a Reddit                                              |
| `npm run test:types`| Comprueba los tipos de TypeScript                                    |
| `npm run lint`      | Ejecuta el linter                                                    |
| `npm run prettier`  | Formatea el código                                                   |
| `npm run words`     | Regenera `src/server/data/words.json` desde `tools/themes/`          |

## Cómo jugar

1. El post del juego se crea automáticamente al instalar la app en un subreddit.
2. Abre el post: la pista indica el tema y la longitud de la palabra.
3. Escribe conceptos con la misma longitud de letras que la palabra oculta y lee el feedback letra por letra.
4. Si te atascas, usa la pista extra (🔠 Pedir letra) o empieza una partida nueva.

## Licencia

MIT. Ver el archivo `LICENSE`.