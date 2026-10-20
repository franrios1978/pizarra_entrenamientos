"use strict";

/* oxlint-disable no-unused-vars */
/* Las constantes se usan desde main.js: ambos scripts clásicos comparten el mismo ámbito global. */

/* ==========================================================================
   Crew WOD · DATOS EDITABLES
   Generado automáticamente el 21/10/2026, 1:07:04.
   ========================================================================== */

/** ID del próximo entrenamiento (el que se muestra en la pizarra). */
const NEXT_WORKOUT_ID = "next";

/** Versión de los resultados publicados. SÚBELA (+1) al publicar resultados nuevos. */
const RESULTS_VERSION = 2;

/** Contraseña del panel de administración. */
const ADMIN_PASSWORD = "Entrenoatope.1978";

/** Entrenamientos. El primero (el próximo) es el que se ve en la pizarra. */
const WORKOUTS = [
  {
    id: "next",
    date: "2026-10-22",
    time: "09:00",
    name: "AMRAP 20'",
    detail: "",
    warmup: "Dominadas: 4 series de 6 a 8 rep",
    scoring: "rounds",
    exercises: [
      {
        text: "Devil Press (con mancuernas) 8 reps",
        video: "https://www.youtube.com/watch?v=ghacPZ9fuFU",
      },
      {
        text: "Box Jump Over (Saltos al cajón) 10 rep",
      },
      {
        text: "Fondos en Paralelas 10 reps",
      },
      {
        text: "Burpee 8 reps",
      },
      {
        text: "V-Ups 12 reps",
        video: "https://www.youtube.com/watch?v=7UVgs18Y1P4",
      },
    ],
    note: "Se puntúa por rondas completas.",
  },
  {
    id: "wod-2026-10-16",
    date: "2026-10-16",
    time: "18:30",
    name: "FOR TIME 20 min'",
    detail: "",
    warmup: "Shoulder To Overhead: calent. + 3x5 rep",
    scoring: "time",
    exercises: ["Sentadillas lastradas 20 rep", "10 zancadas", "300m carrera", "x 5 rondas"],
    note: "Sin descanso (recuperar en carreta)",
  },
  {
    id: "wod-2026-10-19",
    date: "2026-10-19",
    time: "20:00",
    name: "AMRAP 20'",
    detail: "",
    warmup: "Calentamiento",
    scoring: "rounds",
    exercises: [
      "Push Press 10 reps",
      "Saltos al cajón 12 reps",
      "Dominadas 8 reps",
      "Lateral Bar-Over Burpee  10 reps",
    ],
    note: "Descanso máximo de 60 seg",
  },
];

/** Personas del grupo. */
const ATHLETES = [
  {
    id: "tu",
    name: "Fran",
  },
  {
    id: "lucia",
    name: "Lucía",
  },
  {
    id: "fernando",
    name: "Fernando",
  },
];

/** Resultados publicados. "value" es SIEMPRE un número: rondas, reps, segundos o kg. */
const SEED_RESULTS = [
  {
    id: "r-mvhamb6vl9uya",
    athleteId: "tu",
    workoutId: "wod-2026-10-16",
    value: 870,
    notes: "Sentadillas con disco de 15 kg",
  },
  {
    id: "r-mvhamb6vzgn8n",
    athleteId: "lucia",
    workoutId: "wod-2026-10-16",
    value: 870,
    notes: "Sentadilla con disco de 5 kg (10 sentadillas)\nÚltima ronda 1 vuelta de carreta",
  },
  {
    id: "r-mvhamb6v89g5m",
    athleteId: "fernando",
    workoutId: "wod-2026-10-16",
    value: 925,
    notes: "Sentadilla con disco de 15 kg",
  },
  {
    id: "r-mvhamb6vzht51",
    athleteId: "lucia",
    workoutId: "wod-2026-10-19",
    value: 4,
    notes: "",
  },
  {
    id: "r-mvhamb6vi9z8d",
    athleteId: "fernando",
    workoutId: "wod-2026-10-19",
    value: 4,
    notes: "",
  },
  {
    id: "r-mvhamb6vd769x",
    athleteId: "tu",
    workoutId: "wod-2026-10-19",
    value: 4,
    notes: "Push Press 10 reps\nSaltos al cajón 12 reps (de la quinta ronda)",
  },
];
