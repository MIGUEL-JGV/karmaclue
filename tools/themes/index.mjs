// tools/themes/index.mjs
// Agrega todas las listas de temas curativas y fija el ORDEN de prioridad
// para resolver ambigüedades: cada palabra recibe el tema del primer grupo
// en el que aparece (la acepción principal gana).
import { naturaleza } from './naturaleza.mjs';
import { sociedad } from './sociedad.mjs';
import { abstracto } from './abstracto.mjs';

const ORDEN = [
  'Animales',
  'Aves y Peces',
  'Insectos',
  'Frutas y Verduras',
  'Comida y Bebida',
  'Naturaleza',
  'Cuerpo Humano',
  'Verbos',
  'Ciencia',
  'Medicina',
  'Salud',
  'Tecnología',
  'Astronomía',
  'Música',
  'Arte',
  'Deportes',
  'Transporte',
  'Clima',
  'Geografía',
  'Colores',
  'Números',
  'Geometría',
  'Tiempo',
  'Emociones',
  'Familia',
  'Profesiones',
  'Casa',
  'Ropa',
  'Ciudad',
  'Educación',
  'Religión',
  'Política',
];

const FUENTES = { ...naturaleza, ...sociedad, ...abstracto };

/** @type {Record<string, string[]>} */
export const TEMAS = {};
for (const tema of ORDEN) {
  const lista = FUENTES[tema] ?? [];
  if (lista.length === 0) {
    throw new Error(`Tema sin palabras: ${tema}`);
  }
  TEMAS[tema] = lista;
}