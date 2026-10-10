# HIERRO — diario de entrenamiento

Web App móvil (PWA) para registrar entrenamientos de gimnasio: rutinas por objetivo,
series con kilos y repeticiones, cronómetro de descanso, cálculo de discos por lado de la
barra, récords personales y progreso. Sin backend, sin paso de compilación, lista para
GitHub Pages.

> **Microfiguras:** `data/exercises.js` apunta al repositorio público
> [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db) servido por
> jsDelivr. Ese repositorio tiene dos fotos por ejercicio (posición inicial y final) y la
> app las cruza en fundido para animar el movimiento. Si tenés tu propio repositorio de
> GIF/SVG, cambiá `meta.imageBase` y `meta.frameExt` (ver más abajo).

---

## 0. Qué hace

- **Usuarios con alta del administrador**: no hay registro libre. La primera cuenta de un dispositivo es el administrador, y desde ahí se dan de alta los demás con usuario y contraseña. Las contraseñas se guardan derivadas con **PBKDF2-SHA256 (150.000 iteraciones + sal por usuario)**: la contraseña en claro nunca se almacena. El administrador gestiona altas, bajas, restablecimientos y puede desactivar usuarios; **no puede leer los entrenamientos de nadie**.
- **Datos**: se guardan en **IndexedDB** (con respaldo automático diario incluido), más exportar/importar JSON completo y **CSV** del historial. Migración automática y reversible desde el formato anterior, sin borrar el respaldo viejo.
- **Rutinas por objetivo** (hipertrofia, fuerza, definición, resistencia) y **elegís cuántos ejercicios hacés**: la rutina es el punto de partida, no un contrato. Podés sumar cualquier ejercicio del catálogo (72) con buscador y filtro por músculo, y quitar los que no vayas a hacer.
- **Fecha elegible**: antes de empezar elegís el día (hoy, ayer, anteayer o la fecha exacta) y después lo podés corregir en el tracker. Sirve para registrar un entrenamiento de otro día sin mentirle a las estadísticas.
- **Progresión automática**: el peso de cada ejercicio se **deriva de tu historial**, no de un número fijo. Con objetivo de fuerza sube cuando completás todas las series; en el resto primero trepa repeticiones dentro del rango (doble progresión); y después de tres sesiones sin completar, baja un 10 % para volver a subir. Cada tarjeta dice **por qué** ese peso. Se puede apagar desde Perfil.
- **Calculadora de discos**: qué cargar en cada lado, con el color oficial de cada disco. Panel por ejercicio y calculadora suelta en Perfil. El botón **Igualar** copia la primera serie a todas.
- **1RM estimado** por ejercicio (Epley) con su curva en el tiempo y la serie de la que salió. Se estima solo hasta 12 repeticiones: más arriba las fórmulas dejan de coincidir y la app prefiere no inventar.
- **Músculos**: volumen de los últimos 7 días por grupo muscular y el estado de recuperación (24 a 60 h según cuán dura fue la última sesión de ese músculo).
- **Cronómetro de descanso** con aviso sonoro y vibración, **pantalla encendida** mientras entrenás (wake lock), historial, récords, exportar e importar copias y **funcionamiento sin conexión**.

## 0.b Usuarios, contraseñas y accesos

**No hay registro libre.** Nadie puede crearse una cuenta solo: los usuarios los da de alta el
administrador, con su usuario y su contraseña.

- **Primera vez en un dispositivo**: la app pide el **alta del administrador** (usuario, contraseña,
  peso, altura, objetivo y experiencia). Es la única cuenta que se crea sin que exista otra.
- **Después**: la pantalla de acceso solo permite entrar. Si alguien no tiene usuario, el aviso dice
  que se lo tiene que dar el administrador.
- **Perfil → Usuarios** (solo el administrador): dar de alta, restablecer contraseña, activar o
  desactivar, borrar y **generar el enlace de alta**.
- **Enlace de alta**: para que alguien use la app en su propio teléfono, el administrador genera un
  enlace y se lo pasa junto con la contraseña. Al abrirlo, la app agrega la cuenta a ese dispositivo.
  El enlace contiene la sal y la derivación de la contraseña (nunca la contraseña en claro): hay que
  tratarlo con el mismo cuidado que una credencial.
- **Privacidad**: cada persona ve solo sus entrenamientos. El administrador administra cuentas, pero
  **no puede leer los datos de entrenamiento de los demás**. Todo queda en el dispositivo.
- **Cómo se guardan las contraseñas**: PBKDF2-SHA256 con 150.000 iteraciones y una sal distinta por
  usuario. La contraseña en claro no se guarda ni se transmite nunca. Las cuentas del formato
  anterior se actualizan solas a este esquema la primera vez que entran.

## 0.c Datos, respaldos y formatos

| Qué | Dónde |
|---|---|
| Usuarios, historiales, respaldos | **IndexedDB** (`hierro`), con respaldo automático a `localStorage` si el navegador no la permite |
| Respaldo automático | Uno por día al abrir la app; se guardan 8 y se restauran desde Perfil |
| Copia completa | JSON con todos los usuarios y todos los historiales (solo administrador) |
| Copia individual | JSON del historial propio (Perfil → Exportar mis datos) |
| Historial en planilla | CSV, una fila por serie |
| Migración | Automática `v1 → v2`, **reversible**: las claves viejas de `localStorage` quedan intactas como respaldo |

## 1. Probar en tu máquina

```bash
# Desde la carpeta gym-pwa-app
python -m http.server 8123
# Abrí http://127.0.0.1:8123
```

Con `file://` (doble clic en `index.html`) la app también funciona, pero el service worker
no se registra y el navegador bloquea algunas funciones. Para probar la instalación como
app, usá siempre un servidor.

## 2. Publicar en GitHub Pages

1. Creá un repositorio y subí **el contenido de esta carpeta** (no la carpeta entera) a la rama `main`.
2. En GitHub: `Settings → Pages → Source: Deploy from a branch → main / (root)`.
3. Esperá un minuto. La app queda en `https://TU-USUARIO.github.io/TU-REPO/`.

No hace falta Node, ni build, ni Actions. Todas las rutas son relativas, así que funciona
igual en la raíz del dominio o en un subdirectorio.

### Sobre Tailwind por CDN

Tailwind se carga desde `cdn.tailwindcss.com` como pide el brief. La identidad visual
completa —paleta, tipografía, bandas de señal, filas de serie, carga de barra— vive en
`styles.css`, así que la app se ve igual aunque ese CDN no cargue o no haya conexión: el
único uso de Tailwind en el marcado son tres clases en el `<body>` que `styles.css` ya
define por su cuenta. Tené en cuenta que ese CDN compila en el navegador y avisa por
consola que no está pensado para producción; si querés quitarlo, alcanza con borrar la
línea del `<script>` y el bloque `tailwind.config` de `index.html`.

## 3. Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura de la app y carga de dependencias (Tailwind, FontAwesome, Fira Sans). |
| `styles.css` | Sistema visual completo: bandas de señal, tableros reglados, filas de serie, carga de barra. |
| `app.js` | Toda la lógica: cuentas locales, estado, tracker, cronómetro, gráficos, pictogramas. |
| `data/exercises.js` | **Base de datos de ejercicios.** Editable. |
| `data/routines.js` | **Rutinas por objetivo.** Editable. |
| `data/ids-verified.json` | Lista de los identificadores del repositorio de figuras verificados contra el origen (fecha y método incluidos). Útil si agregás ejercicios. |
| `DESIGN.md` | Sistema visual: paleta, tipografía, componentes y reglas de movimiento. |
| `sw.js` | Service worker: la app abre sin conexión. |
| `manifest.json` + `icons/` | Instalación como app (PWA). |
| `PRODUCT.md` | Contexto de producto para quien mantenga el proyecto. |
| `tests/smoke.html` | Prueba de humo end-to-end en el navegador. |

## 4. Cambiar la base de ejercicios

Todo vive en `data/exercises.js`. Cada ejercicio:

```js
{
  key: 'bench_press',                                    // lo usan las rutinas: no lo repitas
  id: 'Barbell_Bench_Press_-_Medium_Grip',               // carpeta del repositorio de figuras
  name: 'Press de banca',                                // lo que ve el usuario
  muscle: 'Pecho', equipment: 'Barra',
  load: 'barbell',                                       // barbell activa la calculadora de discos
  pattern: 'horizontal_push',                            // pictograma si no hay figura
  defaultSets: 4, defaultReps: '8-10', defaultRest: 150,
  cues: ['Escápulas retraídas…', 'La barra baja…', 'Empujá el piso…'],
}
```

Para agregar un ejercicio: copiá un bloque, cambiá `key`, `id`, `name` y `cues`, y usá esa
`key` en `data/routines.js`. Si dejás `id: ''`, la app dibuja el pictograma vectorial del
patrón de movimiento (así se comporta hoy el ejercicio `burpee`, que no existe en el
repositorio de origen).

## 5. Cambiar el repositorio de microfiguras

En `data/exercises.js`, al principio:

```js
meta: {
  imageBase: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/',
  imageAltBase: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/',
  frameCount: 2,     // 2 = dos frames cruzados en fundido
  frameExt: '.jpg',  // .gif | .svg | .webp | .png
}
```

La URL de cada figura se arma según `meta.frameCount`:

- `frameCount: 2` (por defecto): `imageBase + id + '/0' + frameExt` y `…/1' + frameExt`.
  La app cruza los dos frames en fundido para animar el movimiento.
- `frameCount: 1`: `imageBase + id + frameExt`. Un solo archivo, sin fundido: sirve para un
  GIF animado o un SVG por ejercicio.

Para usar tu repositorio:

- **GIF animado por ejercicio (un archivo):** `frameCount: 1`, `frameExt: '.gif'`, y en cada
  ejercicio `id: 'mi-ejercicio'`, con `imageBase` apuntando a la carpeta de tus GIF.
- **Un solo frame (SVG o PNG):** `frameCount: 1` y `frameExt: '.svg'` o `'.png'`.
- **Repositorio propio en GitHub:** cualquier URL `raw.githubusercontent.com` o de jsDelivr
  funciona. Si usás jsDelivr sobre un repositorio grande, la primera carga puede tardar unos
  segundos; el service worker las guarda después.

Si una figura no carga (sin conexión, o el `id` no existe), la tarjeta y la hoja de técnica
caen automáticamente al pictograma vectorial del patrón de movimiento. Nunca queda un hueco.

## 6. Modelo de datos (localStorage)

| Clave | Contenido |
|---|---|
| `hierro.v1.users` | Perfiles locales: `{id, name, salt, hash, profile}`. |
| `hierro.v1.session` | Id del perfil activo. |
| `hierro.v1.user.<id>` | `{profile, prefs, sessions[], prs{}, bodyweight[], activeSession, lastRoutine}`. |

Los pesos se guardan **siempre en kilogramos**; la unidad de pantalla (kg/lb) es solo de
presentación. El volumen de una serie es `peso × repeticiones`, sumado sobre las series
marcadas como completadas.

**Sobre la contraseña:** se guarda hasheada (SHA-256 con sal) en el navegador para separar
perfiles de un mismo dispositivo. No es seguridad real: cualquiera con acceso al equipo
puede leer el historial. No la reutilices de otro servicio.

## 7. Prueba de humo

Con el servidor corriendo, abrí `http://127.0.0.1:8123/tests/smoke.html`. La página carga
la app en un iframe y recorre el flujo completo (crear perfil → rutina → series → descanso →
récord → guardar). Al final muestra `TODO OK` o la lista de fallas.

## 8. Créditos y licencias

- Microfiguras: [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público).
- Tailwind CSS, Font Awesome Free, Fira Sans (Google Fonts): cada uno con su licencia.
- El código de esta app podés usarlo y modificarlo libremente.
