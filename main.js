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

/** ID único para un resultado nuevo (la tabla no genera el id automáticamente). */
function makeResultId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  const random = uuid
    ? uuid.replaceAll("-", "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `r-${random}`;
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

/** ¿Está configurada la web para usar Supabase? */
function supabaseConfigured() {
  return !!(typeof SUPABASE_CONFIG !== "undefined" && SUPABASE_CONFIG.USE_SUPABASE);
}

/**
 * Resultados iniciales antes de contactar con Supabase.
 * En modo Supabase se usa el snapshot de data.js (no la caché del navegador) para
 * que todo el mundo vea lo mismo mientras llegan los datos reales.
 */
function initialResults() {
  if (supabaseConfigured()) {
    try {
      return structuredClone(SEED_RESULTS_LIST);
    } catch {
      return [...SEED_RESULTS_LIST];
    }
  }
  return store.load();
}

const state = {
  results: initialResults(),
  historyAthleteId: ATHLETES_LIST[0]?.id,
  historyVisibleCount: 4,
  rankingWorkoutId: null, // se calcula en init()
  boardWorkoutId: NEXT_WORKOUT_ID, // entrenamiento que se está viendo en la pizarra
  session: null,
  profile: null,
  isAdmin: false,
  authReady: false,
};

/** Entrenamientos del más reciente al más antiguo. */
const workoutsNewestFirst = [...WORKOUTS_LIST].sort((a, b) => b.date.localeCompare(a.date));

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

/* ==========================================================================
   6. PINTADO
   ========================================================================== */

// Referencias al DOM que se usan varias veces
const rankingSelect = $("#ranking-workout");
const historyChips = $("#history-chips");
const historyBody = $("#history-body");
const historyMore = $("#history-more");
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

  const isAdmin = Boolean(state.isAdmin);
  $("#history-actions-head").hidden = !isAdmin;

  const allRows = state.results
    .filter((result) => result.athleteId === state.historyAthleteId)
    .map((result) => ({ result, workout: resolveWorkout(result) }))
    // Un resultado sin entrenamiento válido (entreno borrado de data.js) no se pinta.
    .filter(({ workout }) => Boolean(workout))
    .sort((a, b) => b.workout.date.localeCompare(a.workout.date))
    .map(({ result, workout }) => {
      const cells = [
        el("td", {}, el("time", { datetime: workout.date }, formatShortDate(workout.date))),
        el(
          "td",
          {},
          workoutTitle(workout),
          // Las notas solo se muestran si existen
          ...(result.notes ? [el("span", { class: "results__notes" }, result.notes)] : []),
        ),
        el("td", { class: "results__value" }, SCORING[workout.scoring].format(result.value)),
      ];

      if (isAdmin) {
        cells.push(
          el(
            "td",
            { class: "results__actions" },
            el(
              "button",
              {
                type: "button",
                class: "btn btn--ghost btn--small",
                "data-result-action": "edit",
                "data-result-id": result.id,
                "aria-label": `Editar el resultado de ${athlete.name} del ${formatShortDate(workout.date)}`,
              },
              "Editar",
            ),
            el(
              "button",
              {
                type: "button",
                class: "btn btn--ghost btn--small results__delete",
                "data-result-action": "delete",
                "data-result-id": result.id,
                "aria-label": `Borrar el resultado de ${athlete.name} del ${formatShortDate(workout.date)}`,
              },
              "Borrar",
            ),
          ),
        );
      }

      return el("tr", {}, ...cells);
    });

  const visibleCount = Math.min(state.historyVisibleCount, allRows.length);
  const rows = allRows.slice(0, visibleCount);
  const remaining = allRows.length - visibleCount;
  historyMore.hidden = remaining <= 0;
  historyMore.textContent = remaining > 4 ? `Ver 4 más (quedan ${remaining})` : `Ver ${remaining} más`;

  historyBody.replaceChildren(
    ...(rows.length
      ? rows
      : [
          el(
            "tr",
            {},
            el(
              "td",
              { colspan: isAdmin ? "4" : "3" },
              `${athlete.name} todavía no tiene resultados.`,
            ),
          ),
        ]),
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
  state.historyVisibleCount = 4;
  renderHistory();
});

historyMore.addEventListener("click", () => {
  state.historyVisibleCount += 4;
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
  if (!state.isAdmin) {
    showLoginDialog();
    return;
  }

  const next = workoutById.get(NEXT_WORKOUT_ID);
  if (!next) return;

  // La pizarra vuelve al próximo entrenamiento, para que cuadre con el formulario
  selectWorkout(NEXT_WORKOUT_ID);
  // preventScroll: el desplazamiento suave lo hace el propio enlace
  const focusTarget = next.scoring === "time" ? timeInput : resultInput;
  focusTarget.focus({ preventScroll: true });
});

/** Guardar un resultado (solo administrador). */
form.addEventListener("submit", async (event) => {
  event.preventDefault(); // evitamos que el navegador recargue la página

  if (!state.isAdmin) {
    showStatus("Solo el administrador puede gestionar los resultados.", true);
    if (!state.session) showLoginDialog();
    return;
  }

  const client = window.supabaseClient;
  if (!client || !state.session) {
    showStatus("Inicia sesión como administrador para guardar resultados.", true);
    showLoginDialog();
    return;
  }

  const data = new FormData(form);
  const athleteId = String(data.get("athlete") || "");
  const workout = workoutById.get(data.get("workout"));
  if (!workout) {
    showStatus("Entrenamiento no válido.", true);
    return;
  }

  const athlete = athleteById.get(athleteId);
  if (!athlete) {
    showStatus("Atleta no válido.", true);
    return;
  }

  const scoring = SCORING[workout.scoring];

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

  const notes = String(data.get("notes")).trim();
  const existing = state.results.find(
    (result) => result.athleteId === athleteId && resultBelongsTo(result, workout),
  );

  // 2) Guardar en Supabase. Si falla, no se toca la copia local.
  let outcome = "created";
  try {
    if (existing && existing.id && !String(existing.id).startsWith("r-seed-")) {
      const { error } = await client
        .from("results")
        .update({ value, notes, workout_id: workout.id, date: workout.date })
        .eq("id", existing.id);
      if (error) throw error;
      outcome = "updated";
    } else {
      const { error } = await client.from("results").insert({
        id: makeResultId(),
        athlete_id: athleteId,
        workout_id: workout.id,
        date: workout.date,
        value,
        notes,
        created_by: state.session.user.id,
      });
      if (error) throw error;
    }

    await loadResultsFromSupabase();
    store.save(state.results);
  } catch (error) {
    const detail = error?.message ? ` (${error.message})` : "";
    showStatus(`No se ha podido guardar en Supabase${detail}.`, true);
    return;
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
  showStatus(
    `${athlete.name}: resultado ${verb} (${scoring.format(value)}) y sincronizado con Supabase.`,
  );
});

/* ==========================================================================
   8. GESTIÓN DE RESULTADOS DEL ADMINISTRADOR
   Solo el usuario autenticado con role = 'admin' puede editar o borrar.
   La seguridad real la imponen las políticas RLS de Supabase.
   ========================================================================== */

/** Rellena el formulario con un resultado existente para editarlo. */
function editResult(result) {
  const workout = resolveWorkout(result);
  const athlete = athleteById.get(result.athleteId);

  if (!workout || !athlete) {
    showStatus("No se ha encontrado el entrenamiento o el atleta de ese resultado.", true);
    return;
  }

  selectWorkout(workout.id);
  athleteSelect.value = result.athleteId;

  const scoring = SCORING[workout.scoring];
  if (scoring === SCORING.time) {
    timeInput.value = formatTime(result.value);
    resultInput.value = "";
  } else {
    resultInput.value = String(result.value);
    timeInput.value = "";
  }
  if (form.elements.notes) form.elements.notes.value = result.notes || "";

  showStatus(`Editando el resultado de ${athlete.name} del ${formatShortDate(workout.date)}.`);

  const section = $("#subir");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  const target = scoring === SCORING.time ? timeInput : resultInput;
  setTimeout(() => target.focus({ preventScroll: true }), 300);
}

/** Borra un resultado en Supabase y en la copia local. */
async function deleteResult(result) {
  if (!state.isAdmin) return;

  const workout = resolveWorkout(result);
  const athlete = athleteById.get(result.athleteId);
  const name = athlete?.name || result.athleteId;
  const when = workout ? ` del ${formatShortDate(workout.date)}` : "";

  if (!window.confirm(`¿Borrar el resultado de ${name}${when}?`)) return;

  const client = window.supabaseClient;
  if (!client) {
    showStatus("Supabase no está disponible. No se ha borrado nada.", true);
    return;
  }

  try {
    const { error } = await client.from("results").delete().eq("id", result.id);
    if (error) throw error;

    state.results = state.results.filter((item) => String(item.id) !== String(result.id));
    store.save(state.results);
    await loadResultsFromSupabase();
    renderAll();
    showStatus(`Resultado de ${name}${when} borrado.`);
  } catch {
    showStatus("No se ha podido borrar el resultado en Supabase.", true);
  }
}

// Delegación: un solo listener para los botones Editar/Borrar del historial.
historyBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-result-action]");
  if (!button || !state.isAdmin) return;

  const result = state.results.find((item) => String(item.id) === button.dataset.resultId);
  if (!result) return;

  if (button.dataset.resultAction === "edit") editResult(result);
  if (button.dataset.resultAction === "delete") deleteResult(result);
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
   Solo el usuario con role = 'admin' puede gestionar la web.
   ========================================================================== */

let supabaseClient = null;
let authListenerRegistered = false;

function initSupabase() {
  try {
    if (!supabaseConfigured()) return;
    if (!window.supabase || !window.supabase.createClient) return;
    if (supabaseClient) {
      window.supabaseClient = supabaseClient;
      return;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY);
    window.supabaseClient = supabaseClient;
  } catch {
    // Sin Supabase la web sigue mostrando el respaldo de data.js.
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
const navSubir = document.getElementById("nav-subir");
const boardResultLink = document.getElementById("board-result-link");
const resultSection = document.getElementById("subir");

function updateAuthUI() {
  const enabled = supabaseConfigured();
  const admin = enabled && state.isAdmin;

  if (authBtn) authBtn.hidden = !enabled || Boolean(state.session);
  if (authLogoutBtn) authLogoutBtn.hidden = !state.session;

  if (authUserEl) {
    if (state.session) {
      const name = state.profile?.athlete_id
        ? ATHLETES_LIST.find((athlete) => athlete.id === state.profile.athlete_id)?.name ||
          state.session.user.email
        : state.session.user.email;
      authUserEl.textContent = admin ? `${name} (admin)` : "No autorizado";
      authUserEl.hidden = false;
    } else {
      authUserEl.hidden = true;
    }
  }

  // La gestión de resultados solo existe para el administrador.
  if (navSubir) navSubir.hidden = !admin;
  if (boardResultLink) boardResultLink.hidden = !admin;
  if (resultSection) resultSection.hidden = !admin;
  if (athleteSelect) athleteSelect.disabled = !admin;

  renderHistory();
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
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", state.session.user.id)
      .maybeSingle();
    if (error) throw error;

    if (!profile || profile.role !== "admin") {
      const client = supabaseClient;
      state.profile = null;
      state.isAdmin = false;
      state.session = null;
      updateAuthUI();
      // Fuera del callback de auth para evitar bloqueos internos de Supabase.
      setTimeout(() => client.auth.signOut().catch(() => {}), 0);
      return;
    }

    state.profile = profile;
    state.isAdmin = true;
  } catch {
    state.profile = null;
    state.isAdmin = false;
  }

  updateAuthUI();
}

function registerAuthListener() {
  if (!supabaseClient || authListenerRegistered) return;
  authListenerRegistered = true;

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    setTimeout(async () => {
      await loadUserProfile();
      await loadResultsFromSupabase();
      renderAll();
      updateAuthUI();
    }, 0);
  });
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
  } catch {
    state.session = null;
  }

  await loadUserProfile();

  if (state.isAdmin) {
    try {
      await syncCatalogToSupabase();
    } catch {
      // La lectura de resultados sigue funcionando aunque falle la sincronización.
    }
  }

  state.authReady = true;
  updateAuthUI();
  registerAuthListener();
}

/**
 * Sincroniza atletas y entrenamientos de data.js con Supabase.
 * Así se puede seguir editando el próximo WOD en data.js y publicándolo:
 * al entrar como administrador, la base de datos recibe los cambios.
 */
async function syncCatalogToSupabase() {
  if (!state.isAdmin || !supabaseClient) return;

  const athletes = ATHLETES_LIST.map((athlete) => ({
    id: athlete.id,
    name: athlete.name,
  }));

  const workouts = WORKOUTS_LIST.map((workout) => ({
    id: workout.id,
    date: workout.date,
    name: workout.name,
    detail: workout.detail ?? "",
    time: workout.time ?? null,
    scoring: workout.scoring,
    warmup: workout.warmup ?? null,
    exercises: workout.exercises ?? [],
    note: workout.note ?? null,
  }));

  if (athletes.length) {
    const { error } = await supabaseClient.from("athletes").upsert(athletes, { onConflict: "id" });
    if (error) throw error;
  }

  if (workouts.length) {
    const { error } = await supabaseClient.from("workouts").upsert(workouts, { onConflict: "id" });
    if (error) throw error;
  }
}

async function loadResultsFromSupabase() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient.from("results").select("*");
    if (error) throw error;

    if (Array.isArray(data)) {
      state.results = data.map((result) => ({
        id: result.id,
        athleteId: result.athlete_id,
        workoutId: result.workout_id,
        date: result.date,
        value: result.value,
        notes: result.notes || "",
      }));
      store.save(state.results);
    }

    if (!athleteById.has(state.historyAthleteId) && ATHLETES_LIST[0]) {
      state.historyAthleteId = ATHLETES_LIST[0].id;
    }

    const availableRankings = workoutsWithResults();
    if (!availableRankings.some((workout) => workout.id === state.rankingWorkoutId)) {
      state.rankingWorkoutId = availableRankings[0]?.id ?? null;
    }
  } catch {
    // Si Supabase no responde, se mantiene el respaldo de data.js.
  }
}

if (authBtn) {
  authBtn.addEventListener("click", () => {
    if (supabaseConfigured()) showLoginDialog();
  });
}

if (authLogoutBtn) {
  authLogoutBtn.addEventListener("click", async () => {
    try {
      if (supabaseClient) await supabaseClient.auth.signOut();
    } catch {
      // ignore
    }
    state.session = null;
    state.profile = null;
    state.isAdmin = false;
    updateAuthUI();
    renderAll();
  });
}

if (loginCancel) {
  loginCancel.addEventListener("click", () => closeLoginDialog());
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      if (loginMsg) loginMsg.textContent = "Supabase no está disponible.";
      return;
    }

    const email = loginEmail?.value?.trim() || "";
    const password = loginPassword?.value || "";
    if (!email || !password) {
      if (loginMsg) loginMsg.textContent = "Introduce email y contraseña.";
      return;
    }

    if (loginMsg) loginMsg.textContent = "Entrando...";

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      state.session = data.session;
      await loadUserProfile();

      if (!state.isAdmin) {
        if (loginMsg) loginMsg.textContent = "No autorizado. Solo el administrador puede acceder.";
        if (loginPassword) loginPassword.value = "";
        return;
      }

      try {
        await syncCatalogToSupabase();
      } catch {
        // No bloquea el inicio de sesión; se reintentará en la próxima visita.
      }

      closeLoginDialog();
      await loadResultsFromSupabase();
      renderAll();
      updateAuthUI();
    } catch {
      if (loginMsg) {
        loginMsg.textContent = "No se ha podido iniciar sesión. Revisa el email y la contraseña.";
      }
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
  if (supabaseConfigured() && supabaseClient) {
    await loadResultsFromSupabase();
    renderAll();
    updateAuthUI();
  }
}

init();
