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
    exercises: ['Devil Press (con mancuernas)	8 reps', 'Box Jump Over (Saltos al cajón) 10 rep','Fondos en Paralelas 10 reps', 'Burpee 8 reps', 'V-Ups 12 reps'],
    note: 'Se puntúa por rondas completas.',
  },
  { id: 'cindy', date: '2026-10-17', name: 'Cindy', detail: "AMRAP 20'", scoring: 'rounds' },
  { id: 'fran', date: '2026-10-15', name: 'Fran', detail: '21-15-9', scoring: 'time' },
  { id: 'circuito', date: '2026-10-14', name: 'Circuito funcional', detail: '', scoring: 'time' },
  { id: 'dominadas', date: '2026-10-11', name: 'Dominadas', detail: 'máximo seguidas', scoring: 'reps' },
  { id: 'helen', date: '2026-10-09', name: 'Helen', detail: '3 rondas', scoring: 'time' },
  { id: 'peso-muerto', date: '2026-10-06', name: 'Peso muerto', detail: '3x5', scoring: 'weight' },
];

/** Personas del grupo. */
const ATHLETES = [
  { id: 'tu', name: 'Fran' },
  { id: 'lucia', name: 'Lucía' },
  { id: 'fernando', name: 'Fernando' },
];
