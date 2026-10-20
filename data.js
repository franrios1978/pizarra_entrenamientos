'use strict';

/* oxlint-disable no-unused-vars */
/* Las constantes se usan desde main.js: ambos scripts clásicos comparten el mismo ámbito global. */

/* ==========================================================================
   Crew WOD · DATOS EDITABLES
   Este archivo solo contiene datos: aquí no hay lógica.
   Para cambiar la pizarra o el grupo, edita este archivo y recarga la página.

   Formatos:
   - date: AAAA-MM-DD (ej.: '2026-10-24')
   - scoring: tipo de resultado, debe ser uno de estos:
       'rounds'  → rondas completas          (gana el más alto)
       'reps'    → repeticiones              (gana el más alto)
       'time'    → tiempo en mm:ss           (gana el más BAJO)
       'weight'  → peso en kg, admite coma  (gana el más alto)
   - "próximo entreno": el que tenga id igual a NEXT_WORKOUT_ID.
     Además de los campos comunes, puede llevar time, warmup, exercises y note,
     que son los que se muestran en la pizarra grande.
   ========================================================================== */

/** ID del próximo entrenamiento (el que se muestra en la pizarra). */
const NEXT_WORKOUT_ID = 'next';

/** Entrenamientos. El primero (el próximo) es el que se ve en la pizarra. */
const WORKOUTS = [
  {
    id: NEXT_WORKOUT_ID,
    date: '2026-10-22',
    time: '09:00',
    name: "AMRAP 20'",
    detail: '',
    warmup: 'Dominadas: 4 series de 6 a 8 rep',
    scoring: 'rounds',
    exercises: [
      // Elige tus vídeos y pega la URL entre las comillas del campo "video"
      { text: 'Devil Press (con mancuernas) 8 reps', video: 'https://www.youtube.com/watch?v=ghacPZ9fuFU' },
      { text: 'Box Jump Over (Saltos al cajón) 10 rep'},
      { text: 'Fondos en Paralelas 10 reps' },
      { text: 'Burpee 8 reps' },
      { text: 'V-Ups 12 reps', video: 'https://www.youtube.com/watch?v=7UVgs18Y1P4' },
    ],
    note: 'Se puntúa por rondas completas.',
  },
  {
    id: 'wod-2026-10-16',
    date: '2026-10-16',
    time: '18:30',
    name: "FOR TIME 20 min'",
    detail: '',
    warmup: 'Shoulder To Overhead: calent. + 3x5 rep',
    scoring: 'time',
    exercises: ['Sentadillas lastradas 20 rep', '10 zancadas', '300m carrera', 'x 5 rondas'],
    note: 'Sin descanso (recuperar en carreta)',
  },
  {
    id: 'wod-2026-10-19',
    date: '2026-10-19',
    time: '20:00',
    name: "AMRAP 20'",
    detail: '',
    warmup: 'Calentamiento',
    scoring: 'rounds',
    exercises: ['Push Press 10 reps', 'Saltos al cajón 12 reps', 'Dominadas 8 reps', 'Lateral Bar-Over Burpee  10 reps'],
    note: 'Descanso máximo de 60 seg',
  },
];

/** Personas del grupo. */
const ATHLETES = [
  { id: 'tu', name: 'Fran' },
  { id: 'lucia', name: 'Lucía' },
  { id: 'fernando', name: 'Fernando' },
];

/**
 * Resultados iniciales. Se cargan la primera vez que se abre la web
 * (después se guardan en el navegador de cada persona).
 * Arranca vacía: aquí podrías poner resultados de partida si algún día quieres.
 * "value" es SIEMPRE un número: rondas, repeticiones, segundos o kg.
 */
const SEED_RESULTS = [];
