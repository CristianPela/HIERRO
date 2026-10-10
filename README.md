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
