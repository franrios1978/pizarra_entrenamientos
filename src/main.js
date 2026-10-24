"use strict";

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
   8. Panel de administración
   9. Reloj y cronómetro
   10. Autenticación / Supabase
   11. Arranque
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
    format: (n) => `${n} ${n === 1 ? "ronda" : "rondas"}`,
    placeholder: "Ej.: 18",
    hint: "Rondas completas (número entero).",
  },
  reps: {
    higherIsBetter: true,
    parse: parseWholeNumber,
    format: (n) => `${n} reps`,
    placeholder: "Ej.: 12",
    hint: "Repeticiones (número entero).",
  },
  time: {
    higherIsBetter: false, // en un tiempo gana el más bajo
    parse: parseTime,
    format: formatTime,
    placeholder: "Ej.: 12:48",
    hint: "Tiempo en mm:ss (o h:mm:ss).",
  },
  weight: {
    higherIsBetter: true,
    parse: parseDecimal,
    format: (kg) => `${kg.toLocaleString("es-ES")} kg`,
    placeholder: "Ej.: 85",
    hint: "Peso en kg (admite decimales: 82,5).",
  },
};

/** "18" -> 18. Devuelve null si no es un entero positivo. */
function parseWholeNumber(text) {
  const clean = text.trim();
  return /^\d{1,3}$/.test(clean) && Number(clean) > 0 ? Number(clean) : null;
}

/** "82,5" o "82.5" -> 82.5. Devuelve null si no es un número positivo razonable. */
function parseDecimal(text) {
  const clean = text.trim().replace(",", ".");
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
  const ss = String(seconds).padStart(2, "0");

  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}` : `${minutes}:${ss}`;
}

/* ==========================================================================
   3. ALMACENAMIENTO
   IMPORTANTE: localStorage guarda los datos solo en el navegador de cada persona.
   Sirve para probar la web, pero tus amigos NO verán los resultados de los demás.
   Para compartirlos hace falta un servidor o una base de datos (Firebase,
   Supabase, una API propia...). Todo el acceso a datos pasa por este objeto,
   así que bastará con reescribir load() y save() cuando llegue ese momento.
   ========================================================================== */

const STORAGE_KEY = "crewwod:results";

const store = {
  /** Devuelve los resultados guardados o los iniciales (SEED_RESULTS) si no hay nada válido. */
  load() {
    try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      // Solo valen los datos guardados con la MISMA versión publicada en data.js.
      if (saved && saved.version === RESULTS_VERSION_VAL && Array.isArray(saved.results)) {
        // Ignora resultados de atletas o entrenamientos que ya no existen en data.js
        // (por ejemplo datos antiguos guardados antes de editar ATHLETES/WORKOUTS).
        return saved.results.filter(
          (result) => athleteById.has(result.athleteId) && resolveWorkout(result),
        );
      }
    } catch {
      // Sin acceso a localStorage (modo privado) o JSON dañado: empezamos de cero.
    }
    try {
      return structuredClone(SEED_RESULTS_LIST);
    } catch {
      return [];
    }
  },

  /** Guarda la lista completa con la versión actual. Devuelve false si el navegador no lo permite. */
  save(results) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: RESULTS_VERSION_VAL, results }));
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
function toDate(isoDate, time = "00:00") {
  return new Date(`${isoDate}T${time}`);
}

/** "2026-10-14" -> "14 oct". */
function formatShortDate(isoDate) {
  return toDate(isoDate)
    .toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    .replace(".", "");
}

/** "2026-10-24" -> "sáb 24 oct". */
function formatLongDate(isoDate) {
  return toDate(isoDate)
    .toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
    .replace(/[.,]/g, "");
}

/** Título completo de un entrenamiento: "Cindy · AMRAP 20'". */
function workoutTitle(workout) {
  return [workout.name, workout.detail].filter(Boolean).join(" · ");
}

/** ID único sencillo para cada resultado nuevo. */
function makeId() {
  return `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/* ==========================================================================
   5. ESTADO Y CONSULTAS
   "state" es la única fuente de verdad: los render*() leen de aquí y pintan.
   ========================================================================== */

let ATHLETES_LIST = Array.isArray(ATHLETES) ? ATHLETES : [];
let WORKOUTS_LIST = Array.isArray(WORKOUTS) ? WORKOUTS : [];
let SEED_RESULTS_LIST = Array.isArray(SEED_RESULTS) ? SEED_RESULTS : [];
let RESULTS_VERSION_VAL = typeof RESULTS_VERSION === "number" ? RESULTS_VERSION : 0;

const athleteById = new Map(ATHLETES_LIST.map((athlete) => [athlete.id, athlete]));
let workoutById = new Map(WORKOUTS_LIST.map((workout) => [workout.id, workout]));
// Entrenamientos indexados por fecha. Si dos comparten fecha, manda el que NO es
// "next" (el archivado), porque su id es estable y "next" se reutiliza cada semana.
let workoutByDate = new Map();
function rebuildWorkoutMaps() {
  workoutById = new Map(WORKOUTS_LIST.map((workout) => [workout.id, workout]));
  workoutByDate = new Map();
  for (const workout of [...WORKOUTS_LIST].sort(
    (a, b) => (a.id === NEXT_WORKOUT_ID ? 1 : 0) - (b.id === NEXT_WORKOUT_ID ? 1 : 0),
  )) {
    if (!workoutByDate.has(workout.date)) workoutByDate.set(workout.date, workout);
  }
}
rebuildWorkoutMaps();

/**
 * Entrenamiento al que pertenece un resultado.
 *
 * Se busca por FECHA y no solo por id porque el id "next" se reutiliza: el WOD de
 * esta semana y el de la semana pasada comparten id "next". La fecha es lo único
 * estable, así que un resultado guardado el 2026-10-22 sigue apuntando al
 * entrenamiento de esa fecha aunque después se archive con otro id.
 *
 * Fallback: si el resultado tiene fecha pero no hay ningún entrenamiento con esa
 * fecha, se busca por id. Ese atajo NO se aplica al id "next" a propósito: si no,
 * un resultado archivado aparecería colgado del WOD de la semana siguiente.
 */
function resolveWorkout(result) {
  if (result.date) {
    const byDate = workoutByDate.get(result.date);
    if (byDate) return byDate;
    if (result.workoutId === NEXT_WORKOUT_ID) return null;
  }
  // Resultados antiguos sin fecha: se cae al id (comportamiento anterior).
  return workoutById.get(result.workoutId) ?? null;
}

/** ¿Este resultado corresponde a este entrenamiento concreto (misma sesión)? */
function resultBelongsTo(result, workout) {
  const resolved = resolveWorkout(result);
  return resolved !== null && resolved.id === workout.id;
}

const state = {
  results: store.load(),
  historyAthleteId: ATHLETES_LIST[0]?.id,
  rankingWorkoutId: null, // se calcula en init()
  boardWorkoutId: NEXT_WORKOUT_ID, // entrenamiento que se está viendo en la pizarra
  session: null,
  profile: null,
  isAdmin: false,
  authReady: false,
};

/** Entrenamientos del más reciente al más antiguo. */
let workoutsNewestFirst = [...WORKOUTS_LIST].sort((a, b) => b.date.localeCompare(a.date));
function rebuildWorkoutOrder() {
  workoutsNewestFirst = [...WORKOUTS_LIST].sort((a, b) => b.date.localeCompare(a.date));
}

/** Entrenamientos que ya tienen al menos un resultado (para el ranking). */
function workoutsWithResults() {
  return workoutsNewestFirst.filter((workout) =>
    state.results.some((result) => resultBelongsTo(result, workout)),
  );
}

/**
 * Clasificación de un entrenamiento, de mejor a peor.
 * Si dos personas empatan comparten posición (1, 1, 3...).
 */
function buildRanking(workoutId) {
  const workout = workoutById.get(workoutId);
  const { higherIsBetter } = SCORING[workout.scoring];

  const sorted = state.results
    .filter((result) => resultBelongsTo(result, workout))
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
 * El resultado guarda la FECHA del entrenamiento, que es lo único estable
 * (el id "next" se reutiliza de una semana a otra).
 * Devuelve "created" o "updated".
 */
function saveResult({ athleteId, workout, value, notes }) {
  const existing = state.results.find(
    (result) => result.athleteId === athleteId && resultBelongsTo(result, workout),
  );

  if (existing) {
    Object.assign(existing, { value, notes });
    return "updated";
  }

  state.results.push({
    id: makeId(),
    athleteId,
    workoutId: workout.id,
    date: workout.date,
    value,
    notes,
  });
  return "created";
}

/* ==========================================================================
   6. PINTADO
   ========================================================================== */

// Referencias al DOM que se usan varias veces
const rankingSelect = $("#ranking-workout");
const historyChips = $("#history-chips");
const form = $("#result-form");
const athleteSelect = $("#athlete");
const workoutSelect = $("#workout");
const boardWorkoutSelect = $("#board-workout");
const boardPastPanel = $("#past-boards");
const boardPastToggle = $('[data-action="toggle-past"]');
const resultInput = $("#result");
const resultHint = $("#result-hint");
const resultField = $("#result-field");
const timeInput = $("#tiempo");
const timeHint = $("#tiempo-hint");
const formStatus = $("#form-status");

/**
 * Pizarra. Por defecto muestra el próximo entrenamiento; si se le pasa un id,
 * muestra ese (al elegir otro entrenamiento en el formulario).
 * Los bloques que el entrenamiento no tenga (warmup, ejercicios, nota) se ocultan.
 */
function renderNextWorkout(workoutId = NEXT_WORKOUT_ID) {
  const workout = workoutById.get(workoutId);
  const when = $("#next-date");
  const warmup = $("#next-warmup");
  const exercises = $("#next-exercises");
  const note = $("#next-note");

  // Solo el próximo entrenamiento se anuncia como tal; los anteriores son pizarras ya hechas
  $("#board-label").textContent =
    workout?.id === NEXT_WORKOUT_ID ? "Próximo entrenamiento" : "Pizarra";

  if (!workout) {
    when.textContent = "";
    when.dateTime = "";
    $("#board-title").textContent = "Entrenamiento no encontrado";
    warmup.hidden = true;
    exercises.parentElement.hidden = true;
    note.hidden = true;
    return;
  }

  when.textContent = `${formatLongDate(workout.date)}${workout.time ? ` · ${workout.time}` : ""}`;
  when.dateTime = workout.time ? `${workout.date}T${workout.time}` : workout.date;

  $("#board-title").textContent = workoutTitle(workout);

  warmup.textContent = workout.warmup ?? "";
  warmup.hidden = !workout.warmup;

  exercises.replaceChildren(
    ...(workout.exercises ?? []).map((exercise) => {
      // Compatible con texto suelto ('Burpee 8 reps') y con objeto ({ text, video, hint })
      const item = typeof exercise === "string" ? { text: exercise } : exercise;
      const content = item.video
        ? el(
            "a",
            { href: item.video, target: "_blank", rel: "noopener noreferrer" },
            item.text,
            item.hint ? el("span", { class: "exercise__hint" }, item.hint) : "",
          )
        : item.text;
      return el("li", {}, content);
    }),
  );
  exercises.parentElement.hidden = !workout.exercises?.length;

  note.textContent = workout.note ?? "";
  note.hidden = !workout.note;
}

/**
 * Cambia el entrenamiento que muestra la pizarra y lo deja sincronizado con los
 * desplegables del formulario y de las pizarras anteriores.
 */
function selectWorkout(workoutId) {
  state.boardWorkoutId = workoutId;
  workoutSelect.value = workoutId;
  boardWorkoutSelect.value = workoutId;
  updateResultHint();
  renderNextWorkout(workoutId);
}

/** Opciones de los desplegables de entrenamientos (formulario y pizarras anteriores). */
function workoutOptions() {
  return workoutsNewestFirst.map((workout) =>
    el(
      "option",
      { value: workout.id },
      `${workoutTitle(workout)} · ${formatShortDate(workout.date)}`,
    ),
  );
}

/** Abre o cierra el desplegable de pizarras anteriores. */
function toggleBoardOptions(open = boardPastPanel.hidden) {
  boardPastPanel.hidden = !open;
  boardPastToggle.setAttribute("aria-expanded", String(open));
}

/** Lista de entrenamientos que se pueden elegir en el desplegable del ranking. */
function renderRankingOptions() {
  rankingSelect.replaceChildren(
    ...workoutsWithResults().map((workout) =>
      el(
        "option",
        { value: workout.id },
        `${workoutTitle(workout)} · ${formatShortDate(workout.date)}`,
      ),
    ),
  );
}

/** Ranking del entrenamiento seleccionado. */
function renderRanking() {
  const list = $("#ranking-list");
  const workout = workoutById.get(state.rankingWorkoutId);

  if (!workout) {
    $("#ranking-title").textContent = "Ranking";
    list.replaceChildren(el("li", { class: "ranking__empty" }, "Todavía no hay resultados."));
    rankingSelect.disabled = true;
    return;
  }

  const scoring = SCORING[workout.scoring];
  $("#ranking-title").textContent = `Ranking · ${workout.name} (${formatShortDate(workout.date)})`;

  list.replaceChildren(
    ...buildRanking(workout.id).map((entry) =>
      el(
        "li",
        { class: "ranking__item" },
        el(
          "span",
          { class: entry.rank === 1 ? "ranking__pos ranking__pos--first" : "ranking__pos" },
          String(entry.rank),
        ),
        el("span", { class: "ranking__name" }, athleteById.get(entry.athleteId).name),
        el("span", { class: "ranking__score" }, scoring.format(entry.value)),
      ),
    ),
  );

  rankingSelect.disabled = false;
  rankingSelect.value = workout.id;
}

/** Botones con los nombres de las personas. Se crean una sola vez. */
function buildHistoryChips() {
  if (!historyChips) return;
  historyChips.replaceChildren(
    ...ATHLETES_LIST.map((athlete) =>
      el("button", { type: "button", class: "chip", "data-athlete": athlete.id }, athlete.name),
    ),
  );
}

/** Historial de la persona seleccionada. */
function renderHistory() {
  // Marca el botón activo (aria-pressed también lo anuncian los lectores de pantalla)
  for (const chip of historyChips.children) {
    chip.setAttribute("aria-pressed", String(chip.dataset.athlete === state.historyAthleteId));
  }

  const athlete = athleteById.get(state.historyAthleteId);
  $("#history-caption").textContent = `Resultados de ${athlete.name}`;

  const rows = state.results
    .filter((result) => result.athleteId === state.historyAthleteId)
    .map((result) => ({ result, workout: resolveWorkout(result) }))
    // Un resultado sin entrenamiento válido (entreno borrado de data.js) no se pinta.
    .filter(({ workout }) => Boolean(workout))
    .sort((a, b) => b.workout.date.localeCompare(a.workout.date))
    .map(({ result, workout }) =>
      el(
        "tr",
        {},
        el("td", {}, el("time", { datetime: workout.date }, formatShortDate(workout.date))),
        el(
          "td",
          {},
          workoutTitle(workout),
          // Las notas solo se muestran si existen
          ...(result.notes ? [el("span", { class: "results__notes" }, result.notes)] : []),
        ),
        el("td", { class: "results__value" }, SCORING[workout.scoring].format(result.value)),
      ),
    );

  $("#history-body").replaceChildren(
    ...(rows.length
      ? rows
      : [el("tr", {}, el("td", { colspan: "3" }, `${athlete.name} todavía no tiene resultados.`))]),
  );
}

/** Rellena los desplegables del formulario (una sola vez). */
function buildFormOptions() {
  athleteSelect.replaceChildren(
    ...ATHLETES_LIST.map((athlete) => el("option", { value: athlete.id }, athlete.name)),
  );

  workoutSelect.replaceChildren(...workoutOptions());
  if (workoutById.has(NEXT_WORKOUT_ID)) workoutSelect.value = NEXT_WORKOUT_ID;
}

/** Rellena el desplegable de pizarras anteriores (una sola vez). */
function buildBoardOptions() {
  boardWorkoutSelect.replaceChildren(...workoutOptions());
  boardWorkoutSelect.value = state.boardWorkoutId;
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
  timeHint.textContent = isTime ? scoring.hint : "";

  if (!isTime) {
    resultInput.placeholder = scoring.placeholder;
    resultHint.textContent = scoring.hint;
  }
  resultInput.removeAttribute("aria-invalid");
  timeInput.removeAttribute("aria-invalid");
}

/** Mensaje bajo el formulario. */
function showStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle("is-error", isError);
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
historyChips.addEventListener("click", (event) => {
  const chip = event.target.closest("button[data-athlete]");
  if (!chip) return;

  state.historyAthleteId = chip.dataset.athlete;
  renderHistory();
});

/** Cambiar de ranking desde el desplegable. */
rankingSelect.addEventListener("change", () => {
  state.rankingWorkoutId = rankingSelect.value;
  renderRanking();
});

/** Al cambiar de entrenamiento en el formulario: pizarra y formato esperado. */
workoutSelect.addEventListener("change", () => {
  selectWorkout(workoutSelect.value);
});

/** "Anteriores Pizarras": abre el desplegable con las pizarras anteriores. */
boardPastToggle.addEventListener("click", (event) => {
  event.preventDefault();
  toggleBoardOptions();
});

/** Al elegir una pizarra anterior, la pizarra se actualiza como si se eligiera en el formulario. */
boardWorkoutSelect.addEventListener("change", () => {
  selectWorkout(boardWorkoutSelect.value);
  toggleBoardOptions(false);
});

/** Clic fuera del desplegable: se cierra. */
document.addEventListener("click", (event) => {
  if (boardPastPanel.hidden) return;
  if (!event.target.closest(".board__actions--top")) toggleBoardOptions(false);
});

/** Escape: se cierra el desplegable y el foco vuelve al botón. */
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !boardPastPanel.hidden) {
    toggleBoardOptions(false);
    boardPastToggle.focus();
  }
});

/** Al volver a escribir se limpian el error y el mensaje anterior. */
function clearErrorOnInput(input) {
  input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    if (formStatus.classList.contains("is-error")) showStatus("");
  });
}
clearErrorOnInput(resultInput);
clearErrorOnInput(timeInput);

/** "Apuntar mi resultado": el enlace ya baja al formulario; aquí preparamos el campo. */
$('[data-action="focus-form"]').addEventListener("click", () => {
  // La pizarra vuelve al próximo entrenamiento, para que cuadre con el formulario
  selectWorkout(NEXT_WORKOUT_ID);
  // preventScroll: el desplazamiento suave lo hace el propio enlace
  const focusTarget = workoutById.get(NEXT_WORKOUT_ID).scoring === "time" ? timeInput : resultInput;
  focusTarget.focus({ preventScroll: true });
});

/** Guardar un resultado. */
form.addEventListener("submit", async (event) => {
  event.preventDefault(); // evitamos que el navegador recargue la página

  const useSupabase = !!(typeof SUPABASE_CONFIG !== "undefined" && SUPABASE_CONFIG.USE_SUPABASE && window.supabase && window.supabaseClient);
  if (useSupabase && !state.session) {
    showStatus("Inicia sesión para apuntar tu resultado.", true);
    if (typeof showLoginDialog === "function") showLoginDialog();
    return;
  }

  const data = new FormData(form);
  let athleteId = data.get("athlete");
  const workout = workoutById.get(data.get("workout"));
  if (!workout) {
    showStatus("Entrenamiento no válido.", true);
    return;
  }
  const scoring = SCORING[workout.scoring];

  if (useSupabase && state.session && state.profile) {
    if (state.isAdmin) {
      // admin puede elegir cualquiera
    } else if (state.profile.athlete_id) {
      athleteId = state.profile.athlete_id;
      if (athleteSelect) {
        athleteSelect.value = athleteId;
        athleteSelect.disabled = true;
      }
    }
  }

  // 1) Validar el resultado: en los entrenos de tiempo se lee del campo Tiempo
  const isTime = scoring === SCORING.time;
  const activeInput = isTime ? timeInput : resultInput;
  const value = scoring.parse(String(data.get(isTime ? "tiempo" : "result")));
  if (value === null) {
    activeInput.setAttribute("aria-invalid", "true");
    showStatus(`Resultado no válido. ${scoring.hint}`, true);
    activeInput.focus();
    return;
  }

  // 2) Guardar en memoria y en el almacenamiento
  let outcome = saveResult({
    athleteId,
    workout,
    value,
    notes: String(data.get("notes")).trim(),
  });
  let persisted = store.save(state.results);

  if (useSupabase && state.session) {
    try {
      const notes = String(data.get("notes")).trim();
      // Intentar upsert por atleta+entrenamiento+fecha
      const existingRemote = state.results.find(
        (r) => r.athleteId === athleteId && resultBelongsTo(r, workout),
      );
      if (existingRemote && existingRemote.id && !existingRemote.id.toString().startsWith("r-seed-")) {
        const { error } = await window.supabaseClient
          .from("results")
          .update({ value, notes, workout_id: workout.id, date: workout.date })
          .eq("id", existingRemote.id);
        if (error) throw error;
      } else {
        const { data: ins, error } = await window.supabaseClient
          .from("results")
          .insert({
            athlete_id: athleteId,
            workout_id: workout.id,
            date: workout.date,
            value,
            notes,
            created_by: state.session.user.id,
          })
          .select()
          .single();
        if (error) throw error;
        if (ins && ins.id) {
          // actualizar id local si era temporal
          const local = state.results.find(
            (r) => r.athleteId === athleteId && resultBelongsTo(r, workout) && (r.id.startsWith("r-") || r.id.startsWith("tmp")),
          );
          if (local) local.id = ins.id;
        }
      }
      // Recargar desde Supabase para sincronizar
      try {
        await loadResultsFromSupabase();
      } catch {
        // ignore
      }
      store.save(state.results);
    } catch (e) {
      showStatus("Guardado en local. No se ha podido sincronizar con Supabase.", true);
    }
  }

  // 3) Mostrar lo que se acaba de guardar: su historial y el ranking de ese entrenamiento
  state.historyAthleteId = athleteId;
  state.rankingWorkoutId = workout.id;
  renderAll();

  // 4) Limpiar los campos de texto y confirmar al usuario
  resultInput.value = "";
  timeInput.value = "";
  if (form.elements.notes) form.elements.notes.value = "";

  const verb = outcome === "created" ? "guardado" : "actualizado";
  const name = athleteById.get(athleteId)?.name || athleteId;
  if (useSupabase && state.session) {
    showStatus(`${name}: resultado ${verb} (${scoring.format(value)}) sincronizado con Supabase.`);
  } else {
    showStatus(
      persisted
        ? `${name}: resultado ${verb} (${scoring.format(value)}).`
        : `${name}: resultado ${verb}, pero no se ha podido guardar en este navegador.`,
      !persisted,
    );
  }
});

/* ==========================================================================
   8. PANEL DE ADMINISTRACIÓN
   Permite (solo a quien conozca la contraseña) generar un archivo data.js
   con los resultados actuales, para subirlo al repositorio.

   AVISO: en una web estática la contraseña es visible leyendo el JavaScript.
   Sirve para operar cómodo, no como seguridad real.
   ========================================================================== */

const ADMIN_SESSION_KEY = "crewwod:admin";
const adminPanel = $("#admin-panel");
const adminLogin = $("#admin-login");
const adminPassword = $("#admin-password");
const adminLoginBtn = $("#admin-login-btn");
const adminLoginMsg = $("#admin-login-msg");
const adminDialog = $("#admin-dialog");
const adminStatus = $("#admin-status");

/** Muestra el panel de administración (identificado). */
function showAdminPanel() {
  adminLogin.hidden = true;
  adminPanel.hidden = false;
  adminDialog.showModal();
}

/** Comprueba la contraseña escrita. */
function tryAdminLogin() {
  if (adminPassword.value === ADMIN_PASSWORD) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    adminPassword.value = "";
    showAdminPanel();
  } else {
    adminLoginMsg.textContent = "Contraseña incorrecta.";
    adminPassword.value = "";
    adminPassword.focus();
  }
}

/**
 * Genera el texto completo de data.js a partir de los datos actuales.
 * Respeta WORKOUTS y ATHLETES tal como estén en el proyecto: solo se
 * sustituye la lista de resultados (SEED_RESULTS).
 */
function buildDataFile() {
  const header = `'use strict';

/* oxlint-disable no-unused-vars */
/* Las constantes se usan desde main.js: ambos scripts clásicos comparten el mismo ámbito global. */

/* ==========================================================================
   Crew WOD · DATOS EDITABLES
   Generado automáticamente el ${new Date().toLocaleString("es-ES")}.
   ========================================================================== */

/** ID del próximo entrenamiento (el que se muestra en la pizarra). */
const NEXT_WORKOUT_ID = ${JSON.stringify(NEXT_WORKOUT_ID)};

/** Versión de los resultados publicados. Se sube sola (+1) al generar el archivo. */
const RESULTS_VERSION = ${RESULTS_VERSION + 1};

/** Contraseña del panel de administración. */
const ADMIN_PASSWORD = ${JSON.stringify(ADMIN_PASSWORD)};

/** Entrenamientos. El primero (el próximo) es el que se ve en la pizarra. */
const WORKOUTS = ${JSON.stringify(WORKOUTS, null, 2)};

/** Personas del grupo. */
const ATHLETES = ${JSON.stringify(ATHLETES, null, 2)};

/** Resultados publicados. "value" es SIEMPRE un número: rondas, reps, segundos o kg. */
const SEED_RESULTS = ${JSON.stringify(
    state.results.map(({ athleteId, workoutId, date, value, notes }) => {
      // El id se reasigna al entrenamiento que corresponde a la fecha del resultado:
      // así, un resultado guardado contra "next" se publica contra el id ya archivado.
      const resolved = resolveWorkout({ workoutId, date });
      return {
        id: makeId(),
        athleteId,
        workoutId: resolved?.id ?? workoutId,
        date: resolved?.date ?? date ?? null,
        value,
        notes,
      };
    }),
    null,
    2,
  )};
`;

  return header;
}

/** Descarga el data.js generado. */
function downloadDataFile() {
  const blob = new Blob([buildDataFile()], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: "data.js" });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  adminStatus.textContent =
    `data.js descargado con ${state.results.length} resultado(s) y versión ` +
    `${RESULTS_VERSION + 1} (la versión se sube sola). ` +
    "Ahora sustitúyelo en src/data.js y haz commit y push.";
}

// Abrir el panel desde el botón discreto del pie
$('[data-action="open-admin"]').addEventListener("click", () => {
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
    showAdminPanel();
    adminDialog.showModal();
  } else {
    adminDialog.showModal();
    adminLogin.hidden = false;
    adminPanel.hidden = true;
    adminLoginMsg.textContent = "";
    adminPassword.focus();
  }
});

adminLoginBtn.addEventListener("click", tryAdminLogin);
adminPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    tryAdminLogin();
  }
});

$("#admin-generate").addEventListener("click", downloadDataFile);
$("#admin-logout").addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  adminDialog.close();
  adminLogin.hidden = false;
  adminPanel.hidden = true;
  adminStatus.textContent = "";
});

/* ==========================================================================
   9. RELOJ Y CRONÓMETRO
   Reloj en tiempo real que se convierte en cronómetro a pantalla completa
   para medir las sesiones de entrenamiento.
   ========================================================================== */

const clockEl = $("#reloj");
const clockDisplay = $("#clock-display");
const clockMode = $("#clock-mode");
const clockExpand = $("#clock-expand");
const clockStart = $("#clock-start");
const clockReset = $("#clock-reset");

let clockTimer = null;
let stopwatchFrame = null;
let stopwatchRunning = false;
let stopwatchElapsed = 0; // ms acumulados antes de la pausa actual
let stopwatchStartedAt = 0; // performance.now() al reanudar
let stopwatchShown = "";
let displayCells = [];
let displayShape = "";

const pad2 = (value) => String(value).padStart(2, "0");

/** ¿Está abierto el modo cronómetro/maximizado? */
function isStopwatch() {
  return clockEl.classList.contains("clock--full");
}

/** Hora local "HH:MM:SS". */
function formatClock(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** Milisegundos -> "MM:SS.cc" (o "H:MM:SS.cc" si pasa de una hora). */
function formatStopwatch(ms) {
  const totalCentis = Math.floor(ms / 10);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const body = `${pad2(minutes)}:${pad2(seconds)}.${pad2(centis)}`;
  return hours > 0 ? `${hours}:${body}` : body;
}

/**
 * Pinta el texto en celdas de ancho fijo. Así los dígitos cambian sin que el
 * bloque se desplace horizontalmente. Solo reconstruye las celdas cuando
 * cambia la plantilla (por ejemplo, al pasar de "HH:MM:SS" a "MM:SS.cc").
 */
function paintDisplay(text) {
  const shape = text.replace(/\d/g, "d");
  if (shape !== displayShape) {
    displayShape = shape;
    const fragment = document.createDocumentFragment();
    displayCells = [...text].map((char) => {
      const cell = document.createElement("span");
      cell.className = /\d/.test(char)
        ? "clock__cell"
        : char === ":"
          ? "clock__cell clock__cell--colon"
          : "clock__cell clock__cell--dot";
      cell.textContent = char;
      fragment.append(cell);
      return cell;
    });
    clockDisplay.replaceChildren(fragment);
    return;
  }

  displayCells.forEach((cell, index) => {
    const char = text[index];
    if (cell.textContent !== char) cell.textContent = char;
  });
}

function paintClock() {
  const now = new Date();
  paintDisplay(formatClock(now));
  clockDisplay.dateTime = now.toISOString();
}

/** Tiempo transcurrido (incluye la parte en marcha si está corriendo). */
function stopwatchMs() {
  return stopwatchElapsed + (stopwatchRunning ? performance.now() - stopwatchStartedAt : 0);
}

function paintStopwatch() {
  const text = formatStopwatch(stopwatchMs());
  // Solo tocamos el DOM cuando cambia el texto mostrado.
  if (text !== stopwatchShown) {
    stopwatchShown = text;
    paintDisplay(text);
  }
}

function startClockTick() {
  stopClockTick();
  clockMode.textContent = "Hora local";
  paintClock();
  clockTimer = setInterval(paintClock, 1000);
}

function stopClockTick() {
  if (clockTimer !== null) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

function stopStopwatchLoop() {
  if (stopwatchFrame !== null) {
    cancelAnimationFrame(stopwatchFrame);
    stopwatchFrame = null;
  }
}

function updateStartButton() {
  clockStart.textContent = stopwatchRunning
    ? "Pausar"
    : stopwatchElapsed > 0
      ? "Continuar"
      : "Empezar";
}

function resetStopwatch() {
  stopwatchRunning = false;
  stopwatchElapsed = 0;
  stopwatchShown = "";
  stopStopwatchLoop();
  paintStopwatch();
  updateStartButton();
}

/** Empezar o pausar el cronómetro. */
function toggleStopwatch() {
  if (stopwatchRunning) {
    // Pausa: guardamos lo transcurrido y paramos el bucle.
    stopwatchElapsed = stopwatchMs();
    stopwatchRunning = false;
    stopStopwatchLoop();
    paintStopwatch();
  } else {
    stopwatchRunning = true;
    stopwatchStartedAt = performance.now();
    const loop = () => {
      paintStopwatch();
      stopwatchFrame = requestAnimationFrame(loop);
    };
    stopwatchFrame = requestAnimationFrame(loop);
  }
  updateStartButton();
}

/** Entra en modo cronómetro y maximiza el reloj. */
function maximizeClock() {
  clockEl.classList.add("clock--full");
  document.body.classList.add("clock-lock");
  clockMode.textContent = "Cronómetro";
  clockExpand.textContent = "Salir";
  clockExpand.setAttribute("aria-pressed", "true");
  clockStart.hidden = false;
  clockReset.hidden = false;
  clockDisplay.removeAttribute("datetime");

  stopClockTick();
  resetStopwatch();

  // Pantalla completa real si el navegador lo permite; si no, queda el overlay.
  try {
    clockEl.requestFullscreen?.()?.catch(() => {});
  } catch {
    // El overlay CSS ya cubre la ventana.
  }

  clockStart.focus();
}

/** Vuelve al reloj normal. */
function minimizeClock({ restoreFocus = true } = {}) {
  if (!isStopwatch()) return;

  stopwatchRunning = false;
  stopwatchElapsed = 0;
  stopStopwatchLoop();
  clockEl.classList.remove("clock--full");
  document.body.classList.remove("clock-lock");
  clockMode.textContent = "Hora local";
  clockExpand.textContent = "Maximizar";
  clockExpand.setAttribute("aria-pressed", "false");
  clockStart.hidden = true;
  clockReset.hidden = true;

  try {
    if (document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {});
  } catch {
    // Sin pantalla completa nativa.
  }

  startClockTick();
  if (restoreFocus) clockExpand.focus();
}

clockExpand.addEventListener("click", () => {
  if (isStopwatch()) minimizeClock();
  else maximizeClock();
});

clockStart.addEventListener("click", toggleStopwatch);
clockReset.addEventListener("click", resetStopwatch);

// Si el navegador sale de pantalla completa (Escape), volvemos al reloj.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && isStopwatch()) {
    minimizeClock({ restoreFocus: false });
  }
});

// Escape también cierra el overlay cuando la Fullscreen API no está disponible.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isStopwatch() && !document.fullscreenElement) {
    minimizeClock();
  }
});

/* ==========================================================================
   10. AUTENTICACIÓN / SUPABASE
   ========================================================================== */

let supabaseClient = null;

function initSupabase() {
  try {
    if (typeof SUPABASE_CONFIG === "undefined") return;
    if (!SUPABASE_CONFIG.USE_SUPABASE) return;
    if (!window.supabase || !window.supabase.createClient) return;
    if (supabaseClient) {
      window.supabaseClient = supabaseClient;
      return;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY);
    window.supabaseClient = supabaseClient;
  } catch (e) {
    // ignore
  }
}

const authBtn = document.getElementById("auth-btn");
const authUserEl = document.getElementById("auth-user");
const authLogoutBtn = document.getElementById("auth-logout");
const loginDialog = document.getElementById("login-dialog");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginMsg = document.getElementById("login-msg");
const loginCancel = document.getElementById("login-cancel");

function updateAuthUI() {
  const useSupabase = !!(typeof SUPABASE_CONFIG !== "undefined" && SUPABASE_CONFIG.USE_SUPABASE);
  if (authBtn) authBtn.hidden = !useSupabase;
  if (authLogoutBtn) authLogoutBtn.hidden = !useSupabase || !state.session;
  if (authUserEl) {
    if (useSupabase && state.session) {
      const name = state.profile?.athlete_id
        ? (ATHLETES_LIST.find((a) => a.id === state.profile.athlete_id)?.name || state.session.user.email)
        : state.session.user.email;
      const role = state.isAdmin ? "admin" : "miembro";
      authUserEl.textContent = `${name} (${role})`;
      authUserEl.hidden = false;
    } else {
      authUserEl.hidden = true;
    }
  }
  // Forzar atleta para miembros
  if (useSupabase && state.session && state.profile && !state.isAdmin && athleteSelect) {
    if (state.profile.athlete_id) {
      athleteSelect.value = state.profile.athlete_id;
      athleteSelect.disabled = true;
    }
  } else if (athleteSelect && !useSupabase) {
    athleteSelect.disabled = false;
  } else if (useSupabase && state.session && state.isAdmin && athleteSelect) {
    athleteSelect.disabled = false;
  }
}

function showLoginDialog() {
  if (!loginDialog) return;
  if (loginMsg) loginMsg.textContent = "";
  if (loginEmail) loginEmail.value = "";
  if (loginPassword) loginPassword.value = "";
  try {
    loginDialog.showModal();
    loginEmail?.focus();
  } catch {
    loginDialog.setAttribute("open", "");
  }
}

function closeLoginDialog() {
  if (!loginDialog) return;
  try {
    loginDialog.close();
  } catch {
    loginDialog.removeAttribute("open");
  }
}

async function loadUserProfile() {
  if (!supabaseClient || !state.session) {
    state.profile = null;
    state.isAdmin = false;
    updateAuthUI();
    return;
  }
  try {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", state.session.user.id)
      .maybeSingle();
    state.profile = profile || null;
    state.isAdmin = !!(profile && profile.role === "admin");
  } catch (e) {
    state.profile = null;
    state.isAdmin = false;
  }
  updateAuthUI();
  if (state.session && state.profile && !state.isAdmin && athleteSelect && state.profile.athlete_id) {
    athleteSelect.value = state.profile.athlete_id;
    athleteSelect.disabled = true;
  }
}

async function initAuth() {
  initSupabase();
  if (!supabaseClient) {
    state.authReady = true;
    updateAuthUI();
    return;
  }
  try {
    const { data } = await supabaseClient.auth.getSession();
    state.session = data?.session || null;
  } catch (e) {
    state.session = null;
  }
  await loadUserProfile();
  state.authReady = true;
  updateAuthUI();
  try {
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      await loadUserProfile();
      await loadResultsFromSupabase();
      renderAll();
      updateAuthUI();
    });
  } catch (e) {
    // ignore
  }
}

async function loadResultsFromSupabase() {
  if (!supabaseClient) return;
  try {
    const [athRes, wRes, rRes] = await Promise.all([
      supabaseClient.from("athletes").select("*"),
      supabaseClient.from("workouts").select("*"),
      supabaseClient.from("results").select("*"),
    ]);
    if (athRes.data && Array.isArray(athRes.data) && athRes.data.length) {
      ATHLETES_LIST = athRes.data;
      // rebuild maps
      const athleteByIdNew = new Map(ATHLETES_LIST.map((a) => [a.id, a]));
      athleteById.clear();
      for (const [k, v] of athleteByIdNew) athleteById.set(k, v);
      if (!ATHLETES_LIST.find((a) => a.id === state.historyAthleteId) && ATHLETES_LIST[0]) {
        state.historyAthleteId = ATHLETES_LIST[0].id;
      }
      if (athleteSelect) {
        athleteSelect.replaceChildren(
          ...ATHLETES_LIST.map((athlete) => el("option", { value: athlete.id }, athlete.name)),
        );
      }
      buildHistoryChips();
    }
    if (wRes.data && Array.isArray(wRes.data) && wRes.data.length) {
      WORKOUTS_LIST = wRes.data;
      rebuildWorkoutMaps();
      rebuildWorkoutOrder();
      if (workoutSelect) {
        workoutSelect.replaceChildren(...workoutOptions());
        if (workoutById.has(state.boardWorkoutId)) workoutSelect.value = state.boardWorkoutId;
        else if (NEXT_WORKOUT_ID && workoutById.has(NEXT_WORKOUT_ID)) {
          state.boardWorkoutId = NEXT_WORKOUT_ID;
          workoutSelect.value = NEXT_WORKOUT_ID;
        }
      }
      if (boardWorkoutSelect) {
        boardWorkoutSelect.replaceChildren(...workoutOptions());
        boardWorkoutSelect.value = state.boardWorkoutId;
      }
      renderNextWorkout(state.boardWorkoutId);
      updateResultHint();
    }
    if (rRes.data && Array.isArray(rRes.data)) {
      state.results = rRes.data.map((r) => ({
        id: r.id,
        athleteId: r.athlete_id,
        workoutId: r.workout_id,
        date: r.date,
        value: r.value,
        notes: r.notes || "",
      }));
      store.save(state.results);
    }
  } catch (e) {
    // fallback silencioso
  }
}

if (authBtn) {
  authBtn.addEventListener("click", () => {
    if (typeof SUPABASE_CONFIG !== "undefined" && SUPABASE_CONFIG.USE_SUPABASE) {
      showLoginDialog();
    }
  });
}
if (authLogoutBtn) {
  authLogoutBtn.addEventListener("click", async () => {
    try {
      if (supabaseClient) await supabaseClient.auth.signOut();
    } catch (e) {
      // ignore
    }
    state.session = null;
    state.profile = null;
    state.isAdmin = false;
    updateAuthUI();
    if (athleteSelect) athleteSelect.disabled = false;
  });
}
if (loginCancel) {
  loginCancel.addEventListener("click", () => closeLoginDialog());
}
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      if (loginMsg) loginMsg.textContent = "Supabase no inicializado.";
      return;
    }
    const email = loginEmail?.value || "";
    const password = loginPassword?.value || "";
    if (!email || !password) {
      if (loginMsg) loginMsg.textContent = "Introduce email y contraseña.";
      return;
    }
    if (loginMsg) loginMsg.textContent = "Entrando...";
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (loginMsg) loginMsg.textContent = "Sesión iniciada.";
      closeLoginDialog();
      await initAuth();
      await loadResultsFromSupabase();
      renderAll();
      updateAuthUI();
    } catch (err) {
      if (loginMsg) loginMsg.textContent = "Error al iniciar sesión.";
    }
  });
}

/* ==========================================================================
   11. ARRANQUE
   ========================================================================== */

async function init() {
  initSupabase();
  state.rankingWorkoutId = workoutsWithResults()[0]?.id ?? null;

  renderNextWorkout();
  buildHistoryChips();
  buildFormOptions();
  buildBoardOptions();
  updateResultHint();
  renderAll();
  startClockTick();
  updateAuthUI();

  await initAuth();
  if (typeof SUPABASE_CONFIG !== "undefined" && SUPABASE_CONFIG.USE_SUPABASE && supabaseClient) {
    try {
      await loadResultsFromSupabase();
    } catch (e) {
      // fallback
    }
    renderAll();
    updateAuthUI();
  }
}

init();
