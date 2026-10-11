/* ═══════════════════════════════════════════════════════════════════════════
   HIERRO — app.js
   Diario de entrenamiento. JavaScript vainilla, sin compilación, sin backend.
   Secciones:
     1. Utilidades          6. Pictogramas vectoriales de respaldo
     2. Almacenamiento      7. Cronómetro de descanso y avisos
     3. Estado y sesiones   8. Vistas
     4. Cuentas locales     9. Router y render
     5. Unidades y discos  10. Eventos y arranque
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ═══ 1. UTILIDADES ═══════════════════════════════════════════════════════ */

var DB = window.GYM_DATA || { exercises: [], index: {}, meta: {} };
var RT = window.GYM_ROUTINES || { routines: [], index: {}, objetivos: {} };

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function firstNumber(text) { var m = String(text == null ? '' : text).match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : 0; }

/* Unidad de las repeticiones según el texto objetivo: '8-10' reps, '45 s', '40 m'. */
function repUnitOf(text) {
  var t = String(text || '').toLowerCase();
  if (/\bs\b|\bseg|segundo/.test(t)) return 's';
  if (/\bmin\b/.test(t)) return 'm';
  if (/\bm\b|metro/.test(t)) return 'm2';
  return 'reps';
}
function repUnitLabel(u, n) {
  if (u === 's') return 'seg';
  if (u === 'm') return 'min';
  if (u === 'm2') return 'm';
  return n === 1 ? 'rep' : 'reps';
}

var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function todayISO(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/* Fecha de hace n días, en ISO local. */
function isoDaysAgo(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return todayISO(d);
}
function fmtDayLong(iso) {
  var p = String(iso).split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS[d.getMonth()];
}
function fmtDayShort(iso) {
  var p = String(iso).split('-');
  return (+p[2]) + '/' + (+p[1]);
}
/* "Hace cuánto" en lenguaje humano, para la recuperación por músculo. */
function haceCuanto(horas) {
  if (horas < 1) return 'recién';
  if (horas < 24) return 'hace ' + Math.round(horas) + ' h';
  var d = Math.round(horas / 24);
  return 'hace ' + d + (d === 1 ? ' día' : ' días');
}
function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  var m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
/* Igual que fmtClock, pero para mostrar duraciones ("1:30", "12:00"). */
function fmtSeg(sec) { return fmtClock(sec); }
function fmtNum(n, dec) {
  if (dec == null) dec = 0;
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}
/* Kilos con los decimales que realmente existen: 60 · 82,5 · 61,25 */
function fmtKg(v) {
  v = Number(v) || 0;
  var cents = Math.round(Math.abs(v) * 100) % 100;
  var dec = cents === 0 ? 0 : (cents % 10 === 0 ? 1 : 2);
  return fmtNum(v, dec);
}

function exOf(key) {
  return DB.index[key] || { key: key, name: key, muscle: '—', pattern: 'core', load: 'other', cues: [], defaultRest: 90 };
}
function routineOf(key) { return RT.index[key] || null; }
function objetivoLabel(o) { return (RT.objetivos && RT.objetivos[o] && RT.objetivos[o].label) || o; }

/* ── Ruta de las microfiguras ───────────────────────────────────────────
   Cambiá meta.imageBase en data/exercises.js para usar tu propio repositorio.
   Con meta.frameCount >= 2 se arman dos frames:  <base><id>/0.jpg y /1.jpg
   Con meta.frameCount = 1 hay un solo archivo:   <base><id>.gif */
var imgBaseB = false; // pasa a true si el CDN principal falla y hay que usar el espejo
function frameCount() { return Number((DB.meta || {}).frameCount) || 2; }
function imgUrl(id, n) {
  if (!id) return '';
  var meta = DB.meta || {};
  var base = imgBaseB ? (meta.imageAltBase || meta.imageBase) : meta.imageBase;
  var ext = meta.frameExt || '.jpg';
  return frameCount() <= 1 ? (base + id + ext) : (base + id + '/' + (n || 0) + ext);
}

/* ═══ 2. ALMACENAMIENTO ═══════════════════════════════════════════════════
   IndexedDB por medio del núcleo (app-core.js). Los datos del formato viejo
   de localStorage se migran al abrir, sin borrar nada: quedan de respaldo. */

var CORE = window.HIERRO_CORE;
var guardadoPendiente = null;

/* Señal de "app lista": se resuelve cuando terminó de abrir la base y de
   pintar la primera pantalla. La usa la prueba automática y cualquier
   integración que necesite esperar a que HIERRO esté operativo. */
var readyResolve = null;
var readyPromise = new Promise(function (res) { readyResolve = res; });
/* Traza del arranque: solo para diagnóstico de la prueba automática. */
var bootTrace = [];
function paso(nombre) { bootTrace.push(nombre); }

/* Guarda el documento del usuario activo.
   `saveData()` escribe YA: con IndexedDB una escritura agrupada puede quedar a
   medio camino si el usuario cierra la app, y perder el último toque no es
   aceptable. `saveDataSoon()` se usa solo mientras alguien escribe un peso, que
   es el único caso en que se dispara muchas veces por segundo. */
function escribirDocumento() {
  guardadoPendiente = null;
  if (!state.account || !state.data) return;
  state.data.userId = state.account.id;
  CORE.store.saveDocument(state.data).catch(function () {
    toast('No se pudieron guardar los datos. Exportá una copia desde Perfil.', 'error');
  });
}

function saveData() {
  if (guardadoPendiente) { clearTimeout(guardadoPendiente); guardadoPendiente = null; }
  escribirDocumento();
}

function saveDataSoon() {
  if (guardadoPendiente) clearTimeout(guardadoPendiente);
  guardadoPendiente = setTimeout(escribirDocumento, 400);
}

function flushSave() {
  if (guardadoPendiente) { clearTimeout(guardadoPendiente); guardadoPendiente = null; escribirDocumento(); }
}

/* ═══ 3. ESTADO Y SESIONES ════════════════════════════════════════════════ */

var state = {
  users: [],
  account: null,   // cuenta activa (id, name, role, salt, hash, iterations, profile)
  data: null,      // datos del usuario activo
  view: 'hoy',
  filter: null,    // filtro de objetivo en la pantalla de entrenar
  strengthEx: null, // ejercicio elegido en la curva de fuerza estimada
  newSessionDate: todayISO(),  // día que se está por entrenar
  calcWeight: 60,              // peso de la calculadora de discos
  picker: { q: '', muscle: '' }, // estado del selector de ejercicios
  pickerMode: 'grupos',    // 'grupos' = armar el día por grupo muscular | 'rutinas' = rutinas listas
  gatePanel: 'login',      // 'login' (siempre) | 'alta-admin' (solo primera vez en el dispositivo)
  pendingObjetivo: null,  // elección provisional mientras se crea un usuario
  pendingNivel: null,
  migrated: false,        // la base se migró del formato viejo en esta apertura
  altaPendiente: null,    // paquete de alta recibido por enlace
  backups: null,          // respaldos automáticos del dispositivo (solo admin)
  _sheetEntry: null,      // ejercicio cuya hoja de técnica está abierta
  _stamp: null,           // serie recién marcada, para animar el check tras el render
};

function defaultPrefs() {
  return {
    sound: true, vibrate: true, barKg: 20, defaultRest: 90, unit: 'kg',
    wake: true,   // mantener la pantalla encendida mientras hay sesión
    prog: true,   // progresión automática de cargas
    timerSec: 90, // duración por defecto del cronómetro por ejercicio
    pickerMode: 'grupos', // cómo se elige el entrenamiento: por grupo muscular o rutinas listas
  };
}

function blankData(profile) {
  return {
    profile: profile,
    prefs: defaultPrefs(),
    sessions: [],
    prs: {},
    bodyweight: [],
    activeSession: null,
    lastRoutine: null,
    customExercises: [],
  };
}

/* Carga los datos del usuario activo. Asíncrono: la base es IndexedDB. */
function loadAccount(id) {
  var acc = null;
  for (var i = 0; i < state.users.length; i++) if (state.users[i].id === id) acc = state.users[i];
  if (!acc) return Promise.resolve(false);
  state.account = acc;
  return CORE.store.document(id).then(function (doc) {
    state.data = doc || blankData(acc.profile);
    state.data.userId = id;
    if (!state.data.profile) state.data.profile = acc.profile;
    // Las preferencias nuevas se suman a los perfiles que ya existían.
    state.data.prefs = Object.assign(defaultPrefs(), state.data.prefs || {});
    return CORE.store.setSessionId(id);
  }).then(function () { return true; });
}

function cerrarSesionLocal() {
  state.account = null;
  state.data = null;
  state._sheetEntry = null;
  if (guardadoPendiente) { clearTimeout(guardadoPendiente); guardadoPendiente = null; }
  Rest.stop();
  return CORE.store.setSessionId(null);
}

/* Rutina sugerida: la del objetivo y el nivel del perfil, priorizando las
   rutinas especializadas (las que tienen ese objetivo en primer lugar) sobre
   las transversales como "Cuerpo completo". */
function routineScore(r, obj) {
  var score = 0;
  if (r.objetivo[0] !== obj) score += 2;                       // no es su objetivo principal
  if (r.level !== (state.data.profile.level || 'Principiante')) score += 1; // otro nivel
  return score;
}
function suggestedRoutine() {
  if (state.data.lastRoutine && routineOf(state.data.lastRoutine)) return routineOf(state.data.lastRoutine);
  var obj = state.data.profile.objetivo;
  var cands = routinesFor(obj);
  if (!cands.length) return RT.routines[0] || null;
  return cands.slice().sort(function (a, b) { return routineScore(a, obj) - routineScore(b, obj); })[0];
}
function routinesFor(obj) {
  if (!obj) return RT.routines.slice();
  var out = RT.routines.filter(function (r) { return r.objetivo.indexOf(obj) !== -1; });
  if (!out.length) return RT.routines.slice();
  // Las especializadas primero; las transversales, al final.
  return out.sort(function (a, b) { return routineScore(a, obj) - routineScore(b, obj); });
}

/* ── Métricas de una sesión ───────────────────────────────────────────── */
function sessionStats(s) {
  var totalSets = 0, doneSets = 0, volume = 0, exercisesDone = 0;
  s.entries.forEach(function (e) {
    var any = false;
    e.sets.forEach(function (st) {
      totalSets++;
      if (st.done) { doneSets++; volume += (Number(st.weight) || 0) * (Number(st.reps) || 0); any = true; }
    });
    if (any) exercisesDone++;
  });
  return {
    totalSets: totalSets, doneSets: doneSets, volume: volume,
    exercisesDone: exercisesDone, exercises: s.entries.length,
    percent: totalSets ? Math.round(doneSets / totalSets * 100) : 0,
  };
}
function firstPending(s) {
  for (var i = 0; i < s.entries.length; i++) {
    for (var j = 0; j < s.entries[i].sets.length; j++) {
      if (!s.entries[i].sets[j].done) return { entry: i, set: j, ex: s.entries[i], st: s.entries[i].sets[j] };
    }
  }
  return null;
}

function startSession(routineKey, fechaISO) {
  var r = routineOf(routineKey);
  if (!r) return;
  // Nunca se descarta una sesión en curso sin preguntar.
  if (state.data.activeSession &&
      !confirm('Tenés una sesión sin terminar. ¿Empezar «' + r.name + '» y descartar la anterior?')) return;
  // El día se elige: sirve para registrar un entrenamiento de ayer u otro día.
  var fecha = fechaISO && /^\d{4}-\d{2}-\d{2}$/.test(fechaISO) ? fechaISO : todayISO();
  if (fecha > todayISO()) fecha = todayISO();   // nada de fechas futuras
  var session = {
    id: uid(), routineKey: r.key, routineName: r.name,
    objetivo: r.objetivo[0], date: fecha, startedAt: Date.now(), finishedAt: null,
    entries: r.items.map(function (it) { return newEntry(it.ex, r.objetivo[0], it); }),
  };
  state.data.activeSession = session;
  state.data.lastRoutine = r.key;
  saveData();
}

/* Peso de arranque cuando no hay historial: el que la rutina usa para ese
   ejercicio. Evita inventar un número y evita arrancar en cero. */
function routineDefaultWeight(exKey) {
  var w = 0;
  RT.routines.forEach(function (r) {
    r.items.forEach(function (it) {
      if (it.ex === exKey && Number(it.w) > w) w = Number(it.w);
    });
  });
  return w;
}

/* Arma la entrada de un ejercicio para la sesión en curso, con el peso que
   sugiere la progresión. Sirve tanto al empezar una rutina como al sumar un
   ejercicio suelto ("hoy hago tres ejercicios y listo"). */
function newEntry(exKey, objetivo, item) {
  var ex = exOf(exKey);
  var cfg = item || {};
  var repsTexto = cfg.reps || ex.defaultReps || '10';
  var cantidad = cfg.sets || ex.defaultSets || 3;
  var base = cfg.w != null ? Number(cfg.w) : routineDefaultWeight(exKey);
  var presc = prescriptionFor(exKey, { w: base, reps: repsTexto, prog: cfg.prog }, objetivo);
  return {
    ex: exKey, name: ex.name, muscle: ex.muscle, img: ex.id || '', pattern: ex.pattern, load: ex.load,
    unit: repUnitOf(repsTexto),
    rest: cfg.rest || ex.defaultRest || 90,
    presc: { kind: presc.kind, why: presc.why, policy: presc.policy },
    sets: Array.from({ length: cantidad }, function () {
      return {
        target: repsTexto,
        reps: presc.reps || firstNumber(repsTexto) || 10,
        weight: presc.weight > 0 ? presc.weight : base,
        done: false, ts: null, pr: false,
      };
    }),
  };
}

function addExerciseToSession(exKey) {
  var s = state.data.activeSession;
  if (!s) return;
  s.entries.push(newEntry(exKey, s.objetivo));
  saveData();
  toast(exOf(exKey).name + ' agregado.', 'sign');
  render();
}

function removeExerciseFromSession(entryIdx) {
  var s = state.data.activeSession;
  if (!s) return;
  if (s.entries.length <= 1) { toast('Una sesión necesita al menos un ejercicio.'); return; }
  var e = s.entries[entryIdx];
  var hechas = e.sets.filter(function (x) { return x.done; }).length;
  if (hechas && !confirm('«' + e.name + '» ya tiene ' + hechas + ' serie(s) marcada(s). ¿Quitarlo igual?')) return;
  s.entries.splice(entryIdx, 1);
  saveData(); render();
  toast(e.name + ' fuera de la sesión.');
}

/* Igualar todas las series a la primera: el atajo de calculadora más pedido. */
function applyFirstSetToAll(entryIdx) {
  var e = state.data.activeSession.entries[entryIdx];
  var base = e.sets[0];
  if (!base) return;
  e.sets.forEach(function (st) { st.reps = base.reps; st.weight = base.weight; });
  saveData(); render();
  toast('Todas las series quedaron en ' + fmtWeight(base.weight) + ' × ' + base.reps + '.');
}

function finishSession() {
  var s = state.data.activeSession;
  if (!s) return;
  var pend = firstPending(s);
  if (pend && !confirm('Todavía quedan series sin marcar. ¿Terminar y guardar igual?')) return;
  var stats = sessionStats(s);
  if (stats.doneSets === 0) {
    if (!confirm('No marcaste ninguna serie. ¿Descartar la sesión?')) return;
    state.data.activeSession = null; saveData(); Rest.stop(); render(); toast('Sesión descartada.'); return;
  }
  s.finishedAt = Date.now();
  state.data.sessions.unshift(s);
  state.data.activeSession = null;
  saveData(); Rest.stop();
  toast('Sesión guardada: ' + fmtNum(stats.volume) + ' kg de volumen.', 'sign');
  go('#/historial');
}

function discardSession() {
  if (!confirm('¿Descartar la sesión en curso? Se pierden las series registradas.')) return;
  state.data.activeSession = null;
  Rest.stop(); saveData(); go('#/hoy');
  toast('Sesión descartada.');
}

/* Marca o desmarca una serie y detecta récords personales. */
function toggleSet(entryIdx, setIdx) {
  var s = state.data.activeSession;
  if (!s) return;
  var e = s.entries[entryIdx], st = e.sets[setIdx];
  st.done = !st.done;
  st.ts = st.done ? Date.now() : null;
  if (st.done) {
    var prev = state.data.prs[e.ex];
    var w = Number(st.weight) || 0, r = Number(st.reps) || 0;
    var isPR = w > 0 && (!prev || w > prev.weightKg || (w === prev.weightKg && r > prev.reps));
    if (isPR) {
      st.pr = true;
      state.data.prs[e.ex] = { name: e.name, weightKg: w, reps: r, date: todayISO() };
      toast('Récord en ' + e.name + ': ' + fmtWeight(w) + ' × ' + r + '.', 'sign');
    } else {
      st.pr = false;
    }
    // El descanso solo arranca si queda alguna serie por hacer.
    if (firstPending(s)) Rest.start(e.rest || state.data.prefs.defaultRest || 90);
  } else {
    st.pr = false;
  }
  saveData();
  // El render reconstruye la fila: la confirmación se aplica al nodo nuevo.
  state._stamp = st.done ? { entry: entryIdx, set: setIdx } : null;
  render();
}

/* ═══ 4. USUARIOS Y ACCESO ════════════════════════════════════════════════
   No hay alta propia: los usuarios los crea el administrador de este
   dispositivo (o recibe un enlace de alta desde otro dispositivo). Las
   contraseñas se guardan derivadas con PBKDF2-SHA256 y sal por usuario; la
   contraseña en claro no se almacena ni viaja nunca. */

function usuarioPorNombre(nombre) {
  var n = String(nombre || '').trim().toLowerCase();
  return state.users.filter(function (u) {
    return u.id === nombre || u.name.toLowerCase() === n;
  })[0] || null;
}

function esAdmin() { return !!(state.account && state.account.role === 'admin'); }

/* Crea un usuario y su documento de datos. Devuelve el usuario creado.
   La contraseña se recorta: en el celular el teclado agrega espacios al final
   más seguido de lo que uno cree, y eso hace fallar un ingreso idéntico. */
function crearUsuario(nombre, password, rol, profile) {
  return CORE.crypto.newCredential(String(password).trim()).then(function (cred) {
    var user = CORE.validate.validateUser({
      id: uid(), name: nombre.trim(), role: rol === 'admin' ? 'admin' : 'user',
      salt: cred.salt, hash: cred.hash, iterations: cred.iterations,
      createdAt: Date.now(), profile: profile || null,
    });
    if (!user) throw new Error('datos de usuario inválidos');
    return CORE.store.saveUser(user).then(function () {
      var doc = blankData(user.profile || { name: user.name });
      state.users.push(user);
      return CORE.store.saveDocument(CORE.validate.validateDocument(doc, user.id)).then(function () { return user; });
    });
  });
}

/* El perfil físico completo es lo que permite calcular cargas y volúmenes. Un
   usuario recién dado de alta no lo tiene: después de entrar se lo pide. */
function perfilCompleto(p) {
  return !!(p && Number(p.weightKg) > 0 && p.objetivo && p.level);
}

/* Alta del administrador en un dispositivo sin usuarios: es el único alta que
   puede hacer alguien que todavía no entró, y por eso queda como admin. */
function altaAdministrador(ev) {
  ev.preventDefault();
  var name = $('#regName').value.trim();
  var pass = $('#regPass').value;
  var pesoEl = $('#regWeight'), alturaEl = $('#regHeight');
  var peso = pesoEl ? (parseFloat(String(pesoEl.value).replace(',', '.')) || 0) : 0;
  var altura = alturaEl ? (parseFloat(alturaEl.value) || 0) : 0;
  var objetivo = state.pendingObjetivo || 'hipertrofia';
  var nivel = state.pendingNivel || 'Principiante';

  if (name.length < 2) return formError('#regError', 'Escribí un nombre de al menos 2 letras.');
  if (pass.length < 4) return formError('#regError', 'La contraseña necesita al menos 4 caracteres.');
  if (usuarioPorNombre(name)) return formError('#regError', 'Ya existe un usuario con ese nombre.');

  var profile = { name: name, weightKg: peso, heightCm: altura, objetivo: objetivo, level: nivel, days: 3 };
  crearUsuario(name, pass, 'admin', profile).then(function (user) {
    return loadAccount(user.id);
  }).then(function () {
    state.gatePanel = 'login';
    go(perfilCompleto(state.data.profile) ? '#/hoy' : '#/perfil');
    toast('Administrador creado. Ya podés dar de alta a los demás desde Perfil.', 'sign');
  }).catch(function (e) {
    formError('#regError', 'No se pudo crear el usuario: ' + e.message);
  });
}

function login(ev) {
  ev.preventDefault();
  var aviso = $('#loginError');
  if (aviso) aviso.hidden = true;   // cada intento limpia el aviso anterior
  var typed = ($('#loginUser').value || '').trim();
  var pass = String($('#loginPass').value || '').trim();
  if (!typed) return formError('#loginError', 'Escribí tu usuario.');
  var acc = usuarioPorNombre(typed);
  if (!acc) {
    return formError('#loginError', 'En este dispositivo no hay ninguna cuenta con ese nombre. ' +
      'Ojo: la app instalada en el celular guarda sus datos aparte del navegador, así que puede que tu cuenta esté en el otro. ' +
      'Usá «Traer mi cuenta» para pasarla, o pedile el alta al administrador.');
  }
  if (acc.disabled) return formError('#loginError', 'Ese usuario está desactivado. Pedile al administrador que lo habilite.');

  // Las cuentas del formato viejo tenían otra derivación: se aceptan una vez
  // y se actualizan a PBKDF2 sin que el usuario tenga que hacer nada.
  var esVieja = !acc.iterations;
  var verificar = esVieja ? CORE.crypto.verifyLegacy(pass, acc) : CORE.crypto.verifyCredential(pass, acc);

  verificar.then(function (ok) {
    if (!ok) return formError('#loginError', 'Contraseña incorrecta.');
    var actualizar = esVieja
      ? CORE.crypto.newCredential(pass).then(function (c) {
          acc.salt = c.salt; acc.hash = c.hash; acc.iterations = c.iterations;
        })
      : Promise.resolve();
    return actualizar.then(function () {
      acc.lastLogin = new Date().toISOString();
      return CORE.store.saveUser(acc);
    }).then(function () { return loadAccount(acc.id); }).then(function () {
      // Si el perfil físico está sin completar, se lo pide antes de entrenar.
      go(perfilCompleto(state.data.profile) ? '#/hoy' : '#/perfil');
      render();
      if (esVieja) toast('Contraseña actualizada al formato nuevo.', 'sign');
      else if (!perfilCompleto(state.data.profile)) toast('Completá tu perfil para que las cargas se calculen bien.', 'sign');
    });
  }).catch(function (e) {
    formError('#loginError', 'No se pudo validar el acceso: ' + e.message);
  });
}

/* Cambio de contraseña propio. */
function changePassword(ev) {
  ev.preventDefault();
  var a = $('#newPass').value;
  var b = $('#newPass2').value;
  var err = $('#passError');
  err.hidden = true;
  if (a.length < 4) { err.textContent = 'La contraseña necesita al menos 4 caracteres.'; err.hidden = false; return; }
  if (a !== b) { err.textContent = 'Las dos contraseñas no coinciden.'; err.hidden = false; return; }
  CORE.crypto.newCredential(a).then(function (cred) {
    state.account.salt = cred.salt;
    state.account.hash = cred.hash;
    state.account.iterations = cred.iterations;
    return CORE.store.saveUser(state.account);
  }).then(function () {
    $('#passForm').hidden = true;
    $('#newPass').value = '';
    $('#newPass2').value = '';
    toast('Contraseña actualizada. Usala la próxima vez que entres.', 'sign');
  }).catch(function (e) {
    err.textContent = 'No se pudo cambiar: ' + e.message;
    err.hidden = false;
  });
}

function logout() {
  flushSave();
  cerrarSesionLocal().then(function () {
    go('#/acceso');
    toast('Sesión cerrada.');
  });
}

/* Trae a este dispositivo una cuenta creada en otro navegador o teléfono.
   Acepta el enlace completo o solo el código. */
function traerCuenta(ev) {
  ev.preventDefault();
  var bruto = String($('#traerCodigo').value || '').trim();
  var m = /[#&?]?alta=([A-Za-z0-9+/=_%-]+)/.exec(bruto);
  var pack = CORE.packs.unpackAccount(m ? decodeURIComponent(m[1]) : bruto);
  if (!pack) {
    return formError('#traerError', 'Ese código no es válido. Copiá el enlace completo desde Perfil → Usuarios → Enlace.');
  }
  importarPaqueteAlta(pack).then(function (user) {
    state.gatePanel = 'login';
    render();
    var inp = $('#loginUser');
    if (inp) inp.value = user.name;
    toast('Listo. Entrá como ' + user.name + ' con la contraseña de siempre.', 'sign');
  }).catch(function (e) {
    formError('#traerError', 'No se pudo traer la cuenta: ' + e.message);
  });
}

/* Deja el dispositivo en cero: cuentas y entrenamientos de acá. */
function borrarDispositivo(ev) {
  ev.preventDefault();
  if (String($('#resetConfirm').value || '').trim().toUpperCase() !== 'BORRAR') {
    return formError('#resetError', 'Escribí BORRAR (así, con mayúsculas) para confirmar.');
  }
  CORE.store.reset().then(function () {
    state.users = [];
    state.account = null;
    state.data = null;
    state.altaPendiente = null;
    state.gatePanel = 'login';
    return CORE.store.setSessionId(null);
  }).then(function () {
    render();
    toast('Este dispositivo quedó en cero. Ahora podés crear la cuenta del administrador.', 'sign');
  }).catch(function (e) {
    formError('#resetError', 'No se pudo borrar: ' + e.message);
  });
}

function formError(sel, msg) {
  var el = $(sel);
  if (el) { el.textContent = msg; el.hidden = false; }
}

/* ═══ 5. UNIDADES Y CARGA DE DISCOS ═══════════════════════════════════════ */

var LB_PER_KG = 2.2046226218;

function unit() { return (state.data && state.data.prefs.unit) === 'lb' ? 'lb' : 'kg'; }
function toDisplay(kg) { return unit() === 'lb' ? kg * LB_PER_KG : kg; }
function toKg(val) { return unit() === 'lb' ? val / LB_PER_KG : val; }
/* Convierte y redondea a lo que el usuario puede cargar realmente. */
function fmtWeight(kg) {
  var v = toDisplay(Number(kg) || 0);
  var step = unit() === 'lb' ? 5 : 2.5;
  var r = Math.round(v / step) * step;
  return fmtNum(r, r % 1 ? 1 : 0) + ' ' + unit();
}
function weightStep() { return unit() === 'lb' ? 5 : 2.5; }
/* El paso, expresado en kilos, que es como se guarda siempre el peso. */
function weightStepKg() { return unit() === 'lb' ? 5 / LB_PER_KG : 2.5; }

/* Discos por lado. Solo se aplica a ejercicios con barra. */
var PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
var PLATE_CLASS = { 25: '25', 20: '20', 15: '15', 10: '10', 5: '5', 2.5: '25s', 1.25: '125' };
var PLATE_NAME = { 25: '25 kg', 20: '20 kg', 15: '15 kg', 10: '10 kg', 5: '5 kg', 2.5: '2,5 kg', 1.25: '1,25 kg' };

function plateMath(totalKg, barKg) {
  var perSide = (Number(totalKg) - Number(barKg)) / 2;
  if (perSide < -0.001) return { ok: false, reason: 'menos que la barra', perSide: perSide, plates: [], rest: 0 };
  var plates = [], left = perSide;
  for (var i = 0; i < PLATES.length; i++) {
    var p = PLATES[i];
    while (left >= p - 1e-9) { plates.push(p); left -= p; }
  }
  return { ok: true, plates: plates, rest: left, perSide: perSide };
}

function plateRowHtml(plates) {
  return plates.map(function (p) {
    var h = 30 + (p / 25) * 42;
    return '<span class="plate plate--' + PLATE_CLASS[p] + '" style="height:' + Math.round(h) + 'px"></span>';
  }).join('');
}

function plateLoadHtml(exKey, weightKg) {
  var ex = exOf(exKey);
  if (ex.load !== 'barbell') {
    return '<p class="plateload__hint">' + esc(ex.equipment || 'Sin barra') +
      ': no lleva discos. Registrá el peso total del implemento o el peso corporal.</p>';
  }
  return platesBlockHtml(weightKg);
}

/* El panel de discos, calculado a partir de un peso total en kilos. */
function platesBlockHtml(weightKg) {
  if (unit() === 'lb') {
    return '<p class="plateload__hint">Estás trabajando en libras. La calculadora de discos usa kilos y barra olímpica: cambiá la unidad a kg en Perfil para verla.</p>';
  }
  var bar = Number(state.data.prefs.barKg) || 20;
  var m = plateMath(weightKg, bar);
  if (!m.ok) {
    return '<p class="plateload__hint">Con ' + fmtNum(weightKg) + ' kg no se cargan discos: la barra sola pesa ' + bar + ' kg.</p>';
  }
  var list = {};
  m.plates.forEach(function (p) { list[p] = (list[p] || 0) + 1; });
  var items = Object.keys(list).sort(function (a, b) { return b - a; }).map(function (p) {
    return '<span class="plateload__item"><span class="plateload__dot plate--' + PLATE_CLASS[p] + '"></span>' +
      list[p] + ' × ' + PLATE_NAME[p] + '</span>';
  }).join('');

  return '<div class="plateload__bar" aria-hidden="true">' +
      '<span class="plateload__sleeve plateload__sleeve--outer"></span>' +
      plateRowHtml(m.plates) +
      '<span class="plateload__sleeve"></span>' +
      plateRowHtml(m.plates) +
      '<span class="plateload__sleeve plateload__sleeve--outer"></span>' +
    '</div>' +
    (items ? '<p class="plateload__hint">Discos por lado</p><div class="plateload__list">' + items + '</div>' : '<p class="plateload__hint">Barra sin discos: solo el peso de la barra.</p>') +
    '<p class="plateload__sum">Barra ' + bar + ' kg + discos por lado = <b>' + fmtKg(weightKg) + ' kg</b></p>' +
    (m.rest > 0.001 ? '<p class="plateload__hint">Sobran ' + fmtKg(m.rest) + ' kg por lado: no hay disco tan chico en el sistema.</p>' : '');
}

/* ═══ 6. PICTOGRAMAS DE RESPALDO ══════════════════════════════════════════
   Diagramas geométricos del implemento y la trayectoria del movimiento.
   Se muestran cuando no hay microfigura del repositorio (o no hay conexión). */

var CH = '#F4F5F7', SG = '#FFC72C';
var AX = '<line x1="16" y1="104" x2="104" y2="104" stroke="' + CH + '" stroke-width="3" stroke-linecap="round" opacity=".55"/>';

function arrow(x1, y1, x2, y2, color) {
  var c = color || SG;
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M' + (x2 - 7) + ' ' + (y2 + (y2 > y1 ? -9 : 9)) + ' L' + x2 + ' ' + y2 + ' L' + (x2 + 7) + ' ' + (y2 + (y2 > y1 ? -9 : 9)) + '" fill="none" stroke="' + c + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
}
function platePair(y, cx, half) {
  cx = cx || 60;
  return '<rect x="' + (cx - half - 5) + '" y="' + (y - 11) + '" width="6" height="22" rx="1.5" fill="' + CH + '"/>' +
    '<rect x="' + (cx + half - 1) + '" y="' + (y - 11) + '" width="6" height="22" rx="1.5" fill="' + CH + '"/>' +
    '<line x1="' + (cx - half - 5) + '" y1="' + y + '" x2="' + (cx + half + 5) + '" y2="' + y + '" stroke="' + CH + '" stroke-width="3" stroke-linecap="round"/>';
}
function dashed(y, cx, half) {
  return '<line x1="' + (cx - half) + '" y1="' + y + '" x2="' + (cx + half) + '" y2="' + y + '" stroke="' + CH + '" stroke-width="2" stroke-dasharray="5 6" opacity=".45"/>';
}

var PICTO = {
  horizontal_push: function () {
    return AX + '<line x1="22" y1="78" x2="98" y2="78" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="30" y1="78" x2="30" y2="100" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="90" y1="78" x2="90" y2="100" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      dashed(70, 60, 34) + platePair(46, 60, 34) + arrow(84, 58, 84, 30);
  },
  vertical_push: function () {
    return AX + '<line x1="44" y1="76" x2="76" y2="76" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      dashed(64, 60, 34) + platePair(40, 60, 34) + arrow(60, 56, 60, 24);
  },
  horizontal_pull: function () {
    return AX + '<rect x="18" y="30" width="16" height="66" rx="2" fill="none" stroke="' + CH + '" stroke-width="3"/>' +
      '<line x1="18" y1="46" x2="34" y2="46" stroke="' + CH + '" stroke-width="3" opacity=".7"/>' +
      '<line x1="18" y1="60" x2="34" y2="60" stroke="' + CH + '" stroke-width="3" opacity=".7"/>' +
      '<line x1="18" y1="74" x2="34" y2="74" stroke="' + CH + '" stroke-width="3" opacity=".7"/>' +
      '<line x1="90" y1="34" x2="90" y2="92" stroke="' + CH + '" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="40" y1="58" x2="72" y2="58" stroke="' + CH + '" stroke-width="3" stroke-linecap="round"/>' +
      arrow(48, 58, 84, 58);
  },
  vertical_pull: function () {
    return AX + '<line x1="24" y1="24" x2="96" y2="24" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="40" cy="24" r="4" fill="' + CH + '"/><circle cx="80" cy="24" r="4" fill="' + CH + '"/>' +
      '<line x1="60" y1="34" x2="60" y2="60" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="48" y1="76" x2="72" y2="76" stroke="' + CH + '" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="60" y1="76" x2="60" y2="96" stroke="' + CH + '" stroke-width="5" stroke-linecap="round"/>' +
      arrow(60, 74, 60, 38);
  },
  squat: function () {
    return AX + platePair(46, 60, 30) +
      '<line x1="60" y1="60" x2="60" y2="84" stroke="' + CH + '" stroke-width="4" stroke-linecap="round" opacity=".6"/>' +
      arrow(46, 54, 46, 88) + arrow(74, 88, 74, 54);
  },
  hinge: function () {
    return AX + platePair(88, 60, 26) +
      '<path d="M34 86 C34 52 78 48 88 80" fill="none" stroke="' + SG + '" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M88 80 L80 74 M88 80 L82 88" fill="none" stroke="' + SG + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<line x1="34" y1="86" x2="46" y2="86" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>';
  },
  lunge: function () {
    return AX + '<rect x="30" y="62" width="18" height="42" rx="3" fill="none" stroke="' + CH + '" stroke-width="3"/>' +
      '<rect x="70" y="76" width="18" height="28" rx="3" fill="none" stroke="' + CH + '" stroke-width="3"/>' +
      arrow(58, 74, 58, 40) + '<line x1="58" y1="74" x2="58" y2="58" stroke="' + SG + '" stroke-width="4" stroke-linecap="round"/>';
  },
  core: function () {
    return AX + '<line x1="26" y1="80" x2="30" y2="96" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="26" y1="80" x2="92" y2="66" stroke="' + CH + '" stroke-width="6" stroke-linecap="round"/>' +
      '<line x1="92" y1="66" x2="102" y2="80" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      arrow(59, 86, 59, 58);
  },
  arm: function () {
    return AX + '<line x1="40" y1="58" x2="40" y2="92" stroke="' + CH + '" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="40" cy="56" r="5" fill="' + CH + '"/>' +
      '<line x1="40" y1="56" x2="68" y2="40" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M68 40 A30 30 0 0 1 46 74" fill="none" stroke="' + SG + '" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M46 74 L54 70 M46 74 L52 82" fill="none" stroke="' + SG + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="66" y="30" width="6" height="16" rx="1.5" fill="' + CH + '"/><rect x="78" y="30" width="6" height="16" rx="1.5" fill="' + CH + '"/>' +
      '<line x1="64" y1="38" x2="86" y2="38" stroke="' + CH + '" stroke-width="3" stroke-linecap="round"/>';
  },
  calf: function () {
    return AX + '<path d="M28 96 L64 96 L64 74" fill="none" stroke="' + CH + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<line x1="28" y1="96" x2="92" y2="96" stroke="' + CH + '" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="64" cy="74" r="4" fill="' + CH + '"/>' +
      arrow(88, 88, 88, 52);
  },
  cardio: function () {
    return AX + '<path d="M16 66 L38 66 L46 44 L56 88 L64 66 L104 66" fill="none" stroke="' + SG + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="104" cy="66" r="4" fill="' + SG + '"/>';
  },
};

function pictoSvg(pattern) {
  var fn = PICTO[pattern] || PICTO.core;
  return '<svg viewBox="0 0 120 116" role="img" aria-label="Diagrama del movimiento">' + fn() + '</svg>';
}

/* ═══ 6b. PROGRESIÓN, 1RM Y MÚSCULOS ══════════════════════════════════════
   Las ideas de este bloque están inspiradas en openGym (AGPL-3.0) y
   reimplementadas desde cero para esta app: no se copió código suyo.
   Las tres reglas que hacen que esto sea confiable:
     · Todo se DERIVA del historial. No hay contadores guardados que se
       desincronicen: si corregís una serie, la próxima sugerencia cambia.
     · Una serie sin marcar es un fallo. Una sesión que se desarmó nunca sube
       el peso.
     · El 1RM sólo se estima hasta 12 repeticiones. Más arriba las fórmulas
       discrepan decenas de kilos: no decir nada es mejor que inventar.
   ──────────────────────────────────────────────────────────────────────── */

var REP_CAP = 12;      // arriba de esto no se estima 1RM
var FALLOS_PARA_BAJAR = 3;

/* 1RM estimado (Epley). Devuelve null cuando no puede responder con honestidad. */
function estimate1RM(kg, reps) {
  var w = Number(kg), r = Number(reps);
  if (!isFinite(w) || !isFinite(r) || w <= 0 || r < 1) return null;
  if (r === 1) return Math.round(w * 10) / 10;   // una repetición es medición, no estimación
  if (r > REP_CAP) return null;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

/* Rango de repeticiones de un objetivo textual: '8-10' → {min:8,max:10}; '5' → {5,5}. */
function repRange(target) {
  var nums = String(target == null ? '' : target).match(/\d+(?:[.,]\d+)?/g) || [];
  var vals = nums.map(function (n) { return parseFloat(n.replace(',', '.')); });
  if (!vals.length) return { min: 0, max: 0 };
  return { min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) };
}

/* Paso de carga en kilos (2,5 kg o 5 lb), y el peso siguiente en la grilla. */
function loadStepKg() { return unit() === 'lb' ? 5 / LB_PER_KG : 2.5; }
function addLoadStep(kg) { var st = loadStepKg(); return Math.round((kg + st) / st) * st; }
function deloadLoad(kg) { var st = loadStepKg(); return Math.max(st, Math.round((kg * 0.9) / st) * st); }

/* Historial de un ejercicio, del más viejo al más nuevo: qué pasó en cada sesión.
   Se ordena por la FECHA del entrenamiento, no por cuándo lo registraste: si
   cargás el de ayer después del de hoy, la progresión tiene que leer el de ayer
   como anterior. En fechas iguales manda el orden de carga. */
function exerciseHistory(exKey) {
  var out = [];
  state.data.sessions.slice().reverse().forEach(function (s) {
    var e = null;
    for (var i = 0; i < s.entries.length; i++) if (s.entries[i].ex === exKey) { e = s.entries[i]; break; }
    if (!e) return;
    var hechas = e.sets.filter(function (x) { return x.done; });
    if (!hechas.length) return;
    var range = repRange(e.sets[0].target);
    var reps = hechas.map(function (x) { return Number(x.reps) || 0; });
    var pesos = hechas.map(function (x) { return Number(x.weight) || 0; });
    out.push({
      date: s.date,
      weight: Math.max.apply(null, pesos),
      reps: reps,
      low: Math.min.apply(null, reps),
      goal: range.max,
      planned: e.sets.length,
      completo: hechas.length >= e.sets.length,
      ok: hechas.length >= e.sets.length && reps.every(function (r) { return range.min > 0 && r >= range.min; }),
      tope: range.max > 0 && reps.every(function (r) { return r >= range.max; }),
    });
  });
  out.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  return out;
}

/* Sesiones seguidas sin completar, contando desde la última. Un cambio de peso
   corta la racha: los fallos con otro peso no cuentan para bajar este. */
function fallosSeguidos(hist) {
  var n = 0;
  for (var i = hist.length - 1; i >= 0; i--) {
    if (hist[i].ok) break;
    if (i < hist.length - 1 && hist[i].weight !== hist[i + 1].weight) break;
    n++;
  }
  return n;
}

/* Qué política le toca a un ejercicio: la de la rutina si la trae, y si no la del
   objetivo. Fuerza sube peso al completar; hipertrofia y el resto trepan reps primero. */
function policyFor(item, objetivo) {
  if (item && item.prog) return item.prog;
  if (!state.data.prefs.prog) return 'off';
  return objetivo === 'fuerza' ? 'linear' : 'double';
}

/* Qué peso y qué reps te tocan hoy, y por qué. Devuelve siempre un motivo legible. */
function prescriptionFor(exKey, item, objetivo) {
  var base = Number(item && item.w) || 0;
  var policy = policyFor(item, objetivo);
  var hist = exerciseHistory(exKey);
  var range = repRange(item && item.reps);
  var step = loadStepKg();

  if (policy === 'off') {
    return { policy: 'off', kind: 'off', weight: base, step: step,
      why: 'Progresión desactivada: queda el peso de la rutina.' };
  }
  if (!hist.length) {
    return { policy: policy, kind: 'first', weight: base, step: step,
      why: 'Primera vez con este ejercicio: arrancás con ' + fmtWeight(base) + '.' };
  }

  var last = hist[hist.length - 1];
  var w = last.weight > 0 ? last.weight : base;

  // Sin carga externa (flexiones, plancha): se progresa en repeticiones, no en kilos.
  if (w <= 0) {
    var meta = range.max || last.goal || 10;
    if (last.ok && last.tope) {
      return { policy: policy, kind: 'up', weight: 0, reps: meta + 1, step: 0,
        why: 'Completaste ' + meta + ' repeticiones en todas las series: hoy andá por ' + (meta + 1) + '.' };
    }
    return { policy: policy, kind: 'hold', weight: 0, reps: meta, step: 0,
      why: 'Sin carga: repetí ' + meta + ' repeticiones por serie hasta completarlas todas.' };
  }

  if (policy === 'linear') {
    if (last.ok) {
      return { policy: policy, kind: 'up', weight: addLoadStep(w), reps: range.min || last.goal, step: step,
        why: 'Completaste ' + (range.max || last.goal) + ' repeticiones en todas las series con ' + fmtWeight(w) +
             ': hoy sube ' + fmtWeight(step) + '.' };
    }
    var fallos = fallosSeguidos(hist);
    if (fallos >= FALLOS_PARA_BAJAR) {
      var abajo = deloadLoad(w);
      return { policy: policy, kind: 'deload', weight: abajo, reps: range.min || last.goal, step: step,
        why: fallos + ' sesiones sin completar: bajá a ' + fmtWeight(abajo) + ' y volvé a subir de a ' + fmtWeight(step) + '.' };
    }
    return { policy: policy, kind: 'hold', weight: w, reps: range.min || last.goal, step: step,
      why: 'No completaste todas las series con ' + fmtWeight(w) + ' (te faltan ' + (FALLOS_PARA_BAJAR - fallos) + ' para bajar): hoy repetís ese peso.' };
  }

  // Doble progresión: primero trepás repeticiones, y recién con el tope del rango sube el peso.
  if (last.tope) {
    return { policy: policy, kind: 'up', weight: addLoadStep(w), reps: range.min || last.goal, step: step,
      why: 'Llegaste a ' + range.max + ' repeticiones en todas las series: hoy sube ' + fmtWeight(step) +
           ' y volvés a ' + (range.min || last.goal) + '.' };
  }
  var aim = Math.min(range.max || last.goal || 10, Math.max(range.min || 1, last.low + 1));
  return { policy: policy, kind: 'hold', weight: w, reps: aim, step: step,
    why: 'Mismo peso (' + fmtWeight(w) + '): hoy apuntá a ' + aim + ' repeticiones por serie.' };
}

/* Mejor 1RM estimado de un ejercicio, con la serie que lo produjo. */
function best1RMOf(exKey) {
  var best = null;
  state.data.sessions.forEach(function (s) {
    s.entries.forEach(function (e) {
      if (e.ex !== exKey) return;
      e.sets.forEach(function (st) {
        if (!st.done) return;
        var est = estimate1RM(st.weight, st.reps);
        if (est != null && (!best || est > best.est)) {
          best = { est: est, weight: Number(st.weight) || 0, reps: Number(st.reps) || 0, date: s.date };
        }
      });
    });
  });
  return best;
}

/* Serie temporal del 1RM estimado, una por sesión con datos. */
function strengthSeries(exKey) {
  var pts = [];
  state.data.sessions.slice().reverse().forEach(function (s) {
    var best = null;
    s.entries.forEach(function (e) {
      if (e.ex !== exKey) return;
      e.sets.forEach(function (st) {
        if (!st.done) return;
        var est = estimate1RM(st.weight, st.reps);
        if (est != null && (!best || est > best)) best = est;
      });
    });
    if (best != null) pts.push({ date: s.date, value: best });
  });
  pts.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  return pts;
}

/* Ejercicios con suficiente historial como para mostrar una curva. */
function strengthExercises() {
  var seen = {};
  state.data.sessions.forEach(function (s) {
    s.entries.forEach(function (e) {
      var any = e.sets.some(function (x) { return x.done && Number(x.weight) > 0 && Number(x.reps) >= 1; });
      if (any) seen[e.ex] = { key: e.ex, name: e.name, n: (seen[e.ex] ? seen[e.ex].n : 0) + 1 };
    });
  });
  return Object.keys(seen).map(function (k) { return seen[k]; }).sort(function (a, b) { return b.n - a.n; });
}

/* Volumen y recuperación por grupo muscular. La recuperación es una estimación
   simple y explicable: entre 24 y 60 horas, según cuán dura fue la última sesión
   de ese músculo comparada con la más dura que registraste. */
function muscleStats(days) {
  var since = Date.now() - (days || 7) * 86400000;
  var map = {};
  state.data.sessions.forEach(function (s) {
    var t = new Date(s.date + 'T12:00:00').getTime();
    s.entries.forEach(function (e) {
      var m = e.muscle || 'Otros';
      var vol = 0, hizo = false;
      e.sets.forEach(function (x) {
        if (!x.done) return;
        hizo = true;
        vol += (Number(x.weight) || 0) * (Number(x.reps) || 0);
      });
      if (!hizo) return;
      var r = map[m] || (map[m] = { muscle: m, volume: 0, last: 0, lastVolume: 0, maxVolume: 0, veces: 0 });
      r.veces++;
      if (t >= since) r.volume += vol;
      if (t > r.last) { r.last = t; r.lastVolume = vol; }
      if (vol > r.maxVolume) r.maxVolume = vol;
    });
  });
  var now = Date.now();
  return Object.keys(map).map(function (m) {
    var r = map[m];
    r.hours = (now - r.last) / 3600000;
    var intensidad = r.maxVolume > 0 ? Math.min(1, r.lastVolume / r.maxVolume) : 0.5;
    r.needed = 24 + 36 * intensidad;
    r.state = r.hours >= r.needed ? 'listo' : 'recuperando';
    return r;
  }).sort(function (a, b) { return b.volume - a.volume; });
}

/* ── Pantalla encendida durante el entrenamiento ─────────────────────────
   El navegador suelta el bloqueo al ocultarse la pestaña, así que se vuelve a
   pedir al volver. Si no hay soporte o se rechaza, no pasa nada. */
var Wake = {
  lock: null,
  sync: function () {
    var quiere = !!(state.data && state.data.activeSession && state.data.prefs.wake &&
      navigator.wakeLock && navigator.wakeLock.request);
    if (quiere && !this.lock) {
      navigator.wakeLock.request('screen').then(function (l) {
        Wake.lock = l;
        l.addEventListener('release', function () { Wake.lock = null; });
      }).catch(function () { /* sin soporte, sin foco o rechazado: no es crítico */ });
    } else if (!quiere && this.lock) {
      try { this.lock.release(); } catch (e) { /* ya liberado */ }
      this.lock = null;
    }
  },
};

/* ═══ 7. CRONÓMETRO DE DESCANSO ═══════════════════════════════════════════ */

var Rest = {
  timer: null, endsAt: 0, total: 0, running: false,
  start: function (seconds) {
    seconds = clamp(Math.round(seconds || 90), 5, 900);
    this.total = seconds;
    this.endsAt = Date.now() + seconds * 1000;
    this.running = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(function () { Rest.tick(); }, 200);
    this.tick();
  },
  add: function (seconds) {
    if (!this.running) { this.start(seconds); return; }
    this.endsAt += seconds * 1000;
    this.total += seconds;
    this.tick();
  },
  skip: function () {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    toast('Descanso salteado.');
    updateBand();
    render();
  },
  stop: function () {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    updateBand();
  },
  tick: function () {
    if (!this.running) return;
    var left = (this.endsAt - Date.now()) / 1000;
    if (left <= 0) {
      this.running = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      announceRestOver();
      updateBand();
      return;
    }
    var clock = $('#clockValue'), bar = $('#restProgress').firstElementChild;
    if (clock) clock.textContent = fmtClock(left);
    if (bar) bar.style.transform = 'scaleX(' + clamp(left / this.total, 0, 1) + ')';
  },
};

/* ═══ 7b. SONIDO, VIBRACIÓN Y AVISOS ══════════════════════════════════════
   La alarma tiene que escucharse por encima de la música y sentirse en el
   bolsillo. Los tonos salen por el canal de medios (Web Audio), así que suenan
   junto con lo que estés escuchando; además vibra y, si la app quedó en
   segundo plano, aparece un aviso del sistema. El audio necesita un toque del
   usuario para arrancar: se desbloquea con el primero. */

var Sound = {
  ctx: null,
  desbloquear: function () {
    if (!state.data || !state.data.prefs.sound) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!Sound.ctx) { try { Sound.ctx = new AC(); } catch (e) { return null; } }
    if (Sound.ctx.state === 'suspended') { try { Sound.ctx.resume(); } catch (e) {} }
    return Sound.ctx;
  },
  tono: function (freq, dur, espera, vol) {
    var ctx = Sound.ctx;
    if (!ctx || !dur) return;
    try {
      var t0 = ctx.currentTime + (espera || 0);
      var osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    } catch (e) { /* si el audio falla, quedan la vibración y el aviso */ }
  },
  /* Tres ráfagas de dos tonos agudos: se distinguen de la música y de un mensaje. */
  alarma: function () {
    Sound.desbloquear();
    for (var i = 0; i < 3; i++) {
      Sound.tono(1046, 0.16, i * 0.5, 0.34);
      Sound.tono(1568, 0.16, i * 0.5 + 0.2, 0.34);
    }
  },
  corto: function () {
    Sound.desbloquear();
    Sound.tono(880, 0.12, 0, 0.22);
    Sound.tono(1180, 0.14, 0.16, 0.22);
  },
  prueba: function () {
    Sound.alarma();
    toast('Si escuchaste tres ráfagas agudas, la alarma suena bien.', 'sign');
  },
};

function vibrar(patron) {
  if (!state.data || !state.data.prefs.vibrate || !navigator.vibrate) return;
  try { navigator.vibrate(patron); } catch (e) {}
}

var Avisos = {
  soportado: function () { return typeof Notification !== 'undefined'; },
  permiso: function () { return Avisos.soportado() ? Notification.permission : 'no-soportado'; },
  pedir: function () {
    if (!Avisos.soportado()) {
      toast('Este navegador no permite avisos del sistema. La alarma igual suena.', 'error');
      return Promise.resolve('no-soportado');
    }
    return Notification.requestPermission().then(function (p) {
      render();
      toast(p === 'granted'
        ? 'Avisos activados: te avisa aunque estés en otra app.'
        : 'Quedaron sin permiso. La alarma igual suena con la app abierta.', p === 'granted' ? 'sign' : 'error');
      return p;
    }).catch(function () { return 'error'; });
  },
  /* Aviso del sistema al terminar el cronómetro, solo si la app no está a la vista. */
  fin: function (titulo, cuerpo) {
    if (!Avisos.soportado() || Avisos.permiso() !== 'granted' || !document.hidden) return;
    var op = { body: cuerpo, tag: 'hierro-cronometro', renotify: true, requireInteraction: true, vibrate: [400, 150, 400, 150, 600] };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg.showNotification) reg.showNotification(titulo, op);
        }).catch(function () {});
      } else {
        new Notification(titulo, op);
      }
    } catch (e) { /* sin aviso del sistema: quedan sonido y vibración */ }
  },
};

/* Se desbloquea el audio con el primer gesto: sin eso, los navegadores móviles
   no dejan sonar nada. */
['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
  window.addEventListener(ev, function () { Sound.desbloquear(); }, { once: true, passive: true });
});

/* ── Cronómetro por ejercicio ─────────────────────────────────────────────
   Se da Start y termina solo. El final se calcula con hora real, no con
   temporizadores, así que si el teléfono bloquea o cierra la app, al volver el
   fin se detecta igual y avisa. */

var EjTimer = {
  _iv: null,
  datos: function () {
    var s = state.data && state.data.activeSession;
    return s ? (s.timer || null) : null;
  },
  segundos: function (e) {
    return clamp(Math.round(Number(e && e.time) || Number(state.data.prefs.timerSec) || 90), 5, 3600);
  },
  asignar: function (entryIdx, seg) {
    var s = state.data && state.data.activeSession;
    if (!s || !s.entries[entryIdx]) return;
    s.entries[entryIdx].time = clamp(Math.round(seg), 5, 3600);
    saveData(); render();
  },
  iniciar: function (entryIdx) {
    var s = state.data && state.data.activeSession;
    if (!s || !s.entries[entryIdx]) return;
    var e = s.entries[entryIdx];
    var total = EjTimer.segundos(e);
    s.timer = {
      entryIndex: entryIdx, nombre: e.name, totalSec: total,
      startedAt: Date.now(), endsAt: Date.now() + total * 1000, running: true, fired: false,
    };
    saveData();
    EjTimer.latir();
    render();
    toast('Cronómetro de ' + fmtSeg(total) + ' andando. Al llegar a cero te avisa.', 'sign');
  },
  pausar: function () {
    var t = EjTimer.datos();
    if (!t || !t.running) return;
    t.restante = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
    t.running = false;
    EjTimer.pararLatido();
    saveData(); render();
  },
  reanudar: function () {
    var t = EjTimer.datos();
    if (!t) return;
    var seg = t.restante != null ? t.restante : EjTimer.segundos(state.data.activeSession.entries[t.entryIndex]);
    t.endsAt = Date.now() + seg * 1000;
    t.running = true;
    t.fired = false;
    saveData();
    EjTimer.latir();
    render();
  },
  detener: function () {
    var s = state.data && state.data.activeSession;
    if (!s) return;
    s.timer = null;
    EjTimer.pararLatido();
    saveData(); render();
    toast('Cronómetro detenido.');
  },
  latir: function () {
    EjTimer.pararLatido();
    EjTimer._iv = setInterval(function () { EjTimer.tick(); }, 250);
    EjTimer.tick();
  },
  pararLatido: function () { if (EjTimer._iv) clearInterval(EjTimer._iv); EjTimer._iv = null; },
  restante: function () {
    var t = EjTimer.datos();
    if (!t) return 0;
    if (!t.running) return t.restante != null ? t.restante : t.totalSec;
    return Math.max(0, (t.endsAt - Date.now()) / 1000);
  },
  tick: function () {
    var t = EjTimer.datos();
    if (!t) { EjTimer.pararLatido(); return; }
    if (t.running && Date.now() >= t.endsAt) { EjTimer.terminar(); return; }
    // Solo se refrescan los números: no se reconstruye la pantalla cuatro veces por segundo.
    var caja = document.getElementById('ejtimer');
    if (caja) caja.textContent = fmtClock(EjTimer.restante());
    // La banda de abajo también sigue la cuenta cuando no hay descanso corriendo.
    if (!Rest.running) {
      var reloj = document.getElementById('clockValue');
      if (reloj) reloj.textContent = fmtClock(EjTimer.restante());
    }
  },
  terminar: function () {
    var t = EjTimer.datos();
    if (!t) return;
    t.running = false; t.fired = true; t.restante = 0;
    EjTimer.pararLatido();
    saveData();
    Sound.alarma();
    vibrar([0, 200, 120, 200, 120, 400]);
    Avisos.fin('¡Fin del ejercicio!', t.nombre + ': llegaste a ' + fmtSeg(t.totalSec) + '.');
    render();
    toast('¡FIN! ' + t.nombre + ': ' + fmtSeg(t.totalSec) + '.', 'sign');
  },
  /* Al abrir la app: si el reloj pasó mientras estaba cerrada, avisa igual. */
  recuperar: function () {
    var t = EjTimer.datos();
    if (!t) return;
    if (t.running && Date.now() >= t.endsAt) { EjTimer.terminar(); return; }
    if (t.running) EjTimer.latir();
  },
};

function beep() { Sound.corto(); }

function announceRestOver() {
  beep();
  vibrar([120, 70, 120]);
  var next = state.data && state.data.activeSession ? firstPending(state.data.activeSession) : null;
  toast(next ? 'Descanso listo. ' + next.ex.name + ', serie ' + (next.set + 1) + '.' : 'Descanso terminado.', 'sign');
  var band = $('#nextband');
  if (band) { band.classList.remove('is-rolling'); void band.offsetWidth; band.classList.add('is-rolling'); }
}

function toast(msg, kind) {
  var box = $('#toasts');
  if (!box) return;
  var el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast--' + kind : '');
  el.innerHTML = (kind === 'sign' ? '<i class="fa-solid fa-check"></i>' : kind === 'error' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '') +
    '<span>' + esc(msg) + '</span>';
  box.appendChild(el);
  setTimeout(function () { el.remove(); }, kind === 'sign' ? 4200 : 3000);
}

/* ═══ 8. VISTAS ═══════════════════════════════════════════════════════════ */

/* ── Plataforma: instrucciones de instalación según el dispositivo ─────── */
function esIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function esAndroid() { return /Android/i.test(navigator.userAgent); }
function enModoApp() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;
}
function textoInstalar() {
  if (esIOS()) {
    return '<b>Para tenerla como app en el iPhone o iPad:</b> tocá Compartir (el cuadro con la flecha hacia arriba), ' +
      'bajá en la lista y elegí «Añadir a pantalla de inicio». Se abre a pantalla completa, sin barra del navegador.';
  }
  if (esAndroid()) {
    return '<b>Para tenerla como app en Android:</b> abrí el menú del navegador (los tres puntos) y elegí ' +
      '«Instalar aplicación» o «Agregar a pantalla de inicio».';
  }
  return '<b>Para instalarla en esta computadora:</b> en Chrome o Edge, usá el icono de instalar de la barra ' +
    'de direcciones, o el botón de la barra superior de la app.';
}

/* ── 8.1 Acceso ───────────────────────────────────────────────────────────
   Lo primero que se ve es SIEMPRE el ingreso: usuario y contraseña. El alta del
   administrador es solo un enlace para la primera vez en un dispositivo, no la
   pantalla principal. Y también se puede entrar aceptando un enlace de alta. */

function viewGate() {
  var hasUsers = state.users.length > 0;
  var altaAdmin = state.gatePanel === 'alta-admin';

  var band = '<div class="gate__band"><i class="fa-solid fa-dumbbell"></i><span>Tu progreso queda en este dispositivo</span></div>';
  var cabeza = '<div>' +
    '<h1 class="gate__word">HIERRO</h1>' +
    '<p class="gate__claim">Registrá cada serie en tres toques. La app te dice qué discos cargar en cada lado de la barra.</p>' +
  '</div>';

  /* Enlace de alta recibido desde otro dispositivo. */
  if (state.altaPendiente) {
    var p = state.altaPendiente;
    var yaEsta = !!usuarioPorNombre(p.name);
    return '<div class="gate">' + cabeza + band +
      '<div class="gate__panel">' +
        '<h2 class="gate__h2">' + (yaEsta ? 'Ese usuario ya existe en este dispositivo' : 'Agregar esta cuenta') + '</h2>' +
        '<p class="gate__note">Usuario <b>' + esc(p.name) + '</b>' + (p.role === 'admin' ? ' · administrador' : '') + '.</p>' +
        '<p class="gate__note">La contraseña te la da quien te dio de alta: no viaja en este enlace.</p>' +
        '<div style="display:grid;gap:9px;margin-top:14px">' +
          '<button class="btn btn--sign btn--block" data-act="alta-aceptar">' +
            '<i class="fa-solid fa-user-check"></i> ' + (yaEsta ? 'Actualizar la credencial' : 'Agregar la cuenta') + '</button>' +
          '<button class="btn btn--ghost btn--block" data-act="alta-cancelar">Cancelar</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Traer una cuenta que vive en el otro lado: en el celular la app instalada
     guarda sus datos aparte del navegador, así que la misma cuenta puede estar
     en uno y no en el otro. */
  var traerPanel =
    '<form class="form" data-form="traer">' +
      '<h2 class="gate__h2">Traer mi cuenta</h2>' +
      '<p class="gate__note">Copiá el <b>código de acceso</b> desde el navegador o la app donde ya entrás ' +
        '(Perfil → Usuarios → <b>Enlace</b>) y pegalo acá. Tu usuario queda en este dispositivo con la misma ' +
        'contraseña de siempre.</p>' +
      '<div class="field"><label class="field__label" for="traerCodigo">Código o enlace</label>' +
        '<textarea class="input" id="traerCodigo" rows="3" autocomplete="off" placeholder="Pegá acá el enlace completo"></textarea>' +
        '<span class="field__hint">Podés pegar el enlace entero: la app saca el código sola.</span></div>' +
      '<p class="alert alert--error" id="traerError" hidden></p>' +
      '<button class="btn btn--sign btn--block" type="submit"><i class="fa-solid fa-download"></i> Traer la cuenta</button>' +
      '<button class="btn btn--ghost btn--block" type="button" data-act="gate-traer" data-value="volver">Volver al ingreso</button>' +
      '<p class="gate__note">El código lleva tu usuario y tu clave cifrada, nunca la contraseña en claro.</p>' +
    '</form>';

  /* Última salida para un dispositivo con datos viejos o una cuenta cuya clave
     no se recuerda: dejarlo en cero y empezar de nuevo. */
  var resetPanel =
    '<form class="form" data-form="reset-dispositivo">' +
      '<h2 class="gate__h2">Empezar de cero acá</h2>' +
      '<p class="alert alert--error">Se borran <b>todas las cuentas y todos los entrenamientos</b> guardados en ' +
        '<b>este dispositivo</b>. Lo que esté en el navegador o en otro teléfono no se toca.</p>' +
      '<p class="gate__note">Si podés entrar desde el otro lado, exportá antes una copia: Perfil → ' +
        '<b>Respaldo completo del dispositivo</b>.</p>' +
      '<div class="field"><label class="field__label" for="resetConfirm">Escribí BORRAR para confirmar</label>' +
        '<input class="input" id="resetConfirm" autocomplete="off" placeholder="BORRAR"></div>' +
      '<p class="alert alert--error" id="resetError" hidden></p>' +
      '<button class="btn btn--sign btn--block" type="submit"><i class="fa-solid fa-trash"></i> Borrar todo de este dispositivo</button>' +
      '<button class="btn btn--ghost btn--block" type="button" data-act="gate-reset" data-value="volver">Cancelar</button>' +
    '</form>';

  var loginPanel =
    '<form class="form" data-form="login" id="panelLogin">' +
      '<h2 class="gate__h2">Entrar</h2>' +
      '<div class="field">' +
        '<label class="field__label" for="loginUser">Usuario</label>' +
        '<input class="input" id="loginUser" list="loginUsuarios" autocomplete="username" placeholder="Tu usuario">' +
        '<datalist id="loginUsuarios">' +
          state.users.filter(function (u) { return !u.disabled; }).map(function (u) { return '<option value="' + esc(u.name) + '"></option>'; }).join('') +
        '</datalist>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label" for="loginPass">Contraseña</label>' +
        '<input class="input" id="loginPass" type="password" autocomplete="current-password" required>' +
      '</div>' +
      '<p class="alert alert--error" id="loginError" hidden></p>' +
      '<button class="btn btn--sign btn--block" type="submit"><i class="fa-solid fa-arrow-right-to-bracket"></i> Entrar</button>' +
      '<p class="gate__note">Las cuentas las da de alta el administrador. Si te pasó un enlace de alta, abrilo en este navegador.</p>' +
      '<p class="gate__note">Esta app guarda todo <b>aparte del navegador</b> cuando la instalás en el celular. ' +
        'Si tu cuenta quedó en el otro lado, <button type="button" class="link-btn" data-act="gate-traer">traé tu cuenta acá</button>.</p>' +
      (hasUsers
        ? ''
        : '<p class="gate__note">Este dispositivo todavía no tiene ninguna cuenta. ' +
          '<button type="button" class="link-btn" data-act="gate-alta-admin">Crear la cuenta del administrador</button>.</p>') +
      '<p class="gate__note">Las cuentas y los entrenamientos viven en este dispositivo. No se envían a ningún servidor.</p>' +
    '</form>';

  var objetivos = Object.keys(RT.objetivos).map(function (o) {
    var sel = (state.pendingObjetivo || 'hipertrofia') === o;
    return '<button type="button" class="choice__opt" data-act="pick-objetivo" data-value="' + o + '" aria-pressed="' + sel + '">' +
      '<span class="choice__mark"></span><span><span class="choice__name">' + esc(RT.objetivos[o].label) + '</span>' +
      '<span class="choice__desc">' + esc(RT.objetivos[o].desc) + '</span></span></button>';
  }).join('');

  var niveles = ['Principiante', 'Intermedio', 'Avanzado'].map(function (n) {
    var sel = (state.pendingNivel || 'Principiante') === n;
    return '<button type="button" class="choice__opt" data-act="pick-nivel" data-value="' + n + '" aria-pressed="' + sel + '">' +
      '<span class="choice__mark"></span><span class="choice__name">' + n + '</span></button>';
  }).join('');

  var altaAdminPanel =
    '<form class="form" data-form="alta-admin">' +
      '<h2 class="gate__h2">Cuenta del administrador</h2>' +
      '<p class="gate__note">Solo la primera vez en este dispositivo. Después vas a entrar siempre desde la pantalla de ingreso, ' +
        'y desde esta cuenta vas a dar de alta a los demás.</p>' +
      '<div class="field"><label class="field__label" for="regName">Usuario</label>' +
        '<input class="input" id="regName" autocomplete="username" required></div>' +
      '<div class="field"><label class="field__label" for="regPass">Contraseña</label>' +
        '<input class="input" id="regPass" type="password" autocomplete="new-password" required>' +
        '<span class="field__hint">Mínimo 4 caracteres. Se guarda cifrada con PBKDF2 y sal propia: la contraseña en claro no se almacena.</span></div>' +
      '<div class="field"><span class="field__label" id="lblObjetivo">Objetivo principal</span><div class="choice" role="group" aria-labelledby="lblObjetivo">' + objetivos + '</div></div>' +
      '<div class="field"><span class="field__label" id="lblNivel">Experiencia</span><div class="choice" role="group" aria-labelledby="lblNivel">' + niveles + '</div></div>' +
      '<p class="alert alert--error" id="regError" hidden></p>' +
      '<button class="btn btn--sign btn--block" type="submit"><i class="fa-solid fa-user-shield"></i> Crear administrador</button>' +
      '<button class="btn btn--ghost btn--block" type="button" data-act="gate-alta-admin" data-value="volver">Volver al ingreso</button>' +
    '</form>';

  var panel = loginPanel;
  if (state.gatePanel === 'traer') panel = traerPanel;
  else if (state.gatePanel === 'reset') panel = resetPanel;
  else if (altaAdmin && !hasUsers) panel = altaAdminPanel;

  return '<div class="gate">' + cabeza + band +
    '<div class="gate__panel">' + panel + '</div>' +
    '<p class="gate__note" style="text-align:center">' +
      (state.gatePanel === 'login'
        ? '<button type="button" class="link-btn" data-act="gate-traer">Traer mi cuenta de otro navegador</button> · ' +
          '<button type="button" class="link-btn" data-act="gate-reset">Empezar de cero en este dispositivo</button>'
        : '') +
    '</p>' +
    (enModoApp() ? '' : '<div class="alert">' + textoInstalar() + '</div>') +
  '</div>';
}

/* ── 8.2 Hoy ──────────────────────────────────────────────────────────── */

function viewToday() {
  var d = state.data, p = d.profile;
  var s = d.activeSession;
  var r = suggestedRoutine();
  var board, head;

  if (s) {
    var st = sessionStats(s);
    head = '<div class="view__head"><div><h1 class="view__title">Sesión en curso</h1>' +
      '<p class="view__sub">' + esc(s.routineName) + ' · empezó ' + new Date(s.startedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + '</p></div></div>';
    board = '<div class="board">' +
      rowBig('Progreso de hoy', st.percent + '<small>%</small>') +
      '<div class="board__row" style="display:block"><div class="progress"><span style="transform:scaleX(' + (st.percent / 100) + ')"></span></div></div>' +
      row('Series completadas', st.doneSets + ' <small>de ' + st.totalSets + '</small>') +
      row('Ejercicios empezados', st.exercisesDone + ' <small>de ' + st.exercises + '</small>') +
      row('Volumen levantado', fmtNum(toDisplay(st.volume)) + ' <small>' + unit() + '</small>') +
    '</div>' +
    '<div style="display:grid;gap:9px;margin-top:14px">' +
      '<button class="btn btn--sign btn--block" data-act="go" data-go="#/entrenar"><i class="fa-solid fa-dumbbell"></i> Continuar entrenamiento</button>' +
      '<button class="btn btn--block" data-act="finish"><i class="fa-solid fa-flag-checkered"></i> Terminar y guardar</button>' +
    '</div>' +
    '<div class="section"><div class="section__head"><h2 class="section__title">En esta sesión</h2>' +
      '<span class="section__note">' + s.entries.length + ' ejercicios</span></div>' +
      '<div class="rows">' + s.entries.map(function (e) {
        var hechas = e.sets.filter(function (x) { return x.done; }).length;
        var completa = hechas === e.sets.length;
        var icono = completa ? 'fa-check' : (hechas ? 'fa-circle-half-stroke' : 'fa-regular fa-circle');
        return '<div class="row-link"><span class="row-link__icon" style="color:' + (completa ? 'var(--sign)' : 'var(--chalk-faint)') + '">' +
          '<i class="fa-solid ' + icono + '"></i></span>' +
          '<span class="row-link__text"><span class="row-link__name">' + esc(e.name) + '</span>' +
          '<span class="row-link__desc">' + hechas + ' de ' + e.sets.length + ' series</span></span></div>';
      }).join('') + '</div></div>';
  } else {
    var week = weekStrip();
    head = '<div class="view__head"><div><h1 class="view__title">Hola, ' + esc(p.name.split(' ')[0]) + '</h1>' +
      '<p class="view__sub">' + esc(fmtDayLong(todayISO())) + ' · objetivo: ' + esc(objetivoLabel(p.objetivo)) + '</p></div></div>';
    var last = d.sessions[0];
    board = '<div class="board">' +
      row('Ejercicios programados', r ? r.items.length + ' <small>en ' + esc(r.name) + '</small>' : '0') +
      row('Volumen de la última sesión', last ? fmtNum(toDisplay(sessionStats(last).volume)) + ' <small>' + unit() + '</small>' : '—') +
      row('Sesiones registradas', d.sessions.length + ' <small>en total</small>') +
      row('Racha', streak() + ' <small>' + (streak() === 1 ? 'día seguido' : 'días seguidos') + '</small>') +
    '</div>' +
    '<div class="section"><div class="section__head"><h2 class="section__title">Últimos 7 días</h2></div>' + week + '</div>';
  }

  var routineBlock = '';
  if (!s && r) {
    routineBlock = '<div class="section">' +
      '<div class="section__head"><h2 class="section__title">Rutina sugerida</h2><span class="section__note">' + esc(r.days) + '</span></div>' +
      routineCard(r, true) +
      '<div style="display:grid;gap:9px;margin-top:10px">' +
        '<button class="btn btn--sign btn--block" data-act="start" data-routine="' + r.key + '"><i class="fa-solid fa-play"></i> Empezar ' + esc(r.name) + '</button>' +
        '<button class="btn btn--ghost btn--block" data-act="go" data-go="#/entrenar">Ver las ' + RT.routines.length + ' rutinas</button>' +
      '</div>' +
    '</div>';
  }

  return head + board + routineBlock;
}

function row(label, value) {
  return '<div class="board__row"><span class="board__label">' + label + '</span><span class="board__value">' + value + '</span></div>';
}
function rowBig(label, value) {
  return '<div class="board__row board__row--big"><span class="board__label">' + label + '</span><span class="metric__value">' + value + '</span></div>';
}

function trainedDates() {
  var set = {};
  state.data.sessions.forEach(function (s) { set[s.date] = true; });
  return set;
}
function weekStrip() {
  var trained = trainedDates();
  var out = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var iso = todayISO(d);
    var on = !!trained[iso];
    out.push('<div class="weekstrip__day' + (on ? ' is-trained' : '') + '">' +
      (on ? '<i class="fa-solid fa-check"></i>' : '') +
      '</div><div class="weekstrip__label">' + ['D', 'L', 'M', 'M', 'J', 'V', 'S'][d.getDay()] + '</div>');
  }
  return '<div class="weekstrip">' + out.join('') + '</div>';
}
function streak() {
  var trained = trainedDates(), n = 0, d = new Date();
  if (!trained[todayISO(d)]) d.setDate(d.getDate() - 1);
  while (trained[todayISO(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function routineCard(r, highlight) {
  /* Cada ejercicio con su carga sugerida: se ve antes de empezar de dónde sale
     cada número, que es lo que hace confiable a la progresión. */
  var lineas = r.items.map(function (it) {
    var ex = exOf(it.ex);
    var presc = prescriptionFor(it.ex, it, r.objetivo[0]);
    var carga = presc.weight > 0 ? fmtWeight(presc.weight) : 'corporal';
    return '<span class="routine__line">' +
      '<span class="routine__ex">' + esc(ex.name) + '</span>' +
      '<span class="routine__sets">' + it.sets + ' × ' + esc(it.reps) + '</span>' +
      '<span class="routine__load">' + esc(carga) + '</span>' +
    '</span>';
  }).join('');
  return '<button class="routine" data-act="start" data-routine="' + r.key + '">' +
    '<span class="routine__head' + (highlight ? ' routine__head--sign' : '') + '">' +
      '<span style="min-width:0"><span class="routine__name">' + esc(r.name) + '</span>' +
      '<span class="routine__meta">' + esc(r.level) + ' · ' + esc(r.duration) + '</span></span>' +
      '<span class="routine__count">' + r.items.length + '</span>' +
    '</span>' +
    '<span class="routine__body">' +
      '<span class="routine__hint">' + (state.data.prefs.prog ? 'Carga sugerida por tu historial' : 'Carga de la rutina') + '</span>' +
      lineas +
      '<span class="routine__note">' + esc(r.note) + '</span>' +
    '</span>' +
  '</button>';
}

/* ── 8.3 Entrenar ─────────────────────────────────────────────────────── */

function viewTrain() {
  var s = state.data.activeSession;
  if (!s) return routinePicker();
  var st = sessionStats(s);
  var html = '<div class="view__head"><div>' +
    '<h1 class="view__title">' + esc(s.routineName) + '</h1>' +
    '<p class="view__sub">' + st.exercises + ' ejercicios · ' + st.doneSets + ' de ' + st.totalSets + ' series · ' +
      fmtNum(toDisplay(st.volume)) + ' ' + unit() + ' de volumen</p>' +
    '</div></div>' +
    '<div class="progress" style="margin-bottom:14px"><span style="transform:scaleX(' + (st.percent / 100) + ')"></span></div>' +

    /* El día se puede corregir: si entrenaste ayer y lo registrás hoy, la fecha manda. */
    '<div class="datebar">' +
      '<div class="field">' +
        '<label class="field__label" for="sessDate">Día de este entrenamiento</label>' +
        '<input class="input" type="date" id="sessDate" data-act="sess-date" value="' + esc(s.date) + '" max="' + todayISO() + '">' +
      '</div>' +
      '<p class="gate__note">' + (s.date === todayISO() ? 'Es de hoy.' : 'Lo estás registrando como ' + esc(fmtDayLong(s.date)) + '.') + '</p>' +
    '</div>';

  s.entries.forEach(function (e, i) { html += unitCard(e, i); });

  html += '<div style="display:grid;gap:9px;margin-top:16px">' +
    '<button class="btn btn--block" data-act="open-picker"><i class="fa-solid fa-plus"></i> Agregar otro ejercicio</button>' +
    '<button class="btn btn--sign btn--block" data-act="finish"><i class="fa-solid fa-flag-checkered"></i> Terminar y guardar</button>' +
    '<button class="btn btn--ghost btn--block" data-act="discard">Descartar sesión</button>' +
  '</div>';
  return html;
}

/* ── Grupos musculares y armado del día ───────────────────────────────────
   El catálogo se puede mirar y armar por grupo muscular. El orden, los nombres
   y cuántos ejercicios se sugieren por grupo salen de data/exercises.js. */

function gruposOrden() {
  var definidos = (DB.meta && DB.meta.grupos) || [];
  var presentes = [];
  DB.exercises.forEach(function (ex) { if (presentes.indexOf(ex.muscle) === -1) presentes.push(ex.muscle); });
  var orden = definidos.filter(function (g) { return presentes.indexOf(g) !== -1; });
  presentes.forEach(function (g) { if (orden.indexOf(g) === -1) orden.push(g); });
  return orden;
}
function ejerciciosDeGrupo(grupo) {
  return DB.exercises.filter(function (ex) { return ex.muscle === grupo; });
}
function porGrupoSugeridos() { return Number((DB.meta || {}).porGrupo) || 3; }

/* Borrador del día: qué grupos elegiste y con qué ejercicios. Se guarda con el
   resto de los datos, así no se pierde si cerrás la app mientras lo armás. */
function borrador() {
  var d = state.data;
  if (!d.borrador || typeof d.borrador !== 'object') d.borrador = { grupos: [], ejercicios: [] };
  if (!Array.isArray(d.borrador.grupos)) d.borrador.grupos = [];
  if (!Array.isArray(d.borrador.ejercicios)) d.borrador.ejercicios = [];
  return d.borrador;
}

/* Elegir un grupo trae sus primeros ejercicios (los principales del grupo) y
   destildarlo los saca. Después se agrega y se quita uno por uno. */
function alternarGrupo(grupo) {
  var b = borrador();
  var i = b.grupos.indexOf(grupo);
  if (i === -1) {
    b.grupos.push(grupo);
    ejerciciosDeGrupo(grupo).slice(0, porGrupoSugeridos()).forEach(function (ex) {
      if (b.ejercicios.indexOf(ex.key) === -1) b.ejercicios.push(ex.key);
    });
  } else {
    b.grupos.splice(i, 1);
    ejerciciosDeGrupo(grupo).forEach(function (ex) {
      var k = b.ejercicios.indexOf(ex.key);
      if (k !== -1) b.ejercicios.splice(k, 1);
    });
  }
  saveData(); render();
}

function alternarEjercicioDelDia(key) {
  var b = borrador();
  var i = b.ejercicios.indexOf(key);
  var ex = exOf(key);
  if (i === -1) {
    b.ejercicios.push(key);
    if (ex && b.grupos.indexOf(ex.muscle) === -1) b.grupos.push(ex.muscle);
  } else {
    b.ejercicios.splice(i, 1);
    // Si ya no queda ninguno de ese grupo, el grupo deja de estar elegido.
    if (ex && !b.ejercicios.some(function (k) { var e2 = exOf(k); return e2 && e2.muscle === ex.muscle; })) {
      var g = b.grupos.indexOf(ex.muscle);
      if (g !== -1) b.grupos.splice(g, 1);
    }
  }
  saveData(); render();
}

function limpiarBorrador() {
  state.data.borrador = { grupos: [], ejercicios: [] };
  saveData(); render();
  toast('Selección limpia.');
}

/* Arma la sesión con lo elegido: es el "hoy entreno estos grupos". */
function empezarDesdeBorrador() {
  var b = borrador();
  if (!b.ejercicios.length) { toast('Elegí al menos un ejercicio.'); return; }
  if (state.data.activeSession && !confirm('Tenés una sesión sin terminar. ¿Empezar una nueva y descartar la anterior?')) return;
  var fecha = /^\d{4}-\d{2}-\d{2}$/.test(state.newSessionDate) ? state.newSessionDate : todayISO();
  if (fecha > todayISO()) fecha = todayISO();
  var nombre = b.grupos.length ? b.grupos.join(' + ') : 'Personalizada';
  var objetivo = state.data.profile.objetivo;
  var session = {
    id: uid(), routineKey: 'armada', routineName: 'Día de ' + nombre, objetivo: objetivo,
    date: fecha, startedAt: Date.now(), finishedAt: null,
    entries: b.ejercicios.map(function (k) { return newEntry(k, objetivo); }),
    armada: { grupos: b.grupos.slice(), ejercicios: b.ejercicios.slice() },
  };
  state.data.activeSession = session;
  state.data.lastRoutine = null;
  saveData();
  go('#/entrenar');
  render();
  toast(session.entries.length + ' ejercicios listos. ¡A entrenar!', 'sign');
}

/* Armador del día: elegís grupos y la app propone los ejercicios de esos grupos. */
function builderHtml() {
  var b = borrador();
  var grupos = gruposOrden();
  var objetivo = state.data.profile.objetivo;

  var chips = grupos.map(function (g) {
    var elegidos = b.ejercicios.filter(function (k) { var ex = exOf(k); return ex && ex.muscle === g; }).length;
    return '<button class="chip chip--grupo" data-act="toggle-grupo" data-value="' + esc(g) + '" aria-pressed="' + (b.grupos.indexOf(g) !== -1) + '">' +
      esc(g) + '<span class="chip__count">' + elegidos + '/' + ejerciciosDeGrupo(g).length + '</span></button>';
  }).join('');

  var bloques = grupos.filter(function (g) { return b.grupos.indexOf(g) !== -1; }).map(function (g) {
    var filas = ejerciciosDeGrupo(g).map(function (ex) {
      var elegido = b.ejercicios.indexOf(ex.key) !== -1;
      var presc = prescriptionFor(ex.key, { w: routineDefaultWeight(ex.key) }, objetivo);
      var carga = presc.weight > 0 ? fmtWeight(presc.weight) : (ex.load === 'body' ? 'corporal' : '—');
      return '<button class="pick' + (elegido ? ' is-on' : '') + '" data-act="toggle-ejercicio" data-ex="' + esc(ex.key) + '" aria-pressed="' + elegido + '">' +
        '<span class="pick__mark"><i class="fa-solid ' + (elegido ? 'fa-check' : 'fa-plus') + '" aria-hidden="true"></i></span>' +
        '<span class="pick__text">' +
          '<span class="pick__name">' + esc(ex.name) + '</span>' +
          '<span class="pick__meta">' + esc(ex.equipment || '') + ' · ' + (ex.defaultSets || 3) + ' × ' + esc(ex.defaultReps || '10') + '</span>' +
        '</span>' +
        '<span class="pick__load">' + esc(carga) + '</span>' +
      '</button>';
    }).join('');
    return '<section class="board"><div class="board__head">' +
        '<h2 class="board__title">' + esc(g) + '</h2>' +
        '<span class="board__note">' + ejerciciosDeGrupo(g).length + ' en el catálogo</span>' +
      '</div>' + filas + '</section>';
  }).join('');

  var resumen = b.ejercicios.length
    ? '<div class="builder-bar">' +
        '<span class="builder-bar__info"><b>' + b.ejercicios.length + '</b> ejercicios · ' + b.grupos.length +
          ' grupo' + (b.grupos.length === 1 ? '' : 's') + '</span>' +
        '<button class="btn btn--sign" data-act="start-builder"><i class="fa-solid fa-play" aria-hidden="true"></i> Empezar</button>' +
      '</div>'
    : '';

  return '<div class="filters filters--grupos">' + chips + '</div>' +
    (b.grupos.length
      ? bloques
      : '<div class="alert">Elegí uno o más <b>grupos musculares</b> y la app te arma el día con los ejercicios de esos grupos. ' +
        'Después sacás y agregás los que quieras: la lista es tuya.</div>') +
    (b.ejercicios.length
      ? '<div class="rows" style="margin-top:12px"><button class="row-link" data-act="clear-builder">' +
          '<span class="row-link__icon"><i class="fa-solid fa-eraser" aria-hidden="true"></i></span>' +
          '<span class="row-link__text"><span class="row-link__name">Limpiar la selección</span>' +
          '<span class="row-link__desc">Volver a empezar con los grupos</span></span></button></div>'
      : '') +
    resumen;
}

function routinePicker() {
  // Se recuerda cómo elegiste la última vez: si armás por grupo muscular, seguís ahí.
  var modo = (state.pickerMode || state.data.prefs.pickerMode) === 'rutinas' ? 'rutinas' : 'grupos';

  var head = '<div class="view__head"><div>' +
      '<h1 class="view__title">' + (modo === 'grupos' ? 'Armá tu día' : 'Elegí tu rutina') + '</h1>' +
      '<p class="view__sub">' + (modo === 'grupos'
        ? 'Elegí qué grupos musculares entrenás hoy: la app te arma la lista con sus ejercicios.'
        : 'Rutinas ya armadas, ordenadas por objetivo y nivel.') + '</p>' +
    '</div></div>' +

    '<div class="filters" style="margin-bottom:10px">' +
      '<button class="chip" data-act="picker-mode" data-value="grupos" aria-pressed="' + (modo === 'grupos') + '">' +
        '<i class="fa-solid fa-layer-group" aria-hidden="true"></i> Por grupo muscular</button>' +
      '<button class="chip" data-act="picker-mode" data-value="rutinas" aria-pressed="' + (modo === 'rutinas') + '">' +
        '<i class="fa-solid fa-list-check" aria-hidden="true"></i> Rutinas listas</button>' +
    '</div>' +

    /* El día se elige: podés registrar el entrenamiento de ayer sin inventar nada. */
    '<div class="datebar">' +
      '<div class="field">' +
        '<label class="field__label" for="sessionDate">Día del entrenamiento</label>' +
        '<input class="input" type="date" id="sessionDate" data-act="session-date" value="' + esc(state.newSessionDate) + '" max="' + todayISO() + '">' +
      '</div>' +
      '<div class="filters" style="margin:0">' +
        '<button class="chip" data-act="set-date" data-value="' + todayISO() + '" aria-pressed="' + (state.newSessionDate === todayISO()) + '">Hoy</button>' +
        '<button class="chip" data-act="set-date" data-value="' + isoDaysAgo(1) + '" aria-pressed="' + (state.newSessionDate === isoDaysAgo(1)) + '">Ayer</button>' +
        '<button class="chip" data-act="set-date" data-value="' + isoDaysAgo(2) + '" aria-pressed="' + (state.newSessionDate === isoDaysAgo(2)) + '">Anteayer</button>' +
      '</div>' +
    '</div>';

  if (modo === 'grupos') return head + builderHtml();

  var todas = state.filter === 'todas';
  var obj = todas ? '' : (state.filter || state.data.profile.objetivo);
  var chips = Object.keys(RT.objetivos).map(function (o) {
    return '<button class="chip" data-act="filter" data-value="' + o + '" aria-pressed="' + (!todas && obj === o) + '">' + esc(RT.objetivos[o].label) + '</button>';
  }).join('') + '<button class="chip" data-act="filter" data-value="" aria-pressed="' + todas + '">Todas</button>';
  var list = routinesFor(obj).map(function (r) { return routineCard(r, false); }).join('');

  return head +
    '<div class="filters">' + chips + '</div>' +
    '<p class="view__sub" style="margin:-2px 0 12px">' + esc((RT.objetivos[obj] && RT.objetivos[obj].desc) || 'Todas las rutinas disponibles.') + '</p>' +
    list;
}

/* Cronómetro del ejercicio, dentro de la tarjeta. Se da Start y termina solo:
   al llegar a cero suena, vibra y avisa. */
function timerHtml(e, i) {
  var t = EjTimer.datos();
  var mio = !!t && t.entryIndex === i;
  var corriendo = mio && t.running;
  var pausado = mio && !t.running && !t.fired;
  var terminado = mio && t.fired;
  var configurado = mio ? t.totalSec : EjTimer.segundos(e);
  var mostrar = corriendo ? EjTimer.restante() : (mio && t.restante != null ? t.restante : configurado);

  var cabeza = '<div class="ejtimer__head">' +
    '<span class="ejtimer__label"><i class="fa-solid fa-stopwatch" aria-hidden="true"></i> Cronómetro</span>' +
    ((corriendo || pausado || terminado)
      ? '<span class="ejtimer__time' + (terminado ? ' is-fin' : '') + '" id="ejtimer">' + (terminado ? 'FIN' : fmtClock(mostrar)) + '</span>'
      : '<span class="ejtimer__conf">' + fmtSeg(configurado) + '</span>') +
  '</div>';

  var cuerpo;
  if (corriendo) {
    cuerpo = '<div class="ejtimer__actions">' +
      '<button class="btn btn--sm btn--ghost" data-act="timer-pause" data-entry="' + i + '">' +
        '<i class="fa-solid fa-pause" aria-hidden="true"></i> Pausar</button>' +
      '<button class="btn btn--sm btn--ghost" data-act="timer-stop" data-entry="' + i + '">Detener</button>' +
    '</div>';
  } else if (pausado) {
    cuerpo = '<div class="ejtimer__actions">' +
      '<button class="btn btn--sm btn--sign" data-act="timer-resume" data-entry="' + i + '">' +
        '<i class="fa-solid fa-play" aria-hidden="true"></i> Seguir</button>' +
      '<button class="btn btn--sm btn--ghost" data-act="timer-stop" data-entry="' + i + '">Detener</button>' +
    '</div>';
  } else if (terminado) {
    cuerpo = '<p class="ejtimer__fin">Listo: ' + esc(t.nombre) + ' llegó a ' + fmtSeg(t.totalSec) + '.</p>' +
      '<div class="ejtimer__actions">' +
      '<button class="btn btn--sm btn--sign" data-act="timer-restart" data-entry="' + i + '">' +
        '<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Otra vez</button>' +
      '<button class="btn btn--sm btn--ghost" data-act="timer-stop" data-entry="' + i + '">Cerrar</button>' +
    '</div>';
  } else {
    var opciones = [30, 60, 90, 120, 300].map(function (s) {
      return '<button class="chip chip--mini" data-act="timer-set" data-entry="' + i + '" data-seg="' + s + '" aria-pressed="' + (configurado === s) + '">' +
        fmtSeg(s) + '</button>';
    }).join('');
    cuerpo = '<div class="ejtimer__chips">' + opciones +
        '<input class="input input--mini" data-act="timer-libre" data-entry="' + i + '" inputmode="numeric" ' +
          'placeholder="seg" aria-label="Segundos del cronómetro de ' + esc(e.name) + '">' +
      '</div>' +
      '<button class="btn btn--block" data-act="timer-start" data-entry="' + i + '">' +
        '<i class="fa-solid fa-play" aria-hidden="true"></i> Start ' + fmtSeg(configurado) + '</button>';
  }

  return '<div class="ejtimer' + (corriendo ? ' is-on' : '') + (terminado ? ' is-done' : '') + '">' + cabeza + cuerpo + '</div>';
}

function unitCard(e, i) {
  var ex = exOf(e.ex);
  var done = e.sets.every(function (x) { return x.done; });
  var current = !done && e.sets.some(function (x) { return !x.done; });
  var rows = e.sets.map(function (st, j) { return setRow(e, i, st, j); }).join('');
  var hasFigure = !!e.img;
  var picto = hasFigure
    ? '<img src="' + esc(imgUrl(e.img, 0)) + '" alt="" loading="lazy" data-figure-frame data-ex="' + i + '">'
    : pictoSvg(e.pattern);
  // Contadores en vivo: series hechas y volumen del ejercicio, como en una planilla.
  var hechas = 0, vol = 0;
  e.sets.forEach(function (x) {
    if (!x.done) return;
    hechas++;
    vol += (Number(x.weight) || 0) * (Number(x.reps) || 0);
  });

  return '<section class="unit' + (current ? ' is-active' : '') + (done ? ' is-done' : '') + '">' +
    '<div class="unit__head">' +
      '<button class="unit__picto" data-act="sheet" data-entry="' + i + '" aria-label="Ver la técnica de ' + esc(e.name) + '">' + picto + '</button>' +
      '<div class="unit__id">' +
        '<h2 class="unit__name">' + esc(e.name) + '</h2>' +
        '<div class="unit__meta">' +
          '<span class="unit__muscle">' + esc(e.muscle) + '</span>' +
          '<span class="unit__summary">' + hechas + '/' + e.sets.length + ' series · ' + esc(e.sets[0].target) +
            ' · ' + e.rest + ' s' + (vol > 0 ? ' · ' + fmtNum(toDisplay(vol)) + ' ' + unit() : '') + '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    (e.presc && e.presc.why ? '<p class="unit__presc"><i class="fa-solid fa-arrow-trend-up" aria-hidden="true"></i> ' + esc(e.presc.why) + '</p>' : '') +
    timerHtml(e, i) +
    '<div class="sets">' + rows + '</div>' +
    '<div class="unit__foot">' +
      '<button class="btn btn--sm btn--ghost" data-act="del-exercise" data-entry="' + i + '">' +
        '<i class="fa-solid fa-trash" aria-hidden="true"></i> Quitar ejercicio</button>' +
      '<span class="unit__foot-set">' +
        '<button class="btn btn--sm btn--ghost" data-act="equalize" data-entry="' + i + '" title="Copiar la primera serie a todas">' +
          '<i class="fa-solid fa-equals" aria-hidden="true"></i> Igualar</button>' +
        '<button class="btn btn--sm" data-act="add-set" data-entry="' + i + '">' +
          '<i class="fa-solid fa-plus" aria-hidden="true"></i> Serie</button>' +
        '<button class="btn btn--sm btn--ghost" data-act="del-set" data-entry="' + i + '"' + (e.sets.length < 2 ? ' disabled' : '') + ' aria-label="Quitar la última serie">' +
          '<i class="fa-solid fa-minus" aria-hidden="true"></i></button>' +
      '</span>' +
    '</div>' +
    (e.load === 'barbell' ? '<div class="plateload" id="plates-' + i + '">' + plateLoadHtml(e.ex, activeWeight(e)) + '</div>' : '') +
  '</section>';
}

/* Peso sobre el que se calculan los discos: la primera serie sin completar. */
function activeWeight(e) {
  for (var j = 0; j < e.sets.length; j++) if (!e.sets[j].done) return e.sets[j].weight;
  return e.sets[0] ? e.sets[0].weight : 0;
}

function setRow(e, entryIdx, st, setIdx) {
  var u = e.unit === 'reps' ? 'reps' : repUnitLabel(e.unit, st.reps);
  var pend = firstPending(state.data.activeSession);
  var isCurrent = !st.done && pend && pend.entry === entryIdx && pend.set === setIdx;
  // "Objetivo vs. real": si la serie quedó por debajo del objetivo, el número se marca.
  var objetivoNum = firstNumber(st.target);
  var below = st.done && objetivoNum > 0 && Number(st.reps) < objetivoNum;
  return '<div class="setrow' + (st.done ? ' is-done' : '') + (isCurrent ? ' is-current' : '') + (below ? ' is-below' : '') + '">' +
    '<span class="disc">' + (st.done ? '<i class="fa-solid fa-check"></i>' : (setIdx + 1)) + '</span>' +
    '<div class="setrow__fields">' +
      '<span class="stepper stepper--reps">' +
        '<button class="stepper__btn" data-act="rep-dec" data-entry="' + entryIdx + '" data-set="' + setIdx + '" aria-label="Menos repeticiones"><i class="fa-solid fa-minus"></i></button>' +
        '<input class="stepper__value" data-act="rep-input" data-entry="' + entryIdx + '" data-set="' + setIdx + '" inputmode="numeric" value="' + st.reps + '" aria-label="' + esc(e.name) + ', repeticiones serie ' + (setIdx + 1) + '">' +
        '<button class="stepper__btn" data-act="rep-inc" data-entry="' + entryIdx + '" data-set="' + setIdx + '" aria-label="Más repeticiones"><i class="fa-solid fa-plus"></i></button>' +
        (e.unit === 'reps' ? '' : '<span class="stepper__unit">' + u + '</span>') +
      '</span>' +
      '<span class="setrow__obj" title="Objetivo de esta serie: ' + esc(st.target) + '">/' + esc(st.target) + '</span>' +
      '<span class="stepper stepper--load">' +
        '<button class="stepper__btn" data-act="w-dec" data-entry="' + entryIdx + '" data-set="' + setIdx + '" aria-label="Bajar peso"><i class="fa-solid fa-minus"></i></button>' +
        '<input class="stepper__value" data-act="w-input" data-entry="' + entryIdx + '" data-set="' + setIdx + '" inputmode="decimal" value="' + fmtInputWeight(st.weight) + '" aria-label="' + esc(e.name) + ', peso serie ' + (setIdx + 1) + '">' +
        '<button class="stepper__btn" data-act="w-inc" data-entry="' + entryIdx + '" data-set="' + setIdx + '" aria-label="Subir peso"><i class="fa-solid fa-plus"></i></button>' +
        '<span class="stepper__unit">' + unit() + '</span>' +
      '</span>' +
      (st.pr ? '<span class="tag tag--record">récord</span>' : '') +
    '</div>' +
    '<button class="check" data-act="set-toggle" data-entry="' + entryIdx + '" data-set="' + setIdx + '" aria-pressed="' + st.done + '" aria-label="Marcar serie ' + (setIdx + 1) + ' de ' + esc(e.name) + ' como completada">' +
      '<i class="fa-solid fa-check"></i></button>' +
  '</div>';
}
function fmtInputWeight(kg) {
  var v = toDisplay(Number(kg) || 0);
  var r = Math.round(v * 100) / 100;
  return String(r).replace('.', ',');
}

/* ── 8.4 Historial y progreso ─────────────────────────────────────────── */

function viewHistory() {
  var d = state.data;
  var totalVol = d.sessions.reduce(function (a, s) { return a + sessionStats(s).volume; }, 0);
  var prKeys = Object.keys(d.prs);

  var head = '<div class="view__head"><div><h1 class="view__title">Progreso</h1>' +
    '<p class="view__sub">' + (d.sessions.length ? 'Tu historial completo, guardado en este dispositivo.' : 'Todavía no hay sesiones guardadas.') + '</p></div></div>';

  if (!d.sessions.length) {
    return head + '<div class="empty"><p class="empty__title">Sin sesiones todavía</p>' +
      '<p>Cuando termines tu primer entrenamiento vas a ver acá el volumen, los récords y la evolución.</p>' +
      '<button class="btn btn--sign" data-act="go" data-go="#/entrenar">Elegir una rutina</button></div>';
  }

  var board = '<div class="board">' +
    row('Sesiones', d.sessions.length + ' <small>guardadas</small>') +
    row('Volumen acumulado', fmtNum(toDisplay(totalVol)) + ' <small>' + unit() + '</small>') +
    row('Racha actual', streak() + ' <small>' + (streak() === 1 ? 'día' : 'días') + '</small>') +
    row('Récords registrados', prKeys.length + ' <small>ejercicios</small>') +
  '</div>';

  var last12 = d.sessions.slice(0, 12).reverse();
  var chart = '<div class="section"><div class="section__head"><h2 class="section__title">Volumen por sesión</h2><span class="section__note">últimas ' + last12.length + '</span></div>' +
    barChart(last12.map(function (s) { return toDisplay(sessionStats(s).volume); }), last12.map(function (s) { return fmtDayShort(s.date); })) + '</div>';

  var bw = d.bodyweight.slice(-14);
  var bwBlock = '';
  if (bw.length >= 2) {
    bwBlock = '<div class="section"><div class="section__head"><h2 class="section__title">Peso corporal</h2>' +
      '<span class="section__note">de ' + fmtNum(toDisplay(bw[0].kg), 1) + ' a ' + fmtNum(toDisplay(bw[bw.length - 1].kg), 1) + ' ' + unit() + '</span></div>' +
      lineChart(bw.map(function (p) { return toDisplay(p.kg); }), bw.map(function (p) { return fmtDayShort(p.date); })) + '</div>';
  }

  var prBlock = '';
  if (prKeys.length) {
    prBlock = '<div class="section"><div class="section__head"><h2 class="section__title">Récords personales</h2></div><div class="rows">' +
      prKeys.map(function (k) {
        var pr = d.prs[k];
        return '<div class="pr"><div><div class="pr__name">' + esc(pr.name || exOf(k).name) + '</div>' +
          '<div class="pr__meta">' + esc(fmtDayLong(pr.date)) + '</div></div>' +
          '<div class="pr__load">' + fmtWeight(pr.weightKg) + ' × ' + pr.reps + '</div></div>';
      }).join('') + '</div></div>';
  }

  /* ── Músculos: volumen de la semana y en qué anda la recuperación ────── */
  var muscles = muscleStats(7);
  var muscleBlock = '';
  if (muscles.length) {
    var maxVol = Math.max.apply(null, muscles.map(function (m) { return m.volume; }).concat([1]));
    muscleBlock = '<div class="section"><div class="section__head"><h2 class="section__title">Músculos</h2>' +
      '<span class="section__note">volumen de los últimos 7 días</span></div>' +
      muscles.map(function (m) {
        var resto = m.state === 'recuperando' ? Math.max(0, Math.round(m.needed - m.hours)) : 0;
        return '<div class="muscle">' +
          '<div class="muscle__top">' +
            '<span class="muscle__name">' + esc(m.muscle) + '</span>' +
            '<span class="muscle__vol">' + (m.volume > 0 ? fmtNum(toDisplay(m.volume)) + ' <small>' + unit() + '</small>' : '—') + '</span>' +
          '</div>' +
          '<div class="progress"><span style="transform:scaleX(' + (m.volume / maxVol) + ')"></span></div>' +
          '<div class="muscle__foot">' +
            '<span class="tag ' + (m.state === 'listo' ? 'tag--live' : 'tag--off') + '">' + m.state + '</span>' +
            '<span>' + haceCuanto(m.hours) + (resto ? ' · faltan ~' + resto + ' h' : ' · ya podés volver') + '</span>' +
          '</div>' +
        '</div>';
      }).join('') +
      '<p class="gate__note" style="margin-top:10px">La recuperación es una estimación: 24 a 60 horas según cuán dura fue la última sesión de ese músculo comparada con la más dura que registraste.</p>' +
    '</div>';
  }

  /* ── Fuerza: 1RM estimado y su evolución por ejercicio ───────────────── */
  var strength = strengthExercises();
  var strengthBlock = '';
  if (strength.length) {
    var elegido = state.strengthEx && strength.some(function (x) { return x.key === state.strengthEx; })
      ? state.strengthEx : strength[0].key;
    var serie = strengthSeries(elegido);
    var mejor = best1RMOf(elegido);
    strengthBlock = '<div class="section"><div class="section__head"><h2 class="section__title">Fuerza estimada</h2>' +
      '<span class="section__note">1RM estimado</span></div>' +
      '<div class="field" style="margin-bottom:10px">' +
        '<label class="field__label" for="strengthEx">Ejercicio</label>' +
        '<select class="select" id="strengthEx" data-act="strength-ex">' +
          strength.map(function (x) {
            return '<option value="' + esc(x.key) + '"' + (x.key === elegido ? ' selected' : '') + '>' + esc(x.name) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      (serie.length >= 2 ? lineChart(serie.map(function (p) { return toDisplay(p.value); }), []) : '') +
      (mejor ? '<div class="board" style="margin-top:10px">' +
        row('Mejor estimado', fmtNum(toDisplay(mejor.est), 1) + ' <small>' + unit() + '</small>') +
        row('Salió de', fmtWeight(mejor.weight) + ' × ' + mejor.reps + ' <small>' + esc(fmtDayShort(mejor.date)) + '</small>') +
      '</div>' : '') +
      (serie.length < 2 ? '<p class="gate__note">Hacen falta dos sesiones o más con peso y repeticiones para dibujar la evolución.</p>' : '') +
      '<p class="gate__note" style="margin-top:8px">Es una estimación, no una medición: se calcula con series de hasta ' +
        REP_CAP + ' repeticiones. Más arriba no se estima, porque las fórmulas dejan de coincidir.</p>' +
    '</div>';
  }

  var list = '<div class="section"><div class="section__head"><h2 class="section__title">Sesiones</h2></div>' +
    d.sessions.map(function (s, i) { return sessionRow(s, i); }).join('') + '</div>';

  return head + board + chart + muscleBlock + strengthBlock + bwBlock + prBlock + list;
}

function sessionRow(s, i) {
  var st = sessionStats(s);
  var mins = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : 0;
  var detail = s.entries.map(function (e) {
    var sets = e.sets.filter(function (x) { return x.done; });
    return '<div class="session__ex"><b>' + esc(e.name) + '</b><span>' +
      sets.map(function (x) { return x.reps + '×' + fmtInputWeight(x.weight); }).join(' · ') +
      (sets.length ? '' : '<em style="color:var(--chalk-faint)">sin series marcadas</em>') + '</span></div>';
  }).join('');
  return '<div class="session">' +
    '<button class="session__head" data-act="toggle-session" data-idx="' + i + '" aria-expanded="false">' +
      '<span><span class="session__date">' + esc(fmtDayLong(s.date)) + '</span>' +
      '<span class="session__meta">' + esc(s.routineName) + ' · ' + st.doneSets + ' series' + (mins ? ' · ' + mins + ' min' : '') + '</span></span>' +
      '<span class="session__vol">' + fmtNum(toDisplay(st.volume)) + '<small>' + unit() + ' volumen</small></span>' +
    '</button>' +
    '<div class="session__body" hidden>' + detail +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:4px">' +
        '<span class="session__meta">' + (st.percent === 100 ? 'Completa' : st.percent + '% de las series') + '</span>' +
        '<button class="btn btn--danger btn--sm" data-act="del-session" data-idx="' + i + '">Borrar</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* Gráfico de barras en SVG puro (sin librerías). */
function barChart(values, labels) {
  var W = 600, H = 200, padL = 8, padR = 8, padT = 30, padB = 34;
  var max = Math.max.apply(null, values.concat([1]));
  var n = values.length || 1;
  var slot = (W - padL - padR) / n;
  var bw = Math.max(6, slot * 0.58);
  var bars = values.map(function (v, i) {
    var h = v / max * (H - padT - padB);
    var x = padL + slot * i + (slot - bw) / 2;
    return '<rect class="' + (v > 0 ? 'chart__bar' : 'chart__bar--empty') + '" x="' + x.toFixed(1) + '" y="' + (H - padB - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(2, h).toFixed(1) + '" rx="2"></rect>' +
      (labels[i] && (n <= 8 || i % 2 === 0) ? '<text class="chart__label" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(labels[i]) + '</text>' : '');
  }).join('');
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Volumen por sesión">' +
    bars + '<line class="chart__axis" x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '"></line>' +
    '<text class="chart__label" x="' + padL + '" y="' + (padT - 8) + '">máx ' + fmtNum(max) + ' ' + unit() + '</text>' +
  '</svg>';
}

function lineChart(values, labels) {
  var W = 600, H = 190, pad = 34;
  var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  if (max === min) { max = min + 1; }
  var step = values.length > 1 ? (W - pad * 2) / (values.length - 1) : 0;
  var pts = values.map(function (v, i) {
    return [pad + step * i, H - pad - (v - min) / (max - min) * (H - pad * 2)];
  });
  var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evolución del peso corporal">' +
    '<line class="chart__axis" x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '"></line>' +
    '<path class="chart__line" d="' + d + '"></path>' +
    pts.map(function (p) { return '<circle class="chart__dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5"></circle>'; }).join('') +
    '<text class="chart__label" x="' + pad + '" y="' + (pad - 12) + '">' + fmtNum(max, 1) + ' ' + unit() + '</text>' +
    '<text class="chart__label" x="' + pad + '" y="' + (H - 6) + '">' + fmtNum(min, 1) + ' ' + unit() + '</text>' +
  '</svg>';
}

/* ── 8.5 Perfil ───────────────────────────────────────────────────────── */

/* ── Panel de usuarios (solo administrador) ───────────────────────────────
   El administrador da de alta, restablece contraseñas, desactiva y borra.
   NO puede leer los entrenamientos de nadie: cada documento es de su dueño. */
function usuariosAdminHtml() {
  var filas = state.users.map(function (u) {
    var soyYo = state.account.id === u.id;
    var ultimo = u.lastLogin ? 'último ingreso ' + esc(fmtDayShort(String(u.lastLogin).slice(0, 10))) : 'todavía no entró';
    return '<div class="row-link">' +
      '<span class="row-link__icon"><i class="fa-solid ' + (u.role === 'admin' ? 'fa-user-shield' : 'fa-user') + '"></i></span>' +
      '<span class="row-link__text">' +
        '<span class="row-link__name">' + esc(u.name) + (soyYo ? ' <span class="tag tag--live">vos</span>' : '') + '</span>' +
        '<span class="row-link__desc">' + (u.role === 'admin' ? 'administrador' : 'usuario') +
          (u.disabled ? ' · desactivado' : '') + ' · ' + ultimo + '</span>' +
      '</span>' +
      '<span class="unit__foot-set">' +
        '<button class="btn btn--sm btn--ghost" data-act="u-pass" data-user="' + u.id + '">Contraseña</button>' +
        '<button class="btn btn--sm btn--ghost" data-act="u-enlace" data-user="' + u.id + '">Enlace</button>' +
        (soyYo ? '' : '<button class="btn btn--sm btn--ghost" data-act="u-toggle" data-user="' + u.id + '">' + (u.disabled ? 'Activar' : 'Desactivar') + '</button>') +
        (soyYo ? '' : '<button class="btn btn--sm btn--danger" data-act="u-borrar" data-user="' + u.id + '">Borrar</button>') +
      '</span>' +
    '</div>';
  }).join('');

  var respaldos = state.backups && state.backups.length
    ? state.backups.map(function (b) {
        var cuando = new Date(b.at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return '<div class="row-link">' +
          '<span class="row-link__icon"><i class="fa-solid fa-clock-rotate-left"></i></span>' +
          '<span class="row-link__text"><span class="row-link__name">' + esc(cuando) + '</span>' +
          '<span class="row-link__desc">' + b.users.length + ' usuarios · ' + b.documents.length + ' historiales</span></span>' +
          '<span class="unit__foot-set"><button class="btn btn--sm btn--ghost" data-act="bk-restore" data-bk="' + esc(b.id) + '">Restaurar</button></span>' +
        '</div>';
      }).join('')
    : '<p class="gate__note" style="padding:10px 14px">Todavía no hay respaldos automáticos. Se guarda uno por día al abrir la app.</p>';

  return '<div class="section"><div class="section__head"><h2 class="section__title">Usuarios</h2>' +
      '<span class="section__note">' + state.users.length + ' en este dispositivo</span></div>' +
      '<div class="rows">' + filas + '</div>' +
      '<div class="alert" style="margin-top:10px">Vos das de alta a los usuarios de este dispositivo con su usuario y su contraseña. ' +
        'Cada persona ve solo sus entrenamientos: nadie más puede leerlos, ni siquiera el administrador.' +
        '<br><br><b>Ojo con el celular:</b> la app instalada guarda sus datos aparte del navegador. Si alguien te dice que su usuario no existe ' +
        'desde el atajo del teléfono, generá su <b>Enlace</b> y pegalo en esa pantalla de acceso (o que use «Traer mi cuenta»).</div>' +

      '<form class="form" data-form="nuevo-usuario" style="margin-top:14px">' +
        '<h3 class="gate__h2">Alta de usuario</h3>' +
        '<div class="grid-2">' +
          '<div class="field"><label class="field__label" for="nuNombre">Usuario</label>' +
            '<input class="input" id="nuNombre" autocomplete="off" required></div>' +
          '<div class="field"><label class="field__label" for="nuClave">Contraseña</label>' +
            '<input class="input" id="nuClave" type="text" autocomplete="off" required></div>' +
        '</div>' +
        '<label class="choice__opt"><input type="checkbox" id="nuAdmin" style="width:18px;height:18px;flex:none">' +
          '<span><span class="choice__name">También administrador</span>' +
          '<span class="choice__desc">Va a poder dar de alta a otros usuarios de este dispositivo</span></span></label>' +
        '<p class="alert alert--error" id="nuError" hidden></p>' +
        '<button class="btn btn--sign btn--block" type="submit"><i class="fa-solid fa-user-plus"></i> Dar de alta</button>' +
      '</form>' +

      '<div class="rows" style="margin-top:14px">' +
        '<button class="row-link" data-act="backup-full"><span class="row-link__icon"><i class="fa-solid fa-box-archive"></i></span>' +
          '<span class="row-link__text"><span class="row-link__name">Respaldo completo del dispositivo</span>' +
          '<span class="row-link__desc">Todos los usuarios y todos los historiales, en un JSON</span></span></button>' +
        '<button class="row-link" data-act="restore-full"><span class="row-link__icon"><i class="fa-solid fa-upload"></i></span>' +
          '<span class="row-link__text"><span class="row-link__name">Restaurar respaldo completo</span>' +
          '<span class="row-link__desc">Vuelve atrás usuarios e historiales desde un archivo</span></span></button>' +
      '</div>' +

      '<h3 class="gate__h2" style="margin-top:16px">Respaldos automáticos</h3>' +
      '<div class="rows">' + respaldos + '</div>' +
    '</div>';
}

function viewProfile() {
  var d = state.data, p = d.profile, prefs = d.prefs;
  if (esAdmin() && state.backups === null) cargarBackups();
  var objetivos = Object.keys(RT.objetivos).map(function (o) {
    return '<button type="button" class="chip" data-act="set-objetivo" data-value="' + o + '" aria-pressed="' + (p.objetivo === o) + '">' + esc(RT.objetivos[o].label) + '</button>';
  }).join('');
  var niveles = ['Principiante', 'Intermedio', 'Avanzado'].map(function (n) {
    return '<button type="button" class="chip" data-act="set-nivel" data-value="' + n + '" aria-pressed="' + (p.level === n) + '">' + n + '</button>';
  }).join('');

  return '<div class="view__head"><div><h1 class="view__title">Perfil</h1>' +
    '<p class="view__sub">' + esc(state.account.name) + ' · ' + d.sessions.length + ' sesiones registradas</p></div></div>' +

    /* Un usuario recién dado de alta entra sin perfil físico: sin peso y sin
       objetivo no se pueden calcular cargas ni volúmenes. */
    (perfilCompleto(p) ? '' :
      '<div class="alert alert--sign"><b>Completá tu perfil.</b> Cargá tu peso, tu altura, tu objetivo y tu experiencia. ' +
      'Con eso la app calcula las cargas sugeridas, el volumen y la recuperación de cada músculo.' +
      (p.name ? '' : ' Usuario: <b>' + esc(state.account.name) + '</b>.') + '</div>') +

    '<div class="form">' +
      '<div class="grid-2">' +
        '<div class="field"><label class="field__label" for="pfWeight">Peso actual (' + unit() + ')</label>' +
          '<input class="input" id="pfWeight" inputmode="decimal" value="' + fmtInputWeight(p.weightKg) + '"></div>' +
        '<div class="field"><label class="field__label" for="pfHeight">Altura (cm)</label>' +
          '<input class="input" id="pfHeight" inputmode="numeric" value="' + (p.heightCm || '') + '"></div>' +
      '</div>' +
      '<div class="field"><span class="field__label" id="pfLblObjetivo">Objetivo principal</span><div class="filters" style="margin:0" role="group" aria-labelledby="pfLblObjetivo">' + objetivos + '</div></div>' +
      '<div class="field"><span class="field__label" id="pfLblNivel">Experiencia</span><div class="filters" style="margin:0" role="group" aria-labelledby="pfLblNivel">' + niveles + '</div></div>' +
      '<button class="btn btn--sign btn--block" data-act="log-weight"><i class="fa-solid fa-weight-scale"></i> Guardar peso de hoy en el historial</button>' +
    '</div>' +

    '<div class="section"><div class="section__head"><h2 class="section__title">Entrenamiento</h2></div><div class="form">' +
      '<div class="grid-2">' +
        '<div class="field"><label class="field__label" for="pfUnit">Unidad</label>' +
          '<select class="select" id="pfUnit"><option value="kg"' + (prefs.unit === 'kg' ? ' selected' : '') + '>Kilogramos</option><option value="lb"' + (prefs.unit === 'lb' ? ' selected' : '') + '>Libras</option></select></div>' +
        '<div class="field"><label class="field__label" for="pfBar">Peso de la barra (kg)</label>' +
          '<input class="input" id="pfBar" inputmode="decimal" value="' + prefs.barKg + '">' +
          '<span class="field__hint">La calculadora de discos siempre trabaja en kilos.</span></div>' +
      '</div>' +
      '<div class="field"><label class="field__label" for="pfRest">Descanso por defecto (segundos)</label>' +
        '<input class="input" id="pfRest" inputmode="numeric" value="' + prefs.defaultRest + '"></div>' +
      '<div class="field"><span class="field__label">Duración del cronómetro por defecto</span>' +
        '<div class="filters" style="margin:0">' +
          [30, 60, 90, 120, 180].map(function (s) {
            return '<button class="chip chip--mini" data-act="timer-def" data-seg="' + s + '" aria-pressed="' + (prefs.timerSec === s) + '">' + fmtSeg(s) + '</button>';
          }).join('') +
        '</div>' +
        '<span class="field__hint">Es con lo que arranca el cronómetro de cada ejercicio. En la tarjeta lo podés cambiar por ejercicio.</span></div>' +
      '<div class="filters" style="margin:0">' +
        '<button class="chip" data-act="toggle-sound" aria-pressed="' + prefs.sound + '">Aviso sonoro</button>' +
        '<button class="chip" data-act="toggle-vibrate" aria-pressed="' + prefs.vibrate + '">Vibración</button>' +
        '<button class="chip" data-act="toggle-wake" aria-pressed="' + prefs.wake + '">Pantalla encendida</button>' +
        '<button class="chip" data-act="toggle-prog" aria-pressed="' + prefs.prog + '">Progresión automática</button>' +
      '</div>' +
      '<div class="filters" style="margin:10px 0 0">' +
        '<button class="chip" data-act="sound-test"><i class="fa-solid fa-volume-high" aria-hidden="true"></i> Probar la alarma</button>' +
        '<button class="chip" data-act="avisos-pedir" aria-pressed="' + (Avisos.permiso() === 'granted') + '">' +
          (Avisos.permiso() === 'granted' ? '<i class="fa-solid fa-bell" aria-hidden="true"></i> Avisos activados'
            : '<i class="fa-solid fa-bell-slash" aria-hidden="true"></i> Activar avisos') + '</button>' +
      '</div>' +
      '<p class="field__hint">El cronómetro de cada ejercicio suena, vibra y avisa cuando llega a cero. ' +
        'Probá la alarma con la música puesta, antes de confiar en ella. En iPhone, si el teléfono está en silencio, ' +
        'el sonido puede no salir: la vibración y el aviso igual funcionan.</p>' +
      '<p class="field__hint">La progresión automática deriva el peso de cada ejercicio de tu historial: ' +
        'con el objetivo de fuerza sube cuando completás todas las series, y en el resto primero trepa repeticiones.</p>' +
    '</div></div>' +

    '<div class="section"><div class="section__head"><h2 class="section__title">Instalar en el celular</h2>' +
      '<span class="section__note">' + (enModoApp() ? 'ya estás usando la app instalada' : 'funciona sin conexión') + '</span></div>' +
      (enModoApp()
        ? '<div class="alert alert--sign"><b>Listo:</b> estás usando HIERRO como aplicación instalada. Los datos viven en este dispositivo.</div>'
        : '<div class="alert">' + textoInstalar() + '</div>') +
    '</div>' +

    '<div class="section"><div class="section__head"><h2 class="section__title">Calculadora de discos</h2>' +
      '<span class="section__note">qué cargar en cada lado</span></div>' +
      '<div class="field"><label class="field__label" for="calcWeight">Peso total (' + unit() + ')</label>' +
        '<input class="input" id="calcWeight" data-act="calc-weight" inputmode="decimal" value="' + fmtInputWeight(state.calcWeight) + '"></div>' +
      '<div class="plateload" id="calcPlates" style="margin-top:12px">' + platesBlockHtml(state.calcWeight) + '</div>' +
    '</div>' +

    (esAdmin() ? usuariosAdminHtml() : '') +

    '<div class="section"><div class="section__head"><h2 class="section__title">Datos</h2><span class="section__note">todo queda en este navegador</span></div>' +
      '<div class="rows">' +
        '<button class="row-link" data-act="pass-toggle"><span class="row-link__icon"><i class="fa-solid fa-key"></i></span><span class="row-link__text"><span class="row-link__name">Cambiar mi contraseña</span><span class="row-link__desc">Se guarda cifrada con PBKDF2 y sal propia</span></span></button>' +
        '<button class="row-link" data-act="export"><span class="row-link__icon"><i class="fa-solid fa-file-export"></i></span><span class="row-link__text"><span class="row-link__name">Exportar mis datos</span><span class="row-link__desc">JSON con tu historial completo</span></span></button>' +
        '<button class="row-link" data-act="export-csv"><span class="row-link__icon"><i class="fa-solid fa-table"></i></span><span class="row-link__text"><span class="row-link__name">Exportar historial (CSV)</span><span class="row-link__desc">Una fila por serie, para Excel o Google Sheets</span></span></button>' +
        '<button class="row-link" data-act="import"><span class="row-link__icon"><i class="fa-solid fa-file-import"></i></span><span class="row-link__text"><span class="row-link__name">Importar copia</span><span class="row-link__desc">JSON de HIERRO o CSV del historial: sirve para pasar todo a otro navegador o al celular</span></span></button>' +
        '<button class="row-link" data-act="wipe"><span class="row-link__icon"><i class="fa-solid fa-trash"></i></span><span class="row-link__text"><span class="row-link__name">Borrar mis entrenamientos</span><span class="row-link__desc">Sesiones, récords y peso corporal. La cuenta queda</span></span></button>' +
        '<button class="row-link" data-act="logout"><span class="row-link__icon"><i class="fa-solid fa-right-from-bracket"></i></span><span class="row-link__text"><span class="row-link__name">Cerrar sesión</span><span class="row-link__desc">Volver a la pantalla de acceso</span></span></button>' +
      '</div>' +
      '<form class="form" data-form="password" id="passForm" hidden style="margin-top:12px">' +
        '<div class="grid-2">' +
          '<div class="field"><label class="field__label" for="newPass">Nueva contraseña</label>' +
            '<input class="input" id="newPass" type="password" autocomplete="new-password"></div>' +
          '<div class="field"><label class="field__label" for="newPass2">Repetila</label>' +
            '<input class="input" id="newPass2" type="password" autocomplete="new-password"></div>' +
        '</div>' +
        '<p class="alert alert--error" id="passError" hidden></p>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn--sign" type="submit">Guardar contraseña</button>' +
          '<button class="btn btn--ghost" type="button" data-act="pass-toggle">Cancelar</button>' +
        '</div>' +
      '</form>' +
    '</div>' +

    '<div class="section"><div class="alert"><b>Contraseña local.</b> El perfil se guarda hasheado en este navegador para separar cuentas del mismo dispositivo. No es seguridad real: cualquiera con acceso al equipo puede leer el historial.</div>' +
    '<p class="gate__note" style="margin-top:10px">Microfiguras: ' + esc((DB.meta && DB.meta.attribution) || '') + ' · Base de ejercicios v' + esc((DB.meta && DB.meta.version) || '') + '</p></div>';
}

/* ═══ 9. ROUTER Y RENDER ═════════════════════════════════════════════════ */

var NAV = [
  { id: 'hoy', route: '#/hoy', label: 'Hoy', icon: 'fa-house' },
  { id: 'entrenar', route: '#/entrenar', label: 'Entrenar', icon: 'fa-dumbbell' },
  { id: 'historial', route: '#/historial', label: 'Progreso', icon: 'fa-chart-simple' },
  { id: 'perfil', route: '#/perfil', label: 'Perfil', icon: 'fa-user-gear' },
];

function go(route) {
  if (location.hash === route) { render(); return; }
  location.hash = route;
}

function currentView() {
  var h = (location.hash || '#/hoy').replace('#/', '');
  return ['hoy', 'entrenar', 'historial', 'perfil'].indexOf(h) !== -1 ? h : (state.account ? 'hoy' : 'acceso');
}

/* ── Foco: el re-render reemplaza el DOM, así que hay que devolverlo ─────
   Sin esto, cada toque en un control de serie deja el foco en el body y la
   app no se puede recorrer con el teclado. */
var FOCUS_SEL = '#main [data-act]';

function captureFocus() {
  var el = document.activeElement;
  if (!el || !el.closest || !el.closest('#main')) return null;
  var act = el.getAttribute('data-act');
  if (!act) return null;
  return {
    act: act,
    entry: el.getAttribute('data-entry'),
    set: el.getAttribute('data-set'),
    go: el.getAttribute('data-go'),
  };
}

function restoreFocus(f) {
  if (!f) return;
  var sel = '#main [data-act="' + f.act + '"]';
  if (f.entry != null && f.entry !== '') sel += '[data-entry="' + f.entry + '"]';
  if (f.set != null && f.set !== '') sel += '[data-set="' + f.set + '"]';
  if (f.go != null && f.go !== '') sel += '[data-go="' + f.go + '"]';
  var el = document.querySelector(sel);
  if (el && el.focus) el.focus({ preventScroll: true });
}

function render() {
  var gate = !state.account;
  var view = gate ? 'acceso' : currentView();
  var viewChanged = state.view && state.view !== view;
  var focus = captureFocus();
  state.view = view;

  $('.topbar').hidden = gate;
  $('#tabbar').hidden = gate;
  $('#rail').hidden = gate;
  $('#btnLogout').hidden = gate;
  $('#goalTag').hidden = gate;

  if (gate) {
    $('#main').innerHTML = viewGate();
  } else {
    var p = state.data.profile;
    $('#goalTag').textContent = objetivoLabel(p.objetivo);
    $('#btnSound').setAttribute('aria-pressed', String(state.data.prefs.sound));
    $('#main').innerHTML = '<div class="view">' + (view === 'hoy' ? viewToday()
      : view === 'entrenar' ? viewTrain()
      : view === 'historial' ? viewHistory()
      : viewProfile()) + '</div>';
    buildNav(view);
  }

  var y = window.scrollY;
  window.scrollTo(0, y);
  bindFigures();
  updateBand();
  updateInstallButton();
  Wake.sync();

  // Foco: primero la serie recién marcada (si hay), después el control que lo tenía,
  // y si cambió la vista, el contenedor principal para que el lector lo anuncie.
  if (state._stamp) {
    var marcado = document.querySelector('#main [data-act="set-toggle"][data-entry="' + state._stamp.entry + '"][data-set="' + state._stamp.set + '"]');
    if (marcado) {
      marcado.classList.add('stamp-in');
      setTimeout(function () { marcado.classList.remove('stamp-in'); }, 280);
    }
    state._stamp = null;
  }
  if (viewChanged) {
    var principal = $('#main');
    if (principal) principal.focus({ preventScroll: true });
  } else {
    restoreFocus(focus);
  }
}

function buildNav(active) {
  var tab = NAV.map(function (n) {
    return '<button class="tab" data-act="go" data-go="' + n.route + '"' + (n.id === active ? ' aria-current="page"' : '') + '>' +
      '<i class="fa-solid ' + n.icon + '"></i><span>' + n.label + '</span></button>';
  }).join('');
  $('#tabbar').innerHTML = tab;
  $('#rail').innerHTML = NAV.map(function (n) {
    return '<button class="rail__item" data-act="go" data-go="' + n.route + '"' + (n.id === active ? ' aria-current="page"' : '') + '>' +
      '<i class="fa-solid ' + n.icon + '"></i><span>' + n.label + '</span></button>';
  }).join('');
}

/* Las imágenes que fallan caen al espejo y después al pictograma vectorial,
   sin romper la tarjeta. */
function bindFigures() {
  $$('img[data-figure-frame]').forEach(function (img) {
    img.addEventListener('error', function () {
      var entry = img.getAttribute('data-ex');
      var e = state.data.activeSession && state.data.activeSession.entries[+entry];
      if (!e) return;
      // Primer intento: el espejo si el CDN principal no responde.
      if (!imgBaseB && e.img) {
        imgBaseB = true;
        img.setAttribute('data-tried-alt', '1');
        img.src = imgUrl(e.img, 0);
        return;
      }
      img.outerHTML = pictoSvg(e.pattern);
    });
  });
}

/* ── Banda de señal: siguiente serie y descanso ───────────────────────── */

function updateBand() {
  var band = $('#nextband');
  if (!band) return;
  var s = state.data && state.data.activeSession;
  var icon = $('#nextIcon'), title = $('#nextTitle'), sub = $('#nextSub');
  var clock = $('#nextClock'), progress = $('#restProgress');
  var addBtn = $('#btnRestAdd'), skipBtn = $('#btnRestSkip');

  if (!s) {
    band.hidden = true;
    return;
  }
  var pending = firstPending(s);
  var st = sessionStats(s);
  band.hidden = false;

  if (pending) {
    title.textContent = pending.ex.name + ' · serie ' + (pending.set + 1) + ' de ' + pending.ex.sets.length;
    sub.textContent = pending.st.reps + ' ' + repUnitLabel(pending.ex.unit, pending.st.reps) + ' con ' + fmtWeight(pending.st.weight) +
      ' · objetivo ' + pending.st.target;
    icon.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
  } else {
    title.textContent = 'Series completadas';
    sub.textContent = 'Terminá el entrenamiento para guardar ' + fmtNum(toDisplay(st.volume)) + ' ' + unit() + ' de volumen';
    icon.innerHTML = '<i class="fa-solid fa-check"></i>';
  }

  var resting = Rest.running;
  var t = EjTimer.datos();
  var corriendoEj = !!(t && t.running);
  clock.hidden = !(resting || corriendoEj);
  progress.hidden = !resting;
  addBtn.hidden = !resting;
  skipBtn.hidden = !resting;
  if (resting) {
    $('#clockValue').textContent = fmtClock((Rest.endsAt - Date.now()) / 1000);
    progress.firstElementChild.style.transform = 'scaleX(' + clamp((Rest.endsAt - Date.now()) / 1000 / Rest.total, 0, 1) + ')';
    var lblR = $('#clockLabel');
    if (lblR) lblR.textContent = 'descanso';
  } else if (corriendoEj) {
    title.textContent = 'Cronómetro · ' + t.nombre;
    sub.textContent = 'Llegó a ' + fmtSeg(t.totalSec) + ' y te avisa. Se pausa y detiene desde la tarjeta del ejercicio.';
    icon.innerHTML = '<i class="fa-solid fa-stopwatch"></i>';
    $('#clockValue').textContent = fmtClock(EjTimer.restante());
    var lblT = $('#clockLabel');
    if (lblT) lblT.textContent = 'cronómetro';
  }
}

function updateInstallButton() {
  var btn = $('#btnInstall');
  if (btn && deferredInstall) btn.hidden = !state.account;
}

/* ═══ 10. EVENTOS Y ARRANQUE ═════════════════════════════════════════════ */

/* Delegación de clics: una sola escucha para toda la app. */
document.addEventListener('click', function (ev) {
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
  if (!el) {
    var cerrar = ev.target.closest ? ev.target.closest('[data-close-sheet],[data-close-picker]') : null;
    if (cerrar) {
      if (cerrar.hasAttribute('data-close-picker')) closePicker();
      else closeSheet();
    }
    return;
  }
  var act = el.getAttribute('data-act');
  var s = state.data && state.data.activeSession;
  var entryIdx = +el.getAttribute('data-entry');
  var setIdx = +el.getAttribute('data-set');

  switch (act) {
    case 'go': go(el.getAttribute('data-go')); break;

    case 'gate-tab':
      var isLogin = el.getAttribute('data-tab') === 'login';
      $$('.gate__tab').forEach(function (t) { t.setAttribute('aria-selected', String(t === el)); });
      var panelEntrar = $('[data-form="login"]');
      var panelAlta = $('[data-form="register"]');
      if (panelEntrar) panelEntrar.hidden = !isLogin;
      if (panelAlta) panelAlta.hidden = isLogin;
      if (!isLogin && panelAlta) {
        // Si venía de escribir su nombre en "Entrar", lo llevamos cargado al alta.
        var destino = $('#regName');
        var escrito = $('#loginUser') ? $('#loginUser').value.trim() : '';
        if (destino && !destino.value && escrito) destino.value = escrito;
        if (destino) destino.focus();
      }
      break;

    case 'pick-objetivo':
      state.pendingObjetivo = el.getAttribute('data-value');
      $$('[data-act="pick-objetivo"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); });
      break;

    case 'pick-nivel':
      state.pendingNivel = el.getAttribute('data-value');
      $$('[data-act="pick-nivel"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); });
      break;

    case 'start':
      startSession(el.getAttribute('data-routine'), state.newSessionDate);
      go('#/entrenar');
      render();
      toast('Sesión iniciada. ¡A cargar la barra!', 'sign');
      break;

    case 'set-date':
      state.newSessionDate = el.getAttribute('data-value') || todayISO();
      render();
      break;

    case 'open-picker': openPicker(); break;
    case 'pick-exercise': pickExercise(el.getAttribute('data-ex')); break;
    case 'pick-muscle':
      state.picker.muscle = el.getAttribute('data-value') || '';
      renderPicker();
      break;
    case 'del-exercise': removeExerciseFromSession(entryIdx); break;
    case 'equalize': applyFirstSetToAll(entryIdx); break;

    /* Acceso: el alta del administrador es un enlace, no la pantalla principal. */
    case 'gate-alta-admin':
      state.gatePanel = el.getAttribute('data-value') === 'volver' ? 'login' : 'alta-admin';
      render();
      break;
    case 'gate-traer':
      state.gatePanel = el.getAttribute('data-value') === 'volver' ? 'login' : 'traer';
      render();
      break;
    case 'gate-reset':
      state.gatePanel = el.getAttribute('data-value') === 'volver' ? 'login' : 'reset';
      render();
      break;

    /* Armado del día por grupo muscular */
    case 'picker-mode':
      state.pickerMode = el.getAttribute('data-value') === 'rutinas' ? 'rutinas' : 'grupos';
      state.data.prefs.pickerMode = state.pickerMode;
      saveData();
      render();
      break;
    case 'toggle-grupo': alternarGrupo(el.getAttribute('data-value')); break;
    case 'toggle-ejercicio': alternarEjercicioDelDia(el.getAttribute('data-ex')); break;
    case 'clear-builder': limpiarBorrador(); break;
    case 'start-builder': empezarDesdeBorrador(); break;

    /* Cronómetro por ejercicio */
    case 'timer-set': EjTimer.asignar(entryIdx, Number(el.getAttribute('data-seg'))); break;
    case 'timer-start': case 'timer-restart': EjTimer.iniciar(entryIdx); break;
    case 'timer-pause': EjTimer.pausar(); break;
    case 'timer-resume': EjTimer.reanudar(); break;
    case 'timer-stop': EjTimer.detener(); break;

    /* Sonido, avisos y duración por defecto */
    case 'sound-test': Sound.prueba(); break;
    case 'avisos-pedir': Avisos.pedir(); break;
    case 'timer-def':
      state.data.prefs.timerSec = clamp(Number(el.getAttribute('data-seg')) || 90, 5, 3600);
      saveData(); render();
      toast('Duración por defecto: ' + fmtSeg(state.data.prefs.timerSec) + '.', 'sign');
      break;

    case 'finish': finishSession(); break;
    case 'discard': discardSession(); break;

    case 'filter':
      // '' = todas las rutinas; null = sin filtro elegido (se usa el objetivo del perfil).
      state.filter = el.hasAttribute('data-value') ? (el.getAttribute('data-value') || 'todas') : null;
      render();
      break;

    case 'set-toggle':
      toggleSet(entryIdx, setIdx);
      break;

    case 'rep-dec': changeSet(entryIdx, setIdx, { reps: -1 }); break;
    case 'rep-inc': changeSet(entryIdx, setIdx, { reps: 1 }); break;
    case 'w-dec': changeSet(entryIdx, setIdx, { weight: -weightStepKg() }); break;
    case 'w-inc': changeSet(entryIdx, setIdx, { weight: weightStepKg() }); break;

    case 'add-set':
      var e = s.entries[entryIdx];
      var last = e.sets[e.sets.length - 1];
      e.sets.push({ target: last.target, reps: last.reps, weight: last.weight, done: false, ts: null, pr: false });
      saveData(); render();
      break;

    case 'del-set':
      var e2 = s.entries[entryIdx];
      if (e2.sets.length > 1) { e2.sets.pop(); saveData(); render(); }
      else toast('Cada ejercicio necesita al menos una serie.');
      break;

    case 'sheet': openSheet(entryIdx); break;

    case 'rest-add': Rest.add(15); break;
    case 'rest-skip': Rest.skip(); break;

    case 'toggle-session':
      var body = el.nextElementSibling;
      var open = body.hidden;
      body.hidden = !open;
      el.setAttribute('aria-expanded', String(open));
      break;

    case 'del-session':
      if (confirm('¿Borrar esta sesión del historial?')) {
        state.data.sessions.splice(+el.getAttribute('data-idx'), 1);
        saveData(); render(); toast('Sesión borrada.');
      }
      break;

    case 'set-objetivo':
      state.data.profile.objetivo = el.getAttribute('data-value');
      saveData(); render(); toast('Objetivo: ' + objetivoLabel(state.data.profile.objetivo) + '.');
      break;

    case 'set-nivel':
      state.data.profile.level = el.getAttribute('data-value');
      saveData(); render();
      break;

    case 'log-weight':
      var wDisp = parseFloat(($('#pfWeight').value || '').replace(',', '.'));
      if (isNaN(wDisp)) { toast('Escribí un peso válido.', 'error'); break; }
      var wKg = toKg(wDisp);
      if (wKg < 20 || wKg > 400) { toast('Peso fuera de rango (entre 20 y 400 kg).', 'error'); break; }
      state.data.profile.weightKg = Math.round(wKg * 10) / 10;
      state.data.bodyweight = state.data.bodyweight.filter(function (x) { return x.date !== todayISO(); });
      state.data.bodyweight.push({ date: todayISO(), kg: state.data.profile.weightKg });
      state.data.bodyweight.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      saveData(); render();
      toast('Peso de hoy guardado.', 'sign');
      break;

    case 'toggle-sound':
      state.data.prefs.sound = !state.data.prefs.sound;
      saveData(); render();
      break;

    case 'toggle-vibrate':
      state.data.prefs.vibrate = !state.data.prefs.vibrate;
      saveData(); render();
      break;

    case 'toggle-wake':
      state.data.prefs.wake = !state.data.prefs.wake;
      saveData(); render();
      toast(state.data.prefs.wake ? 'La pantalla va a quedar encendida mientras entrenás.' : 'Pantalla encendida desactivada.');
      break;

    case 'toggle-prog':
      state.data.prefs.prog = !state.data.prefs.prog;
      saveData(); render();
      toast(state.data.prefs.prog ? 'Progresión automática activada.' : 'Progresión automática desactivada: los pesos quedan como los pusiste.');
      break;

    case 'export': exportData(); break;
    case 'export-csv': exportCsv(); break;
    case 'backup-full': exportFullBackup(); break;
    case 'restore-full': restoreFullBackup(); break;
    case 'import': importData(); break;

    case 'alta-aceptar':
      if (!state.altaPendiente) { render(); break; }
      importarPaqueteAlta(state.altaPendiente).then(function (u) {
        state.altaPendiente = null;
        render();
        toast('Cuenta de ' + u.name + ' lista. Entrá con la contraseña que te dieron.', 'sign');
      }).catch(function (e) { toast('No se pudo agregar: ' + e.message, 'error'); });
      break;

    case 'alta-cancelar':
      state.altaPendiente = null;
      render();
      break;

    case 'bk-restore':
      var bkId = el.getAttribute('data-bk');
      if (confirm('Se reemplazan los datos actuales por los de ese respaldo. ¿Seguir?')) {
        CORE.store.restoreSnapshot(bkId).then(function () {
          return CORE.store.users();
        }).then(function (users) {
          state.users = users;
          return state.account ? loadAccount(state.account.id) : null;
        }).then(function () {
          render();
          toast('Respaldo restaurado.', 'sign');
        }).catch(function (e) { toast('No se pudo restaurar: ' + e.message, 'error'); });
      }
      break;

    case 'u-pass': restablecerPassword(el.getAttribute('data-user')); break;

    case 'u-enlace':
      var uEnlace = state.users.filter(function (x) { return x.id === el.getAttribute('data-user'); })[0];
      if (uEnlace) {
        var link = enlaceDeAlta(uEnlace);
        copiarTexto(link).then(function (ok) {
          if (ok) toast('Enlace copiado. Pasáselo junto con la contraseña.', 'sign');
          else prompt('Copiá el enlace de alta de ' + uEnlace.name + ':', link);
        });
      }
      break;

    case 'u-toggle':
      var uTog = state.users.filter(function (x) { return x.id === el.getAttribute('data-user'); })[0];
      if (uTog) {
        uTog.disabled = !uTog.disabled;
        CORE.store.saveUser(uTog).then(function () {
          render();
          toast(uTog.name + (uTog.disabled ? ' desactivado.' : ' activado.'));
        });
      }
      break;

    case 'u-borrar': borrarUsuario(el.getAttribute('data-user')); break;

    case 'pass-toggle':
      var passForm = $('#passForm');
      passForm.hidden = !passForm.hidden;
      if (!passForm.hidden) $('#newPass').focus();
      break;

    case 'wipe':
      if (confirm('¿Borrar todas tus sesiones, récords y peso corporal? El perfil se mantiene.')) {
        state.data.sessions = []; state.data.prs = {}; state.data.bodyweight = []; state.data.activeSession = null;
        saveData(); Rest.stop(); render();
        toast('Datos borrados.');
      }
      break;

    case 'logout': logout(); break;
  }
});

/* Cambios en los campos numéricos de cada serie. */
document.addEventListener('change', function (ev) {
  var el = ev.target;
  var act = el.getAttribute && el.getAttribute('data-act');
  if (act === 'strength-ex') {
    state.strengthEx = el.value;
    render();
    return;
  }
  if (act === 'session-date') {
    state.newSessionDate = el.value || todayISO();
    render();
    return;
  }
  if (act === 'sess-date') {
    var s = state.data.activeSession;
    if (s && /^\d{4}-\d{2}-\d{2}$/.test(el.value)) {
      s.date = el.value > todayISO() ? todayISO() : el.value;
      saveData(); render();
      toast('Entrenamiento registrado como ' + fmtDayLong(s.date) + '.');
    }
    return;
  }
  if (act === 'rep-input' || act === 'w-input') {
    var e = state.data.activeSession.entries[+el.getAttribute('data-entry')];
    var st = e.sets[+el.getAttribute('data-set')];
    var val = parseFloat(String(el.value).replace(',', '.'));
    if (isNaN(val) || val < 0) { el.value = act === 'rep-input' ? st.reps : fmtInputWeight(st.weight); return; }
    if (act === 'rep-input') st.reps = Math.round(val);
    else st.weight = Math.round(toKg(val) * 4) / 4;
    saveData();
    refreshLive();
  } else if (el.id === 'pfUnit' || el.id === 'pfBar' || el.id === 'pfRest' || el.id === 'pfWeight' || el.id === 'pfHeight') {
    var incompletoAntes = !perfilCompleto(state.data.profile);
    if (el.id === 'pfUnit') state.data.prefs.unit = el.value;
    if (el.id === 'pfBar') state.data.prefs.barKg = clamp(parseFloat(el.value) || 20, 5, 30);
    if (el.id === 'pfRest') state.data.prefs.defaultRest = clamp(parseInt(el.value, 10) || 90, 15, 600);
    if (el.id === 'pfWeight') {
      var pv = parseFloat(String(el.value).replace(',', '.'));
      if (!isNaN(pv)) state.data.profile.weightKg = Math.round(toKg(pv) * 10) / 10;
    }
    if (el.id === 'pfHeight') state.data.profile.heightCm = parseFloat(el.value) || 0;
    saveData();
    // Al completar los datos físicos, el aviso "Completá tu perfil" tiene que irse.
    if (el.id === 'pfUnit' || (incompletoAntes && perfilCompleto(state.data.profile))) render();
    else toast('Perfil actualizado.');
  }
});

/* Actualización en vivo sin re-render: métricas y carga de discos. */
document.addEventListener('input', function (ev) {
  var el = ev.target;
  var act = el.getAttribute && el.getAttribute('data-act');
  // Buscador del selector de ejercicios: se redibuja solo la lista, sin tocar el foco.
  if (el.id === 'pickerBuscar') {
    state.picker.q = el.value || '';
    renderPicker();
    return;
  }
  // Calculadora de discos: se recalcula en vivo mientras escribís.
  if (act === 'calc-weight') {
    var vCalc = parseFloat(String(el.value).replace(',', '.'));
    state.calcWeight = isNaN(vCalc) ? 0 : toKg(vCalc);
    var caja = $('#calcPlates');
    if (caja) caja.innerHTML = platesBlockHtml(state.calcWeight);
    return;
  }
  // Cronómetro: si escribís los segundos a mano, se toma ese valor.
  if (act === 'timer-libre') {
    var segLibre = parseInt(String(el.value).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(segLibre) && segLibre >= 5) {
      EjTimer.asignar(+el.getAttribute('data-entry'), segLibre);
      toast('Cronómetro en ' + fmtSeg(segLibre) + '.', 'sign');
    }
    return;
  }
  if (act !== 'w-input') return;
  var entryIdx = +el.getAttribute('data-entry');
  var e = state.data.activeSession.entries[entryIdx];
  var box = $('#plates-' + entryIdx);
  if (box) {
    var val = parseFloat(String(el.value).replace(',', '.'));
    box.innerHTML = plateLoadHtml(e.ex, isNaN(val) ? 0 : toKg(val));
  }
});

function changeSet(entryIdx, setIdx, delta) {
  var e = state.data.activeSession.entries[entryIdx];
  var st = e.sets[setIdx];
  if (delta.reps != null) st.reps = clamp((Number(st.reps) || 0) + delta.reps, 0, 999);
  if (delta.weight != null) st.weight = clamp((Number(st.weight) || 0) + delta.weight, 0, 1000);
  saveData();
  refreshLive();
}

/* Re-render completo conservando la posición del scroll (simple y suficiente). */
function refreshLive() { render(); }

/* ── Selector de ejercicios: sumar a la sesión en curso ─────────────────
   La rutina es un punto de partida, no un contrato: acá agregás los que
   quieras, con la carga sugerida para cada uno. */
function openPicker() {
  var p = $('#picker');
  if (!p || !state.data.activeSession) return;
  state.picker = { q: '', muscle: '' };
  $('#pickerBuscar').value = '';
  $('#pickerMeta').textContent = 'Sumando al entrenamiento del ' + fmtDayLong(state.data.activeSession.date);
  renderPicker();
  p.hidden = false;
  $('#pickerBuscar').focus();
}

function closePicker() {
  var p = $('#picker');
  if (!p || p.hidden) return;
  p.hidden = true;
  var disparador = document.querySelector('#main [data-act="open-picker"]');
  if (disparador) disparador.focus({ preventScroll: true });
}

function renderPicker() {
  var s = state.data.activeSession;
  var lista = $('#pickerLista'), chips = $('#pickerMusculos');
  if (!lista || !s) return;

  var musculos = [];
  DB.exercises.forEach(function (ex) { if (musculos.indexOf(ex.muscle) === -1) musculos.push(ex.muscle); });
  chips.innerHTML = '<button class="chip" data-act="pick-muscle" data-value="" aria-pressed="' + (!state.picker.muscle) + '">Todos</button>' +
    musculos.map(function (m) {
      return '<button class="chip" data-act="pick-muscle" data-value="' + esc(m) + '" aria-pressed="' + (state.picker.muscle === m) + '">' + esc(m) + '</button>';
    }).join('');

  var q = state.picker.q.toLowerCase();
  var yaEsta = {};
  s.entries.forEach(function (e) { yaEsta[e.ex] = true; });

  var filtrados = DB.exercises.filter(function (ex) {
    if (state.picker.muscle && ex.muscle !== state.picker.muscle) return false;
    if (!q) return true;
    return ex.name.toLowerCase().indexOf(q) !== -1 || (ex.nameEn || '').toLowerCase().indexOf(q) !== -1;
  });

  lista.innerHTML = filtrados.length ? filtrados.map(function (ex) {
    var presc = prescriptionFor(ex.key, { w: routineDefaultWeight(ex.key) }, s.objetivo);
    var carga = presc.weight > 0 ? fmtWeight(presc.weight)
      : (ex.load === 'body' ? 'peso corporal' : 'sin historial');
    return '<button class="row-link" data-act="pick-exercise" data-ex="' + esc(ex.key) + '">' +
      '<span class="row-link__icon"><i class="fa-solid ' + (yaEsta[ex.key] ? 'fa-check' : 'fa-plus') + '"></i></span>' +
      '<span class="row-link__text">' +
        '<span class="row-link__name">' + esc(ex.name) + '</span>' +
        '<span class="row-link__desc">' + esc(ex.muscle) + ' · ' + esc(ex.equipment || '') + ' · ' + esc(carga) + '</span>' +
      '</span>' +
    '</button>';
  }).join('') : '<p class="gate__note">Ningún ejercicio coincide con «' + esc(state.picker.q) + '». Probá con otra palabra.</p>';
}

function pickExercise(exKey) {
  addExerciseToSession(exKey);
  closePicker();
}

function openSheet(entryIdx) {
  var e = state.data.activeSession.entries[entryIdx];
  var ex = exOf(e.ex);
  var sheet = $('#sheet');
  $('#sheetMuscle').textContent = e.muscle;
  $('#sheetTitle').textContent = e.name;
  $('#sheetCues').innerHTML = (ex.cues || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
  $('#sheetPlates').innerHTML = plateLoadHtml(e.ex, activeWeight(e));

  var fig = $('#sheetFigure');
  if (e.img && frameCount() > 1) {
    fig.className = 'figure';
    fig.innerHTML =
      '<span class="figure__badge">inicio / fin</span>' +
      '<img class="figure__frame" src="' + esc(imgUrl(e.img, 0)) + '" alt="' + esc(e.name) + ', posición inicial" data-sheet-frame>' +
      '<img class="figure__frame figure__frame--b" src="' + esc(imgUrl(e.img, 1)) + '" alt="' + esc(e.name) + ', posición final" data-sheet-frame>' +
      '<button class="figure__badge" style="left:auto;right:10px;top:10px" data-act="sheet-pause" id="btnPauseFig"><i class="fa-solid fa-pause"></i> pausar</button>';
    $('#sheetCredit').textContent = 'Microfigura: ' + (DB.meta.attribution || '');
  } else if (e.img) {
    // Un solo archivo por ejercicio (GIF animado o SVG): se muestra tal cual.
    fig.className = 'figure';
    fig.innerHTML =
      '<span class="figure__badge">animación</span>' +
      '<img class="figure__frame" src="' + esc(imgUrl(e.img, 0)) + '" alt="' + esc(e.name) + '" data-sheet-frame>';
    $('#sheetCredit').textContent = 'Microfigura: ' + (DB.meta.attribution || '');
  } else {
    fig.className = 'figure figure--picto';
    fig.innerHTML = pictoSvg(e.pattern) + '<span class="figure__badge">diagrama del movimiento</span>';
    $('#sheetCredit').textContent = 'Este ejercicio no tiene microfigura en el repositorio: se muestra el diagrama del patrón.';
  }

  // Si la figura del repositorio no carga, primero se prueba el espejo y
  // después el diagrama, sin dejar la hoja vacía.
  $$('[data-sheet-frame]').forEach(function (img) {
    img.addEventListener('error', function () {
      if (!imgBaseB && e.img) {
        imgBaseB = true;
        $$('[data-sheet-frame]').forEach(function (otro, n) { otro.src = imgUrl(e.img, n); });
        return;
      }
      fig.className = 'figure figure--picto';
      fig.innerHTML = pictoSvg(e.pattern) + '<span class="figure__badge">diagrama del movimiento</span>';
      $('#sheetCredit').textContent = 'No se pudieron cargar las microfiguras (¿sin conexión?). Se muestra el diagrama del patrón.';
    });
  });

  sheet.hidden = false;
  state._sheetEntry = entryIdx;
  var close = $('.sheet__head .icon-btn', sheet);
  if (close) close.focus();
}
function closeSheet() {
  var sheet = $('#sheet');
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  // El foco vuelve al disparador: la hoja ya no está en el árbol visible.
  if (state._sheetEntry != null) {
    var disparador = document.querySelector('#main [data-act="sheet"][data-entry="' + state._sheetEntry + '"]');
    if (disparador) disparador.focus({ preventScroll: true });
    state._sheetEntry = null;
  }
}

/* Pausar la animación de la microfigura (accesibilidad y estudio de la técnica). */
document.addEventListener('click', function (ev) {
  if (!ev.target.closest || !ev.target.closest('#btnPauseFig')) return;
  var fig = $('#sheetFigure');
  fig.classList.toggle('is-paused');
  var btn = $('#btnPauseFig');
  var paused = fig.classList.contains('is-paused');
  btn.innerHTML = '<i class="fa-solid ' + (paused ? 'fa-play' : 'fa-pause') + '"></i> ' + (paused ? 'seguir' : 'pausar');
});

/* Escape cierra la hoja de técnica y el selector de ejercicios. */
document.addEventListener('keydown', function (ev) {
  if (ev.key !== 'Escape') return;
  closeSheet();
  closePicker();
});

/* Envío de formularios del acceso. */
document.addEventListener('submit', function (ev) {
  ev.preventDefault();
  var form = ev.target.getAttribute('data-form');
  if (form === 'alta-admin') altaAdministrador(ev);
  else if (form === 'login') login(ev);
  else if (form === 'traer') traerCuenta(ev);
  else if (form === 'reset-dispositivo') borrarDispositivo(ev);
  else if (form === 'password') changePassword(ev);
  else if (form === 'nuevo-usuario') altaDeUsuario(ev);
});

/* Botones fijos de la cabecera. */
$('#btnLogout').addEventListener('click', function () {
  if (state.data.activeSession && !confirm('Hay una sesión sin terminar. ¿Cerrar sesión igual?')) return;
  logout();
});
$('#btnSound').addEventListener('click', function () {
  if (!state.data) return;
  state.data.prefs.sound = !state.data.prefs.sound;
  saveData();
  this.setAttribute('aria-pressed', String(state.data.prefs.sound));
  toast(state.data.prefs.sound ? 'Aviso sonoro activado.' : 'Aviso sonoro desactivado.');
});
$('#nextband').addEventListener('click', function (ev) {
  if (ev.target.closest('[data-act]')) return;
  if (state.data && state.data.activeSession) go('#/entrenar');
});

/* Copia de seguridad. */
/* ── Respaldos y administración de usuarios ───────────────────────────── */

function cargarBackups() {
  state.backups = [];
  CORE.store.backups().then(function (list) {
    state.backups = list;
    if (state.view === 'perfil') render();
  }).catch(function () { state.backups = []; });
}

function unRespaldoPorDia() {
  return CORE.store.backups().then(function (list) {
    var hoy = todayISO();
    var yaHay = list.some(function (b) { return todayISO(new Date(b.at)) === hoy; });
    if (yaHay) return null;
    return CORE.store.snapshot('automático');
  });
}

/* Enlace de alta: lleva la cuenta a otro dispositivo sin backend. Contiene la
   sal y la derivación (nunca la contraseña), así que se trata como credencial. */
function enlaceDeAlta(user) {
  var code = CORE.packs.packAccount(user);
  return location.origin + location.pathname + '#alta=' + code;
}

function copiarTexto(texto) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texto).then(function () { return true; }).catch(function () { return false; });
  }
  return Promise.resolve(false);
}

function altaDeUsuario(ev) {
  ev.preventDefault();
  var nombre = $('#nuNombre').value.trim();
  var clave = $('#nuClave').value;
  var rol = $('#nuAdmin').checked ? 'admin' : 'user';
  var err = $('#nuError');
  err.hidden = true;
  if (nombre.length < 2) { err.textContent = 'El usuario necesita al menos 2 letras.'; err.hidden = false; return; }
  if (clave.length < 4) { err.textContent = 'La contraseña necesita al menos 4 caracteres.'; err.hidden = false; return; }
  if (usuarioPorNombre(nombre)) { err.textContent = 'Ya existe un usuario con ese nombre.'; err.hidden = false; return; }

  crearUsuario(nombre, clave, rol, null).then(function () {
    return CORE.store.snapshot('antes del alta de ' + nombre).catch(function () { return null; });
  }).then(function () {
    $('#nuNombre').value = '';
    $('#nuClave').value = '';
    $('#nuAdmin').checked = false;
    render();
    toast('Usuario ' + nombre + ' dado de alta. Pasale la contraseña.', 'sign');
  }).catch(function (e) {
    err.textContent = 'No se pudo dar de alta: ' + e.message;
    err.hidden = false;
  });
}

function restablecerPassword(userId) {
  var u = state.users.filter(function (x) { return x.id === userId; })[0];
  if (!u) return;
  var nueva = prompt('Contraseña nueva para ' + u.name + ' (mínimo 4 caracteres):', '');
  if (nueva == null) return;
  if (nueva.length < 4) { toast('La contraseña necesita al menos 4 caracteres.', 'error'); return; }
  CORE.crypto.newCredential(nueva).then(function (cred) {
    u.salt = cred.salt; u.hash = cred.hash; u.iterations = cred.iterations;
    return CORE.store.saveUser(u);
  }).then(function () {
    toast('Contraseña de ' + u.name + ' actualizada. Pasásela.', 'sign');
  }).catch(function (e) { toast('No se pudo cambiar: ' + e.message, 'error'); });
}

function borrarUsuario(userId) {
  var u = state.users.filter(function (x) { return x.id === userId; })[0];
  if (!u) return;
  if (u.id === state.account.id) { toast('No podés borrar tu propio usuario.', 'error'); return; }
  var admins = state.users.filter(function (x) { return x.role === 'admin' && !x.disabled; });
  if (u.role === 'admin' && admins.length <= 1) { toast('Tiene que quedar al menos un administrador.', 'error'); return; }
  if (!confirm('Se borra el usuario «' + u.name + '» y TODOS sus entrenamientos de este dispositivo. ¿Seguir?')) return;
  CORE.store.deleteUser(u.id).then(function () {
    state.users = state.users.filter(function (x) { return x.id !== u.id; });
    render();
    toast('Usuario ' + u.name + ' borrado.');
  });
}

function importarPaqueteAlta(pack) {
  var user = CORE.validate.validateUser({
    id: uid(), name: pack.name, role: pack.role, salt: pack.salt, hash: pack.hash,
    iterations: pack.iterations, createdAt: pack.createdAt, profile: pack.profile,
  });
  var existente = usuarioPorNombre(pack.name);
  if (existente) { user.id = existente.id; }
  return CORE.store.saveUser(user).then(function () {
    if (!existente) {
      state.users.push(user);
      return CORE.store.saveDocument(CORE.validate.validateDocument(blankData(user.profile || { name: user.name }), user.id));
    }
    return null;
  }).then(function () { return user; });
}

function descargar(nombre, contenido, tipo) {
  var blob = new Blob([contenido], { type: tipo || 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}

function exportData() {
  var payload = {
    app: 'hierro', version: DB.meta.version, schema: CORE.SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: state.data.profile, prefs: state.data.prefs, sessions: state.data.sessions,
    prs: state.data.prs, bodyweight: state.data.bodyweight,
  };
  descargar('hierro-' + todayISO() + '.json', JSON.stringify(payload, null, 2), 'application/json');
  toast('Copia exportada.', 'sign');
}

function exportCsv() {
  var csv = CORE.csv.sessionsToCsv(state.data.sessions);
  if (csv.split('\r\n').length < 2) { toast('Todavía no hay series registradas para exportar.'); return; }
  descargar('hierro-historial-' + todayISO() + '.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
  toast('Historial exportado en CSV.', 'sign');
}

function exportFullBackup() {
  CORE.store.fullBackup().then(function (payload) {
    descargar('hierro-respaldo-completo-' + todayISO() + '.json', JSON.stringify(payload, null, 2), 'application/json');
    toast('Respaldo completo exportado.', 'sign');
  }).catch(function (e) { toast('No se pudo armar el respaldo: ' + e.message, 'error'); });
}

function restoreFullBackup() {
  elegirArchivo('application/json,.json', function (texto) {
    var data;
    try { data = JSON.parse(texto); } catch (e) { toast('El archivo no es un JSON válido.', 'error'); return; }
    if (!data || !Array.isArray(data.users)) { toast('Ese archivo no es un respaldo completo de HIERRO.', 'error'); return; }
    if (!confirm('Se van a restaurar ' + data.users.length + ' usuarios y sus historiales. Lo que exista con el mismo id se reemplaza. ¿Seguir?')) return;
    CORE.store.snapshot('antes de restaurar').catch(function () { return null; }).then(function () {
      return CORE.store.restoreFullBackup(data);
    }).then(function (r) {
      return CORE.store.users();
    }).then(function (users) {
      state.users = users;
      render();
      toast('Respaldo restaurado.', 'sign');
    }).catch(function (e) { toast('No se pudo restaurar: ' + e.message, 'error'); });
  });
}

function elegirArchivo(accept, onText) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { onText(String(reader.result)); };
    reader.onerror = function () { toast('No se pudo leer el archivo.', 'error'); };
    reader.readAsText(file);
  });
  input.click();
}

function importData() {
  elegirArchivo('application/json,.json,text/csv,.csv', function (texto) {
    var limpio = texto.replace(/^\ufeff/, '').trim();
    // ¿CSV o JSON? Se decide por el contenido, no por la extensión.
    if (limpio.charAt(0) === '{') {
      var data;
      try { data = JSON.parse(limpio); } catch (e) { toast('El JSON tiene un error de formato.', 'error'); return; }
      if (!data || !Array.isArray(data.sessions)) { toast('Ese JSON no es una copia de HIERRO.', 'error'); return; }
      if (!confirm('Se reemplazan las sesiones, los récords y el peso de tu usuario. ¿Seguir?')) return;
      CORE.store.snapshot('antes de importar').catch(function () { return null; }).then(function () {
        state.data.sessions = data.sessions;
        state.data.prs = data.prs || {};
        state.data.bodyweight = data.bodyweight || [];
        if (data.prefs) state.data.prefs = Object.assign(state.data.prefs, data.prefs);
        state.data.activeSession = null;
        saveData();
        render();
        toast('Copia importada: ' + data.sessions.length + ' sesiones.', 'sign');
      });
      return;
    }
    // CSV del historial: se suman las sesiones nuevas, sin borrar nada.
    var sesiones = CORE.csv.csvToSessions(limpio);
    if (!sesiones.length) { toast('El CSV no tiene filas de series válidas.', 'error'); return; }
    if (!confirm('Se van a sumar ' + sesiones.length + ' sesiones desde el CSV, sin borrar las que ya tenés. ¿Seguir?')) return;
    CORE.store.snapshot('antes de importar csv').catch(function () { return null; }).then(function () {
      state.data.sessions = sesiones.concat(state.data.sessions);
      saveData();
      render();
      toast('Se sumaron ' + sesiones.length + ' sesiones del CSV.', 'sign');
    });
  });
}

/* Instalación como app (PWA). */
var deferredInstall = null;
window.addEventListener('beforeinstallprompt', function (ev) {
  ev.preventDefault();
  deferredInstall = ev;
  updateInstallButton();
});
$('#btnInstall').addEventListener('click', function () {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  deferredInstall = null;
  this.hidden = true;
});

/* Al volver a la pestaña, el cronómetro se reajusta (los timers del navegador
   se frenan en segundo plano y el reloj debe seguir siendo real). Al salir, se
   fuerza el guardado para no perder el último toque. */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { flushSave(); return; }
  if (Rest.running) Rest.tick();
  updateBand();
  Wake.sync();
});
window.addEventListener('pagehide', flushSave);
window.addEventListener('hashchange', render);

/* ── Arranque ─────────────────────────────────────────────────────────── */
function mostrarCargando() {
  var m = document.getElementById('main');
  if (m) m.innerHTML = '<div class="view"><p class="gate__note">Abriendo la base de datos…</p></div>';
}

/* Un enlace de alta trae la cuenta ya creada en otro dispositivo. Se limpia de
   la barra de direcciones apenas se lee: es una credencial, no un parámetro. */
function leerEnlaceDeAlta() {
  var m = /[#&]alta=([A-Za-z0-9+/=_%-]+)/.exec(location.hash || '');
  if (!m) return;
  var pack = CORE.packs.unpackAccount(decodeURIComponent(m[1]));
  if (!pack) { toast('El enlace de alta está incompleto o dañado.', 'error'); return; }
  state.altaPendiente = pack;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
}

function boot() {
  mostrarCargando();
  leerEnlaceDeAlta();

  CORE.store.open().then(function (info) {
    paso('open:' + info.backend);
    state.migrated = !!info.migrado;
    return CORE.store.users();
  }).then(function (users) {
    paso('users:' + users.length);
    state.users = users;
    return CORE.store.sessionId();
  }).then(function (id) {
    paso('session:' + id);
    var valido = id && state.users.some(function (u) { return u.id === id && !u.disabled; });
    if (valido) {
      return loadAccount(id).then(function () {
        paso('cuenta-cargada');
        if (!location.hash || location.hash === '#/acceso') location.hash = '#/hoy';
      });
    }
    if (!location.hash) location.hash = '#/acceso';
    return null;
  }).then(function () {
    paso('render');
    render();
    if (state.migrated) {
      toast('Tus datos se migraron al formato nuevo. El respaldo anterior quedó intacto.', 'sign');
    }
    // Respaldo automático: uno por día, en silencio.
    if (state.users.length) unRespaldoPorDia().catch(function () {});
    if (state.data && state.data.activeSession) {
      var p = firstPending(state.data.activeSession);
      if (p) updateBand();
      // Si el cronómetro de un ejercicio terminó mientras la app estaba cerrada,
      // al volver avisa igual.
      EjTimer.recuperar();
    }
    readyResolve(true);
    if (window.HIERRO) window.HIERRO.listo = true;   // señal síncrona para pruebas e integraciones
  }).catch(function (e) {
    var m = document.getElementById('main');
    if (m) {
      m.innerHTML = '<div class="view"><div class="alert alert--error"><b>No se pudo abrir la base de datos.</b><br>' +
        esc(e && e.message ? e.message : 'error desconocido') + '</div></div>';
    }
    readyResolve(false);
    if (window.HIERRO) window.HIERRO.listo = 'error';
  });
}
boot();

// Expuesto para depuración y para la prueba de humo.
window.HIERRO = {
  state: state, render: render, plateMath: plateMath, DB: DB, RT: RT, CORE: CORE,
  ready: readyPromise, bootTrace: bootTrace,
  // Lógica derivada: se expone para poder verificarla desde la prueba de humo.
  progression: {
    estimate1RM: estimate1RM, repRange: repRange, exerciseHistory: exerciseHistory,
    prescriptionFor: prescriptionFor, best1RMOf: best1RMOf, strengthSeries: strengthSeries,
    muscleStats: muscleStats, policyFor: policyFor,
  },
  wake: Wake,
  usuarios: {
    crear: crearUsuario, porNombre: usuarioPorNombre, esAdmin: esAdmin, enlace: enlaceDeAlta,
    alta: importarPaqueteAlta, borrar: borrarUsuario, restablecer: restablecerPassword,
  },
  datos: { exportarCsv: exportCsv, respaldoCompleto: exportFullBackup, snapshot: unRespaldoPorDia },
};
})();
