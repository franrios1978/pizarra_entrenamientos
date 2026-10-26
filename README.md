# Pizarra de entrenamientos (Crew WOD)

Web estática para mostrar el próximo entrenamiento, los rankings y el historial
de resultados del grupo. No necesita build: basta con abrir `src/index.html` o
servir la carpeta `src/`.

## Estructura

```
src/
├── index.html        Estructura de la página
├── main.js           Lógica (pintado, formulario, ranking, gestión admin)
├── data.js           Entrenos y atletas publicados (y respaldo de resultados)
├── supabase-config.js Configuración de Supabase
└── css/global.css    Estilos
```

- **`data.js`** contiene los entrenos y atletas publicados, y sirve de respaldo
  de resultados si Supabase no responde.
- **`main.js`** no se toca salvo que quieras cambiar el funcionamiento.
- **Supabase** guarda los resultados compartidos y las cuentas de acceso.

## Desarrollo

```sh
pnpm install
pnpm run dev        # sirve src/ en http://localhost:8080
pnpm run lint       # oxlint sobre src/
pnpm run fmt        # oxfmt (opcional)
```

## Gestionar resultados (administrador)

La web usa **Supabase** como base de datos compartida. Solo el usuario con rol
`admin` puede añadir, editar o borrar resultados. El resto de personas puede
consultar la pizarra, el ranking y el historial, pero no modificar nada.

Administrador actual: `franrios1978@hotmail.com`.

### Configuración inicial (una sola vez)

1. En **Supabase → Authentication → Users**, crea o confirma el usuario
   `franrios1978@hotmail.com` con su contraseña.
2. En **Supabase → SQL Editor**, ejecuta el archivo completo
   [`supabase/setup.sql`](supabase/setup.sql). Ese script:
   - hace una copia de seguridad de los datos actuales en el esquema `backup`;
   - sustituye los datos de prueba por los entrenos y resultados actuales;
   - asigna el rol `admin` a `franrios1978@hotmail.com`;
   - configura RLS: lectura pública y escritura solo del administrador.
3. En **Authentication → Providers → Email**, desactiva la opción de permitir
   nuevos registros. Si existen cuentas de otras personas, puedes borrarlas desde
   **Authentication → Users**; aunque entren, no tendrán permisos de escritura.
4. Comprueba que `src/supabase-config.js` tiene `USE_SUPABASE: true`.
5. Publica la web:

   ```sh
   pnpm run deploy
   ```

### Uso diario

1. Abre la web publicada o `pnpm run dev` en local.
2. Pulsa **Iniciar sesión** y entra con tu email y contraseña.
3. Cuando aparezca `Fran (admin)`:
   - usa **Subir resultado** para añadir o actualizar un resultado;
   - en **Historial por persona**, usa **Editar** o **Borrar** sobre cualquier
     resultado.
4. Los cambios se guardan directamente en Supabase. Ya no hay que descargar ni
   sustituir `data.js` para publicar resultados.

### Comprobar que todo funciona

- Sin iniciar sesión: se ven los mismos resultados y no aparece el formulario.
- Con tu sesión: aparece el formulario y la columna **Acciones**.
- Al recargar, los cambios siguen ahí porque están en Supabase.
- Si un usuario que no es administrador intenta entrar, la web cierra su sesión
  y no le muestra ninguna opción de gestión.

### Seguridad

La `publishable key` de Supabase es pública, como corresponde en una web
estática. La seguridad real está en las políticas RLS de `supabase/setup.sql`:
sin una sesión con `role = 'admin'`, la base de datos rechaza cualquier escritura.

No publiques nunca la `service_role key` en el repositorio ni en el navegador.

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

Al iniciar sesión como administrador, la web sincroniza automáticamente los
atletas y entrenamientos de `data.js` con Supabase. Así puedes seguir renovando
el WOD en `data.js`, publicar con `pnpm run deploy` y entrar después para
gestionar los resultados.

## Seguridad

La web no guarda contraseñas: el login lo gestiona Supabase Auth. Los permisos
de escritura están limitados por RLS al usuario con rol `admin`.

Nunca incluyas la `service_role key` de Supabase en el código del navegador.
