Estás escribiendo una aplicación web de Devvit que se ejecutará en reddit.com.

## Stack tecnológico

- **Frontend**: React 19, Vite
- **Backend**: entorno serverless de Node.js >= 24 (Devvit Web), Hono
- **Comunicación**: fetch relativo a `/api` (`POST /api/game`), con tipado de extremo a extremo a través de `src/shared/game.ts`

## Layout y arquitectura

- `/src/server`: **Código de backend**. Se ejecuta en un entorno seguro y serverless.
  - `routes/api.ts`: enrutador de la API del juego (`GET_STATUS`, `NEW_GAME`, `SUBMIT_GUESS`, `REVEAL_LETTER`).
  - `routes/triggers.ts`: disparador `onAppInstall` que crea el post inicial.
  - `core/post.ts`: creación del post de Devvit.
  - `data/words.json`: repositorio local de palabras `{ word, categoria }`.
  - `index.ts`: punto de entrada principal del servidor (aplicación Hono).
  - Accede a `redis`, `reddit` y `context` aquí mediante `@devvit/web/server`.
- `/src/client`: **Código de frontend**. Se ejecuta dentro de un iframe en reddit.com.
  - Para añadir un entrypoint, crea un archivo HTML y agrégale el mapeo en `devvit.json`.
  - Entrypoints:
    - `game.html`: el entrypoint principal de React (vista expandida).
    - `splash.html`: el entrypoint inicial de React (vista inline). Se muestra en el feed de reddit.com. Manténlo rápido y deja las dependencias pesadas dentro de `game.html`.
- `/src/shared`: **Código compartido**. Código para compartir entre el cliente y el servidor.

## Frontend

### Reglas

- En lugar de `window.location` o `window.assign`, usa `navigateTo` de `@devvit/web/client`

### Limitaciones

- `window.alert`: usa `showToast` o `showForm` de `@devvit/web/client`
- Descargas de archivos: usa la API de portapapeles con `showToast` para confirmar
- APIs web de geolocalización, cámara, micrófono y notificaciones: no hay alternativas
- Etiquetas de script inline dentro de archivos `html`: usa una etiqueta `<script>` y un archivo js/ts aparte

## Comandos

- `npm run test:types`: comprueba los tipos de TypeScript
- `npm run lint`: ejecuta el linter
- `npm run build`: compila los proyectos de cliente y servidor
- `npm run words`: regenera el repositorio de palabras temáticas
- `npm run dev`: servidor de desarrollo en vivo dentro de Reddit

## Estilo de código

- Prefiere alias de tipo (`type`) sobre `interface` al escribir TypeScript
- Prefiere exportaciones con nombre sobre exportaciones por defecto
- Nunca hagas casts de tipos de TypeScript

## Reglas globales

- Puede que encuentres código que haga referencia a bloques o a `@devvit/public-api` al construir una función. NO uses ese código: este proyecto está configurado únicamente con Devvit web.
- Cada vez que añadas un endpoint accesible desde reddit.com (menús, formularios, disparadores o entrypoints), asegúrate de haber añadido el mapeo correspondiente en `devvit.json` para que quede registrado correctamente

Docs: https://developers.reddit.com/docs/llms.txt.