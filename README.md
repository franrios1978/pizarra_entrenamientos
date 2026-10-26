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

| Síntoma                                 | Causa                      | Solución                                        |
| --------------------------------------- | -------------------------- | ----------------------------------------------- |
| No aparecen los resultados nuevos       | `RESULTS_VERSION` no subió | Súbela a mano (+1) en `src/data.js` y publica   |
| Un resultado sale en la fecha que no es | `SEED_RESULTS` sin `date`  | Añade `date` (`AAAA-MM-DD`) al resultado        |
| Siguen saliendo los antiguos            | Caché del navegador        | Recarga con Ctrl+Shift+R                        |
| La web publicada no cambia              | Se publicó antes del push  | Repite `git push` y `pnpm exec gh-pages -d src` |
| Tarda en actualizarse                   | Despliegue de GitHub Pages | Espera 1-2 minutos                              |







## Activar Supabase (base de datos compartida)

La web ya está preparada para usar [Supabase](https://supabase.com) como base de datos compartida. Por defecto sigue funcionando con `localStorage` + `data.js`, así que no se rompe nada al integrar esta funcionalidad.

### 1) Comprobar que todo funciona en modo actual
Antes de activar Supabase, asegúrate de que el modo actual sigue bien:

```sh
pnpm run dev
```

Abre `http://localhost:8080` y comprueba que la pizarra, el ranking, el historial, el formulario y el reloj funcionan correctamente.

### 2) Activar Supabase
Edita `src/supabase-config.js` y cambia `USE_SUPABASE` a `true`:

```js
"use strict";
// Configuración de Supabase
// USE_SUPABASE = false por defecto para mantener compatibilidad hacia atrás
// Cambiar a true solo cuando todo esté probado
const SUPABASE_CONFIG = {
  USE_SUPABASE: true,
  URL: "https://jgjmlpwnytjwpsponbxr.supabase.co",
  KEY: "sb_publishable_SF97o_H3_cU7PsLuCNyc8A_72Lg26FW"
};
```

### 3) Probar login, permisos y guardado
Recarga la página con `Ctrl+Shift+R` para evitar caché.

- **Login:** Ahora aparecerá el botón `Iniciar sesión` en la cabecera.
- **Admin (Fran):** Al iniciar sesión aparecerá `(admin)`. El selector de atleta estará habilitado y podrás subir o corregir resultados de cualquiera.
- **Miembros:** Solo podrán subir o actualizar resultados de su propio atleta. El selector se fuerza automáticamente a su perfil.
- **Lectura pública:** La pizarra, ranking e historial siguen siendo visibles sin necesidad de iniciar sesión.
- **Guardado:** Al apuntar un resultado con sesión iniciada, debería aparecer el mensaje `sincronizado con Supabase`. Comprueba en `Table Editor > results` de Supabase que se ha guardado correctamente.

### 4) Dar acceso a Lucía y Fernando
Cuando consigas sus correos, crea sus cuentas y vincúlalas:

1. Ve a `Authentication > Users > Add user` en Supabase y crea su usuario. Marca `Auto Confirm User` si aparece.
2. Copia su UUID y ejecuta este SQL en `SQL Editor` (cambia el UUID por el real):

```sql
-- Para Lucía
insert into public.profiles (id, athlete_id, role) values ('UUID_LUCIA', 'lucia', 'member') on conflict (id) do update set athlete_id = excluded.athlete_id, role = 'member';
insert into public.allowed_users (user_id, athlete_id, enabled) values ('UUID_LUCIA', 'lucia', true) on conflict (user_id) do update set athlete_id = excluded.athlete_id, enabled = true;

-- Para Fernando
insert into public.profiles (id, athlete_id, role) values ('UUID_FERNANDO', 'fernando', 'member') on conflict (id) do update set athlete_id = excluded.athlete_id, role = 'member';
insert into public.allowed_users (user_id, athlete_id, enabled) values ('UUID_FERNANDO', 'fernando', true) on conflict (user_id) do update set athlete_id = excluded.athlete_id, enabled = true;
```

### 5) Desplegar a GitHub Pages
Si todo funciona correctamente en local con `USE_SUPABASE=true`:

```sh
git add src/supabase-config.js
git commit -m "Activar Supabase"
git push
pnpm run deploy
```

> **Truco:** Si en cualquier momento hay algún problema con Supabase, vuelve a poner `USE_SUPABASE: false` en `src/supabase-config.js`. La web volverá al modo actual (`localStorage` + `data.js`) sin romper nada.


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
