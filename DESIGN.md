# DESIGN.md — HIERRO

Sistema visual de la superficie **Operate** (app de uso diario). Documenta el mundo
construido, no una intención previa. Se deriva del código en `styles.css`.

## Tesis

La app se ve como la **señalética de un gimnasio**: bandas amarillas de señal con tinta
negra, pictogramas blancos sobre cuadros negros, reglas finas separando filas y números
monumentales en tipografía condensada. El amarillo **no es decoración**: marca acción y
decisión (la próxima serie, el botón que avanza, el objetivo elegido). Todo lo demás es
grafito, tiza y el color oficial de los discos.

Lo que este mundo rechaza por defecto: tarjetas redondeadas con sombra suave y halo,
glassmorphism, degradados, acento neón sobre negro, y el panel de métricas genérico
(número grande + etiqueta chica + barra de progreso brillante). Las métricas existen, pero
se presentan como un **tablero reglado**, una línea por dato, con el valor alineado a la
derecha en números tabulares.

## Paleta (`:root` en styles.css)

| Token | Valor | Uso |
|---|---|---|
| `--asphalt` | `#0B0C0D` | Suelo de la app. Negro de piso de goma. |
| `--panel` | `#16181B` | Superficie de tableros y tarjetas. |
| `--panel-2` | `#1D2024` | Fila activa, hover, fichas. |
| `--panel-3` | `#23272C` | Riel de progreso, etiquetas neutras. |
| `--line` / `--line-2` | `#2C3037` / `#3A3F47` | Reglas de 1 px y bordes de control. |
| `--chalk` | `#F4F5F7` | Tinta principal (contraste ≈ 19:1 sobre asfalto). |
| `--chalk-dim` | `#A6ACB4` | Texto secundario (≈ 7,4:1 sobre panel). |
| `--chalk-faint` | `#8A9199` | Notas y ayudas (≈ 4,9:1 sobre panel). |
| `--sign` | `#FFC72C` | **Amarillo de señal.** Solo acción, decisión y estado activo. |
| `--sign-deep` | `#E0A800` | Hover del amarillo. |
| `--sign-ink` | `#101112` | Tinta sobre amarillo. |

Superficies de estado y aviso (fuera de la tabla principal, pero parte del sistema):

| Valor | Uso |
|---|---|
| `#14171A` | Fondo de una fila de serie ya completada. |
| `#1A1710` | Fondo de la opción elegida en el alta de perfil. |
| `#FF8B7A` / `#8A3E34` / `#5A2A24` / `#FFB4A6` | Familia de error y acciones destructivas (texto, borde, fondo). |

Colores de disco (IWF), usados **solo** en la carga de barra y en los marcadores de serie:

`--plate-25 #C8102E` · `--plate-20 #0057B8` · `--plate-15 #F2C200` · `--plate-10 #00A651`
· `--plate-5 #EDEFF2` · `--plate-25s #C8102E` (2,5 kg) · `--plate-125 #C9CDD3` (1,25 kg).

`--plate-15` es amarillo IWF, casi idéntico a `--sign`: es el color real del disco de 15 kg
y aparece solo dentro del gráfico de carga, tamaño disco, nunca como superficie de señal.

Regla de color: una sola familia cromática actúa (amarillo); el resto es acromático. Los
colores de disco son datos, no decoración: identifican físicamente un objeto del gimnasio.

## Tipografía

Una superfamilia, dos cortes, servida desde Google Fonts con `display=swap`:

- **Fira Sans Condensed** (500/600/700/800): títulos, números monumentales, bandas de señal,
  botones, marcadores de serie. Aporta el carácter de cartel y la densidad que pide una
  pantalla de gimnasio.
- **Fira Sans** (400/500/600/700): texto de interfaz, etiquetas, notas.

Escala (`:root`): `--t-micro 11px` · `--t-sm 12.5px` · `--t-base 15px` · `--t-md 17px`
· `--t-lg 22px` · `--t-xl 34px` · `--t-mega 52px` (marca de acceso).

Números siempre tabulares (`font-variant-numeric: tabular-nums`): un cronómetro o un peso
que bailan de ancho son ilegibles entre series. Piso de legibilidad: 11 px para cualquier
texto funcional.

**Excepción de plataforma:** los campos de formulario (`.input`, `.select`) van a 16 px y no
a `--t-base` (15 px). Por debajo de 16 px, Safari en iOS hace zoom automático al enfocar un
campo y descoloca toda la pantalla. No es una decisión tipográfica: es el precio de que el
formulario se comporte como una app.

## Componentes

- **Banda de señal** (`.nextband`): franja fija inferior con la próxima decisión —qué serie
  sigue, con qué peso— y el cronómetro de descanso. Es la cadena de señalización del
  entrenamiento: se vuelve a firmar en cada serie y hace un vuelco tipo panel de aeropuerto
  (`@keyframes flap`) cuando cambia la serie. Flota sobre el contenido a propósito (por eso
  es la única superficie con sombra y por eso la vista reserva 150 px al pie, más el
  `safe-area-inset` de iOS): el contenido pasa por debajo y siempre se puede desplazar para
  dejarlo a la vista.
- **Tablero reglado** (`.board`): una línea por métrica, con el valor en números
  monumentales a la derecha. Sin tarjetas dentro de tarjetas.
- **Placa de ejercicio** (`.unit`): pictograma o microfigura en un cuadro negro a la
  izquierda, nombre y grupo muscular, filas de serie y una barra de acciones al pie.
- **Fila de serie** (`.setrow`): disco numerado, control de repeticiones, el objetivo de la
  serie al lado del valor real, control de carga y botón de verificación. Si la serie
  terminó por debajo del objetivo, el número real se marca en amarillo. La carga se edita
  con dos controles gemelos (no con un teclado), con área táctil ampliada a 44 px sin
  agrandar el dibujo.
- **Carga de barra** (`.plateload`): panel negro con el gráfico de la barra, los discos por
  lado en su color oficial, el detalle ("1 × 20 kg") y la suma. Es el mecanismo propio del
  producto. En pantallas anchas se despliega en dos columnas dentro del tracker.
- **Microfigura fotográfica** (`.unit__picto img`): en blanco y negro. El color está
  reservado para los discos; una foto a color metería una paleta ajena al sistema. La hoja
  de técnica sí muestra la foto original, porque ahí el color es material de estudio.
- **Pictogramas** (`PICTO` en `app.js`): diagramas geométricos del implemento y la
  trayectoria, en tiza y amarillo. Son respaldo honesto cuando no hay microfigura, nunca
  una ilustración que imite una foto.

## Profundidad, radios y movimiento

- Sin sombras de tarjeta: la elevación se declara con **reverso** (amarillo sobre negro) o
  con una regla de 1 px. Única excepción: la banda fija proyecta una sombra hacia arriba
  porque flota sobre el contenido.
- Radios: `--radius 6px` en paneles y controles, `--radius-sm 4px` en fichas y etiquetas.
  Las bandas de señal son rectangulares: la señalética no es una tarjeta.
- Movimiento: un solo momento orquestado (el vuelco de la banda al cambiar de serie) más
  respuestas directas (marcar una serie, abrir la hoja de técnica). Nada de entradas
  animadas repetidas por sección. Todo respeta `prefers-reduced-motion`.
- Superficies del navegador tematizadas desde la paleta: selección de texto, cursor de
  escritura, barras de desplazamiento y anillo de foco amarillo.

## Estructura responsive

- Móvil (base): una columna, máximo 620 px, navegación inferior de 4 secciones, banda de
  señal por encima de la barra de pestañas.
- Escritorio (≥1000 px): riel lateral de 232 px con el nombre de cada sección, contenido de
  hasta 940 px, la banda de señal centrada al pie del área de contenido y la carga de barra
  desplegada en dos columnas.
- Probado a 320, 360, 390, 430 y 1440 px de ancho. A 320 la fila de serie se acomoda en dos
  líneas en vez de apretar los controles.

## Comportamiento de aplicación en el celular

Lo que hace que se sienta app y no página, declarado en la base de `styles.css`:

- `overscroll-behavior: none` en `html` y `body`: sin pull-to-refresh ni rebote elástico que
  recargue la pantalla a mitad de una serie.
- `touch-action: manipulation` en todos los controles: sin el retardo de 300 ms ni el zoom
  por doble toque.
- Sin selección accidental de texto en la interfaz (botones, navegación, fichas, discos,
  bandas); los campos de texto siguen seleccionables.
- Sin menú contextual al mantener pulsada una microfigura (`-webkit-touch-callout: none`).
- `viewport-fit=cover` + `env(safe-area-inset-*)` en cabecera, banda, barra de pestañas,
  avisos y pie de vista: nada queda debajo del notch, la isla o la barra de gestos.
- `100dvh` en la pantalla de acceso, para que la barra del navegador móvil no recorte el
  contenido al aparecer y desaparecer.
- Instalación: `manifest.json` con `display: standalone`, icono `maskable` para Android,
  `apple-touch-icon` de 180 px y accesos directos (mantener pulsado el icono) a Entrenar y
  Progreso. En Android y escritorio aparece el botón de instalar; en iOS la app muestra las
  instrucciones exactas (Compartir → Añadir a pantalla de inicio), porque Safari no tiene
  instalación programática.
- Service worker con precarga del shell: abre sin conexión y sin barra de navegador cuando
  está instalada.

## Estado y accesibilidad

Estados cubiertos: vacío (sin sesiones), en curso, completado, con récord, error de
formulario, sin conexión (pictograma de respaldo) y sin permiso de instalación.
Foco visible en todo control, `aria-current` en la navegación, `aria-pressed` en
interruptores y verificaciones, `aria-expanded` en las sesiones del historial, etiquetas
explícitas en cada campo y `role="status"` en los avisos.
