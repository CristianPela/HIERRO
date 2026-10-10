# Cambios de HIERRO

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Cada bloque de trabajo es un commit propio y termina con la prueba automática en verde.

## [Bloque 1] Almacenamiento, usuarios y respaldos

### Agregado
- **Núcleo separado** (`app-core.js`): almacenamiento, credenciales, formatos y migraciones,
  independiente de la interfaz y probable en Node.
- **IndexedDB** como almacenamiento principal (`hierro`, versión 2), con **respaldo
  automático a `localStorage`** si el navegador no la permite. La app no se entera del cambio.
- **Contraseñas con PBKDF2-SHA256**, 150.000 iteraciones y sal de 16 bytes por usuario
  (WebCrypto). Si el contexto no tiene WebCrypto, hay un derivador de respaldo marcado como débil.
- **Modelo de usuarios con roles** (`admin` / `user`), alta manual por el administrador,
  desactivación, restablecimiento de contraseña y borrado (con guardas: no podés borrarte a vos
  mismo ni quedarte sin administradores).
- **Enlace de alta**: lleva una cuenta ya creada a otro dispositivo sin backend. Incluye la sal y
  la derivación, nunca la contraseña; se limpia de la barra de direcciones al leerse.
- **Exportar historial en CSV** (una fila por serie, con BOM para Excel) e **importar CSV**
  sumando sesiones sin borrar las existentes.
- **Respaldo completo del dispositivo** (todos los usuarios y sus historiales) con restauración.
- **Respaldos automáticos**: uno por día al abrir la app, hasta 8 guardados, restaurables desde Perfil.
- **Migración versionada y reversible** `v1 → v2`: los datos del formato viejo se copian a
  IndexedDB y **las claves viejas de `localStorage` NO se borran**.
- **Actualización transparente de credenciales**: un usuario del formato viejo entra con su
  contraseña de siempre y su credencial pasa a PBKDF2 sin que haga nada.
- **Señal `HIERRO.ready`** y **traza de arranque** (`HIERRO.bootTrace`) para diagnóstico en el
  dispositivo del usuario.
- **Pruebas unitarias con Node** (`node tests/core.test.mjs`) y la prueba de humo ampliada a
  **108 comprobaciones** en navegador real, incluida la migración punta a punta.

### Cambiado
- **Se eliminó el auto-registro.** La pantalla de acceso solo permite entrar; si el dispositivo no
  tiene usuarios, ofrece el **alta del administrador**. Se fueron las pestañas "Entrar / Crear perfil".
- `saveData()` guarda **inmediatamente** en IndexedDB (antes agrupaba escrituras y podía perderse
  el último toque al cerrar la app). El agrupado quedó solo para campos que se escriben letra a letra.
- El **service worker** pasó a *stale-while-revalidate* para los recursos propios: una versión nueva
  entra en la carga siguiente sin depender de acordarse de subir `VERSION`.
- El error de acceso se limpia al empezar cada intento.

### Corregido
- La tabla `meta` se creaba sin clave, así que guardar el esquema fallaba y la app caía al respaldo
  sin decirlo.
- La sesión activa se leía como registro completo en lugar de su valor, y no se restauraba al recargar.

## [v1] Publicación inicial

### Agregado
- PWA de entrenamiento: cuentas locales, rutinas por objetivo, tracker con series, cronómetro de
  descanso, cálculo de discos, historial, récords, peso corporal, exportar e importar JSON y
  funcionamiento sin conexión.
- Fecha elegible, elegir cuántos ejercicios, progresión automática derivada del historial,
  1RM estimado, volumen y recuperación por músculo, calculadora de discos y pantalla encendida.
