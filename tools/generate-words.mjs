import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { TEMAS } from './themes/index.mjs';

const require = createRequire(import.meta.url);

const SOURCE = 'an-array-of-spanish-words';
const OUTPUT = new URL('../src/server/data/words.json', import.meta.url);

// Solo tokens de una sola palabra en minúsculas, longitud jugable (3-12)
function isValidWord(word) {
  return /^[a-zñáéíóúü]{3,12}$/.test(word);
}

// Equiparar para el índice: sin acentos y en minúsculas
function normalize(word) {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Diccionario de referencia SOLO para validación (los temas curados son la fuente del pool)
const dictionary = new Set(require(SOURCE).map(normalize));

const entries = [];
const seen = new Set();
const missing = [];
const ignored = new Map();

for (const [categoria, words] of Object.entries(TEMAS)) {
  for (const raw of words) {
    const word = raw.trim().toLowerCase();
    if (!isValidWord(word)) {
      ignored.set(categoria, (ignored.get(categoria) ?? 0) + 1);
      continue;
    }
    const key = normalize(word);
    if (seen.has(key)) {
      continue;
    }
    if (!dictionary.has(key)) {
      missing.push({ word, categoria });
    }
    seen.add(key);
    entries.push({ word, categoria });
  }
}

entries.sort((a, b) => a.word.localeCompare(b.word, 'es'));

await writeFile(OUTPUT, `${JSON.stringify(entries)}\n`, 'utf8');

const cuentaPorTema = Object.fromEntries(
  Object.entries(TEMAS).map(([tema]) => [tema, entries.filter((e) => e.categoria === tema).length]),
);

console.log('--- Resumen de temas ---');
for (const [tema, cuenta] of Object.entries(cuentaPorTema)) {
  console.log(`${tema.padEnd(20)} ${String(cuenta).padStart(5)} palabras`);
}
console.log('---');
console.log(`OK: ${entries.length} palabras únicas → ${OUTPUT}`);
console.log(`Ignoradas (formato inválido): ${[...ignored.values()].reduce((a, b) => a + b, 0)}`);
if (missing.length > 0) {
  console.warn(`Aviso: ${missing.length} palabras curadas no están en el diccionario de referencia (aun así se incluyen):`);
  console.warn(missing.slice(0, 20).map((m) => `${m.word} (${m.categoria})`).join(', '));
}