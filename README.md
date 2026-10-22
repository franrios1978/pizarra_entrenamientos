# Pizarra de entrenamientos (Crew WOD)

Web estática para mostrar el próximo entrenamiento, los rankings y el historial
de resultados del grupo. No necesita build: basta con abrir `src/index.html` o
servir la carpeta `src/`.

## Estructura

```
src/
├── index.html        Estructura de la página
├── main.js           Lógica (pintado, formulario, ranking, panel admin)
├── data.js           Datos editables (entrenos, atletas y resultados publicados)
└── css/global.css    Estilos
```

- **`data.js`** es el único archivo que se edita para cambiar entrenos, atletas
  o publicar resultados.
- **`main.js`** no se toca salvo que quieras cambiar el funcionamiento.

## Desarrollo

```sh
pnpm install
pnpm run dev        # sirve src/ en http://localhost:8080
pnpm run lint       # oxlint sobre src/
pnpm run fmt        # oxfmt (opcional)
```

## Publicar nuevos resultados (rol de administrador)

> Importante: los resultados se guardan en el navegador (localStorage), no en
> el código. Para que todo el mundo los vea hay que regenerar `data.js` y
> subirlo al repositorio.

### Paso a paso

1. **Introducir los resultados** en la web local:

   ```sh
   cd ~/workspace/pizarra_entrenamientos
   pnpm run dev
   ```

   Abre <http://localhost:8080> y usa el formulario "Subir resultado" para cada
   deportista y entrenamiento. Comprueba que aparecen en ranking e historial.

   Hazlo siempre en **localhost**, no en la web publicada.

2. **Generar `data.js`**: pulsa el engranaje ⚙ abajo a la derecha, introduce la
   contraseña de administrador y pulsa **Descargar data.js**. El archivo se
   descarga con todos los resultados y con `RESULTS_VERSION` ya incrementada.

3. **Copiar al proyecto**:

   ```sh
   cp ~/Descargas/data.js src/data.js
   ```

   (o ábrelo en el editor, copia todo y pégalo sobre `src/data.js`)

4. **Verificar** que en `src/data.js` la línea `const RESULTS_VERSION = N;` tiene
   un número **mayor** que antes. Si no subió, los navegadores seguirán
   mostrando su copia antigua.

5. **Publicar** (primero push, después gh-pages):

   ```sh
   git add .
   git commit -m "Resultados entrenos N"
   git push
   pnpm exec gh-pages -d src
   ```

6. **Comprobar** la web publicada recargando con Ctrl+Shift+R:

   <https://franrios1978.github.io/pizarra_entrenamientos/>

### Chuleta rápida

```sh
pnpm run dev                              # 1. introducir resultados en localhost:8080
                                          # 2. engranaje ⚙ → contraseña → Descargar data.js
cp ~/Descargas/data.js src/data.js        # 3. copiar al proyecto
                                          # 4. verificar que RESULTS_VERSION subió
git add . && git commit -m "Resultados" && git push && pnpm exec gh-pages -d src
```

### Errores típicos

| Síntoma                           | Causa                      | Solución                                        |
| --------------------------------- | -------------------------- | ----------------------------------------------- |
| No aparecen los resultados nuevos | `RESULTS_VERSION` no subió | Súbela a mano (+1) en `src/data.js` y publica   |
| Un resultado sale en la fecha que no es | `SEED_RESULTS` sin `date` | Añade `date` (`AAAA-MM-DD`) al resultado        |
| Siguen saliendo los antiguos      | Caché del navegador        | Recarga con Ctrl+Shift+R                        |
| La web publicada no cambia        | Se publicó antes del push  | Repite `git push` y `pnpm exec gh-pages -d src` |
| Tarda en actualizarse             | Despliegue de GitHub Pages | Espera 1-2 minutos                              |

### Empezar de cero

Borra la clave `crewwod:results` en el localStorage del navegador
(F12 → Application → Local Storage) y vuelve a introducir los resultados.

## Editar entrenamientos y atletas

Todo está en `src/data.js`:

- `WORKOUTS`: lista de entrenamientos. El que tenga `id: NEXT_WORKOUT_ID` es el
  que se muestra en la pizarra al arrancar. Campos:
  - `date` en formato `AAAA-MM-DD`, `time` opcional (`HH:MM`)
  - `scoring`: `rounds`, `reps`, `time` o `weight`
  - `warmup`, `exercises` y `note` son opcionales; si faltan, se ocultan en la pizarra
  - en `exercises`, cada elemento puede ser un texto (`'Burpee 8 reps'`) o un
    objeto con vídeo: `{ text: 'Burpee 8 reps', video: 'https://...' }`
  - dentro de un ejercicio con vídeo, `hint` es opcional y muestra una etiqueta
    resaltada: `{ text: 'Burpee 8 reps', video: 'https://...', hint: 'Ver técnica' }`
- `ATHLETES`: personas del grupo (`id` único y `name`).
- `SEED_RESULTS`: resultados publicados. Cada uno lleva `athleteId`, `workoutId`,
  `date` (`AAAA-MM-DD`), `value` (número) y `notes`.

### Renovar el WOD de la semana (importante)

El id `"next"` se **reutiliza** cada semana. Para que los resultados no cambien de
entrenamiento al renovar el WOD:

1. Al cambiar el WOD, **archiva el anterior** con un id propio y su fecha:
   `{ "id": "wod-2026-10-23", "date": "2026-10-23", ... }`.
2. Deja `"next"` apuntando al WOD nuevo con su fecha nueva.
3. Los resultados se localizan por **fecha**, no por id: un resultado guardado el
   `2026-10-23` seguirá apareciendo en el historial del `2026-10-23` aunque su
   `workoutId` diga `"next"` o el entrenamiento se archive con otro id.

> Si un resultado se guarda contra `"next"` y la semana siguiente `"next"` es otro
> WOD, ese resultado se mostraría en el WOD equivocado. Por eso el campo `date`
> es obligatorio en los resultados.

## Seguridad

La contraseña del panel de administración está en `src/data.js` y es visible
leyendo el JavaScript de la web. Sirve para operar cómodo, no como seguridad
real: en una web estática cualquiera puede verla. Para resultados compartidos
con seguridad haría falta un backend (API, Supabase, Firebase...).
