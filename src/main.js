'use strict';

/* ==========================================================================
   Crew WOD · lógica de la página (JavaScript vanilla, sin dependencias)

   Índice:
   1. Datos (en src/data.js)
   2. Tipos de puntuación (cómo se lee, se formatea y se ordena un resultado)
   3. Almacenamiento (localStorage)
   4. Utilidades (fechas, DOM)
   5. Estado y consultas
   6. Pintado de cada zona de la página
   7. Eventos
   8. Arranque
   ========================================================================== */


/* ==========================================================================
   1. DATOS
   Los datos editables (atletas, entrenamientos, resultados de ejemplo)
   están en src/data.js, que se carga antes que este archivo.
   ========================================================================== */


/* ==========================================================================
   2. TIPOS DE PUNTUACIÓN
   Cada tipo sabe:
   - parse:  texto escrito por el usuario -> número (o null si no es válido)
   - format: número -> texto para mostrar
   - higherIsBetter: si gana el valor más alto (rondas, kg) o el más bajo (tiempo)
   Para añadir un tipo nuevo (por ejemplo "calorías") basta con añadirlo aquí.
   ========================================================================== */

const SCORING = {
  rounds: {
    higherIsBetter: true,
    parse: parseWholeNumber,
    format: (n) => `${n} ${n === 1 ? 'ronda' : 'rondas'}`,
    placeholder: 'Ej.: 18',
    hint: 'Rondas completas (número entero).',
  },
  reps: {
    higherIsBetter: true,
    parse: parseWholeNumber,
    format: (n) => `${n} reps`,
    placeholder: 'Ej.: 12',
    hint: 'Repeticiones (número entero).',
  },
  time: {
    higherIsBetter: false, // en un tiempo gana el más bajo
    parse: parseTime,
    format: formatTime,
    placeholder: 'Ej.: 12:48',
    hint: 'Tiempo en mm:ss (o h:mm:ss).',
  },
  weight: {
    higherIsBetter: true,
    parse: parseDecimal,
    format: (kg) => `${kg.toLocaleString('es-ES')} kg`,
    placeholder: 'Ej.: 85',
    hint: 'Peso en kg (admite decimales: 82,5).',
  },
};

/** "18" -> 18. Devuelve null si no es un entero positivo. */
function parseWholeNumber(text) {
  const clean = text.trim();
  return /^\d{1,3}$/.test(clean) && Number(clean) > 0 ? Number(clean) : null;
}

/** "82,5" o "82.5" -> 82.5. Devuelve null si no es un número positivo razonable. */
function parseDecimal(text) {
  const clean = text.trim().replace(',', '.');
  return /^\d{1,3}(\.\d{1,2})?$/.test(clean) && Number(clean) > 0 ? Number(clean) : null;
}

/** "12:48" o "1:02:03" -> segundos. Devuelve null si el formato no es válido. */
function parseTime(text) {
  // Grupos: horas (opcional) : minutos : segundos
  const match = text.trim().match(/^(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (match[1] !== undefined && minutes > 59) return null; // 1:75:00 no existe

  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/** 768 -> "12:48"; 3723 -> "1:02:03". */
function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
    : `${minutes}:${ss}`;
}


/* ==========================================================================
   3. ALMACENAMIENTO
   IMPORTANTE: localStorage guarda los datos solo en el navegador de cada persona.
   Sirve para probar la web, pero tus amigos NO verán los resultados de los demás.
   Para compartirlos hace falta un servidor o una base de datos (Firebase,
   Supabase, una API propia...). Todo el acceso a datos pasa por este objeto,
   así que bastará con reescribir load() y save() cuando llegue ese momento.
   ========================================================================== */

const STORAGE_KEY = 'crewwod:results:v1';

const store = {
  /** Devuelve los resultados guardados (lista vacía si no hay nada válido). */
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved)) {
        // Ignora resultados de atletas o entrenamientos que ya no existen en data.js
        // (por ejemplo datos antiguos guardados antes de editar ATHLETES/WORKOUTS).
        return saved.filter(
          (result) => athleteById.has(result.athleteId) && workoutById.has(result.workoutId)
        );
      }
    } catch {
      // Sin acceso a localStorage (modo privado) o JSON dañado: empezamos de cero.
    }
    return [];
  },

  /** Guarda la lista completa. Devuelve false si el navegador no lo permite. */
  save(results) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
      return true;
    } catch {
      return false;
    }
  },
};


/* ==========================================================================
   4. UTILIDADES
   ========================================================================== */

/** Atajo para document.querySelector. */
const $ = (selector, root = document) => root.querySelector(selector);

/**
 * Crea un elemento: el("li", { class: "x" }, "texto", otroNodo).
 * Los textos se insertan como texto (nunca como HTML), así que lo que escriba
 * un usuario en el formulario no puede inyectar código en la página.
 */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

/** "2026-10-24" (+ hora opcional) -> Date en hora local. */
function toDate(isoDate, time = '00:00') {
  return new Date(`${isoDate}T${time}`);
}

/** "2026-10-14" -> "14 oct". */
function formatShortDate(isoDate) {
  return toDate(isoDate)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    .replace('.', '');
}

/** "2026-10-24" -> "sáb 24 oct". */
function formatLongDate(isoDate) {
  return toDate(isoDate)
    .toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/[.,]/g, '');
}

/** Título completo de un entrenamiento: "Cindy · AMRAP 20'". */
function workoutTitle(workout) {
  return [workout.name, workout.detail].filter(Boolean).join(' · ');
}

/** ID único sencillo para cada resultado nuevo. */
function makeId() {
  return `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}


/* ==========================================================================
   5. ESTADO Y CONSULTAS
   "state" es la única fuente de verdad: los render*() leen de aquí y pintan.
   ========================================================================== */

const athleteById = new Map(ATHLETES.map((athlete) => [athlete.id, athlete]));
const workoutById = new Map(WORKOUTS.map((workout) => [workout.id, workout]));

const state = {
  results: store.load(),
  historyAthleteId: ATHLETES[0].id,
  rankingWorkoutId: null, // se calcula en init()
};

/** Entrenamientos del más reciente al más antiguo. */
const workoutsNewestFirst = [...WORKOUTS].sort((a, b) => b.date.localeCompare(a.date));

/** Entrenamientos que ya tienen al menos un resultado (para el ranking). */
function workoutsWithResults() {
  return workoutsNewestFirst.filter((workout) =>
    state.results.some((result) => result.workoutId === workout.id)
  );
}

/**
 * Clasificación de un entrenamiento, de mejor a peor.
 * Si dos personas empatan comparten posición (1, 1, 3...).
 */
function buildRanking(workoutId) {
  const { higherIsBetter } = SCORING[workoutById.get(workoutId).scoring];

  const sorted = state.results
    .filter((result) => result.workoutId === workoutId)
    .sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));

  let rank = 0;
  return sorted.map((result, index) => {
    if (index === 0 || result.value !== sorted[index - 1].value) rank = index + 1;
    return { ...result, rank };
  });
}

/**
 * Guarda un resultado. Cada persona tiene un único resultado por entrenamiento:
 * si ya existía, se actualiza en lugar de duplicarlo.
 * Devuelve "created" o "updated".
 */
function saveResult({ athleteId, workoutId, value, notes }) {
  const existing = state.results.find(
    (result) => result.athleteId === athleteId && result.workoutId === workoutId
  );

  if (existing) {
    Object.assign(existing, { value, notes });
    return 'updated';
  }

  state.results.push({ id: makeId(), athleteId, workoutId, value, notes });
  return 'created';
}


/* ==========================================================================
   6. PINTADO
   ========================================================================== */

// Referencias al DOM que se usan varias veces
const rankingSelect = $('#ranking-workout');
const historyChips = $('#history-chips');
const form = $('#result-form');
const athleteSelect = $('#athlete');
const workoutSelect = $('#workout');
const resultInput = $('#result');
const resultHint = $('#result-hint');
const resultField = $('#result-field');
const timeInput = $('#tiempo');
const timeHint = $('#tiempo-hint');
const formStatus = $('#form-status');

/** Pizarra con el próximo entrenamiento (no cambia mientras se usa la web). */
function renderNextWorkout() {
  const workout = workoutById.get(NEXT_WORKOUT_ID);

  const when = $('#next-date');
  when.textContent = `${formatLongDate(workout.date)} · ${workout.time}`;
  when.dateTime = `${workout.date}T${workout.time}`;

  $('#board-title').textContent = workoutTitle(workout);

  // Texto previo (warmup): si está vacío, se oculta para no dejar un hueco
  const warmup = $('#next-warmup');
  warmup.textContent = workout.warmup ?? '';
  warmup.hidden = !workout.warmup;

  $('#next-exercises').replaceChildren(
    ...workout.exercises.map((exercise) => el('li', {}, exercise))
  );
  $('#next-note').textContent = workout.note;
}

/** Lista de entrenamientos que se pueden elegir en el desplegable del ranking. */
function renderRankingOptions() {
  rankingSelect.replaceChildren(
    ...workoutsWithResults().map((workout) =>
      el('option', { value: workout.id }, `${workoutTitle(workout)} · ${formatShortDate(workout.date)}`)
    )
  );
}

/** Ranking del entrenamiento seleccionado. */
function renderRanking() {
  const list = $('#ranking-list');
  const workout = workoutById.get(state.rankingWorkoutId);

  if (!workout) {
    $('#ranking-title').textContent = 'Ranking';
    list.replaceChildren(el('li', { class: 'ranking__empty' }, 'Todavía no hay resultados.'));
    rankingSelect.disabled = true;
    return;
  }

  const scoring = SCORING[workout.scoring];
  $('#ranking-title').textContent = `Ranking · ${workout.name} (${formatShortDate(workout.date)})`;

  list.replaceChildren(
    ...buildRanking(workout.id).map((entry) =>
      el(
        'li',
        { class: 'ranking__item' },
        el(
          'span',
          { class: entry.rank === 1 ? 'ranking__pos ranking__pos--first' : 'ranking__pos' },
          String(entry.rank)
        ),
        el('span', { class: 'ranking__name' }, athleteById.get(entry.athleteId).name),
        el('span', { class: 'ranking__score' }, scoring.format(entry.value))
      )
    )
  );

  rankingSelect.disabled = false;
  rankingSelect.value = workout.id;
}

/** Botones con los nombres de las personas. Se crean una sola vez. */
function buildHistoryChips() {
  historyChips.replaceChildren(
    ...ATHLETES.map((athlete) =>
      el('button', { type: 'button', class: 'chip', 'data-athlete': athlete.id }, athlete.name)
    )
  );
}

/** Historial de la persona seleccionada. */
function renderHistory() {
  // Marca el botón activo (aria-pressed también lo anuncian los lectores de pantalla)
  for (const chip of historyChips.children) {
    chip.setAttribute('aria-pressed', String(chip.dataset.athlete === state.historyAthleteId));
  }

  const athlete = athleteById.get(state.historyAthleteId);
  $('#history-caption').textContent = `Resultados de ${athlete.name}`;

  const rows = state.results
    .filter((result) => result.athleteId === state.historyAthleteId)
    .map((result) => ({ result, workout: workoutById.get(result.workoutId) }))
    .sort((a, b) => b.workout.date.localeCompare(a.workout.date))
    .map(({ result, workout }) =>
      el(
        'tr',
        {},
        el('td', {}, el('time', { datetime: workout.date }, formatShortDate(workout.date))),
        el(
          'td',
          {},
          workoutTitle(workout),
          // Las notas solo se muestran si existen
          ...(result.notes ? [el('span', { class: 'results__notes' }, result.notes)] : [])
        ),
        el('td', { class: 'results__value' }, SCORING[workout.scoring].format(result.value))
      )
    );

  $('#history-body').replaceChildren(
    ...(rows.length
      ? rows
      : [el('tr', {}, el('td', { colspan: '3' }, `${athlete.name} todavía no tiene resultados.`))])
  );
}

/** Rellena los desplegables del formulario (una sola vez). */
function buildFormOptions() {
  athleteSelect.replaceChildren(
    ...ATHLETES.map((athlete) => el('option', { value: athlete.id }, athlete.name))
  );

  workoutSelect.replaceChildren(
    ...workoutsNewestFirst.map((workout) =>
      el('option', { value: workout.id }, `${workoutTitle(workout)} · ${formatShortDate(workout.date)}`)
    )
  );
  workoutSelect.value = NEXT_WORKOUT_ID;
}

/**
 * Ajusta el ejemplo y la ayuda del campo según el tipo de entrenamiento elegido.
 * En los entrenos de tiempo el resultado se escribe en el campo Tiempo
 * (se oculta Resultado para no pedir lo mismo dos veces).
 */
function updateResultHint() {
  const scoring = SCORING[workoutById.get(workoutSelect.value).scoring];
  const isTime = scoring === SCORING.time;

  resultField.hidden = isTime;
  timeHint.textContent = isTime ? scoring.hint : '';

  if (!isTime) {
    resultInput.placeholder = scoring.placeholder;
    resultHint.textContent = scoring.hint;
  }
  resultInput.removeAttribute('aria-invalid');
  timeInput.removeAttribute('aria-invalid');
}

/** Mensaje bajo el formulario. */
function showStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle('is-error', isError);
}

/** Repinta las zonas que dependen de los resultados. */
function renderAll() {
  renderRankingOptions();
  renderRanking();
  renderHistory();
}


/* ==========================================================================
   7. EVENTOS
   ========================================================================== */

/** Cambiar de persona en el historial (delegación: un solo listener para todos los botones). */
historyChips.addEventListener('click', (event) => {
  const chip = event.target.closest('button[data-athlete]');
  if (!chip) return;

  state.historyAthleteId = chip.dataset.athlete;
  renderHistory();
});

/** Cambiar de ranking desde el desplegable. */
rankingSelect.addEventListener('change', () => {
  state.rankingWorkoutId = rankingSelect.value;
  renderRanking();
});

/** Al cambiar de entrenamiento en el formulario, cambia el formato esperado. */
workoutSelect.addEventListener('change', updateResultHint);

/** Al volver a escribir se limpian el error y el mensaje anterior. */
function clearErrorOnInput(input) {
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    if (formStatus.classList.contains('is-error')) showStatus('');
  });
}
clearErrorOnInput(resultInput);
clearErrorOnInput(timeInput);

/** "Apuntar mi resultado": el enlace ya baja al formulario; aquí preparamos el campo. */
$('[data-action="focus-form"]').addEventListener('click', () => {
  workoutSelect.value = NEXT_WORKOUT_ID;
  updateResultHint();
  // preventScroll: el desplazamiento suave lo hace el propio enlace
  const focusTarget =
    workoutById.get(NEXT_WORKOUT_ID).scoring === 'time' ? timeInput : resultInput;
  focusTarget.focus({ preventScroll: true });
});

/** Guardar un resultado. */
form.addEventListener('submit', (event) => {
  event.preventDefault(); // evitamos que el navegador recargue la página

  const data = new FormData(form);
  const athleteId = data.get('athlete');
  const workout = workoutById.get(data.get('workout'));
  const scoring = SCORING[workout.scoring];

  // 1) Validar el resultado: en los entrenos de tiempo se lee del campo Tiempo
  const isTime = scoring === SCORING.time;
  const activeInput = isTime ? timeInput : resultInput;
  const value = scoring.parse(String(data.get(isTime ? 'tiempo' : 'result')));
  if (value === null) {
    activeInput.setAttribute('aria-invalid', 'true');
    showStatus(`Resultado no válido. ${scoring.hint}`, true);
    activeInput.focus();
    return;
  }

  // 2) Guardar en memoria y en el almacenamiento
  const outcome = saveResult({
    athleteId,
    workoutId: workout.id,
    value,
    notes: String(data.get('notes')).trim(),
  });
  const persisted = store.save(state.results);

  // 3) Mostrar lo que se acaba de guardar: su historial y el ranking de ese entrenamiento
  state.historyAthleteId = athleteId;
  state.rankingWorkoutId = workout.id;
  renderAll();

  // 4) Limpiar los campos de texto y confirmar al usuario
  resultInput.value = '';
  timeInput.value = '';
  form.elements.notes.value = '';

  const verb = outcome === 'created' ? 'guardado' : 'actualizado';
  const name = athleteById.get(athleteId).name;
  showStatus(
    persisted
      ? `${name}: resultado ${verb} (${scoring.format(value)}).`
      : `${name}: resultado ${verb}, pero no se ha podido guardar en este navegador.`,
    !persisted
  );
});


/* ==========================================================================
   8. ARRANQUE
   ========================================================================== */

function init() {
  state.rankingWorkoutId = workoutsWithResults()[0]?.id ?? null;

  renderNextWorkout();
  buildHistoryChips();
  buildFormOptions();
  updateResultHint();
  renderAll();
}

init();
