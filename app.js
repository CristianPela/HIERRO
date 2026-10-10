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

/* ═══ 2. ALMACENAMIENTO ═══════════════════════════════════════════════════ */

var K = {
  users: 'hierro.v1.users',
  session: 'hierro.v1.session',
  user: function (id) { return 'hierro.v1.user.' + id; },
};

var Store = {
  get: function (key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  },
  set: function (key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.', 'error'); return false; }
  },
  del: function (key) { try { localStorage.removeItem(key); } catch (e) {} },
};

/* ═══ 3. ESTADO Y SESIONES ════════════════════════════════════════════════ */

var state = {
  users: [],
  account: null,   // cuenta activa (id, name, hash, salt, profile)
  data: null,      // datos del usuario activo
  view: 'hoy',
  filter: null,    // filtro de objetivo en la pantalla de entrenar
  strengthEx: null, // ejercicio elegido en la curva de fuerza estimada
  newSessionDate: todayISO(),  // día que se está por entrenar
  calcWeight: 60,              // peso de la calculadora de discos
  picker: { q: '', muscle: '' }, // estado del selector de ejercicios
  pendingObjetivo: null,  // elección provisional mientras se crea un perfil
  pendingNivel: null,
  _sheetEntry: null,      // ejercicio cuya hoja de técnica está abierta
  _stamp: null,           // serie recién marcada, para animar el check tras el render
};

function defaultPrefs() {
  return {
    sound: true, vibrate: true, barKg: 20, defaultRest: 90, unit: 'kg',
    wake: true,   // mantener la pantalla encendida mientras hay sesión
    prog: true,   // progresión automática de cargas
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
  };
}

function saveData() { if (state.account) Store.set(K.user(state.account.id), state.data); }
function saveUsers() { Store.set(K.users, state.users); }

function loadAccount(id) {
  var acc = null;
  for (var i = 0; i < state.users.length; i++) if (state.users[i].id === id) acc = state.users[i];
  if (!acc) return false;
  state.account = acc;
  state.data = Store.get(K.user(id), null) || blankData(acc.profile);
  if (!state.data.profile) state.data.profile = acc.profile;
  // Las preferencias nuevas se suman a los perfiles que ya existían.
  state.data.prefs = Object.assign(defaultPrefs(), state.data.prefs || {});
  Store.set(K.user(id), state.data);
  Store.set(K.session, id);
  return true;
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

/* ═══ 4. CUENTAS LOCALES ══════════════════════════════════════════════════
   El hash protege el perfil de otro usuario del mismo dispositivo. No es
   seguridad real: los datos viven en el navegador y son legibles. */

function hashPass(pass, salt) {
  var text = salt + '::' + pass;
  if (window.crypto && window.crypto.subtle && window.TextEncoder) {
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  // Respaldo para contextos sin Web Crypto (por ejemplo, abierto como archivo local).
  var h1 = 2166136261, h2 = 5381;
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    h1 = (h1 ^ c) * 16777619 >>> 0;
    h2 = ((h2 << 5) + h2 + c) >>> 0;
  }
  return Promise.resolve('f' + h1.toString(16) + h2.toString(16));
}

function register(ev) {
  ev.preventDefault();
  var name = $('#regName').value.trim();
  var pass = $('#regPass').value;
  var peso = parseFloat($('#regWeight').value) || 70;
  var altura = parseFloat($('#regHeight').value) || 0;
  var objetivo = state.pendingObjetivo || 'hipertrofia';
  var nivel = state.pendingNivel || 'Principiante';
  if (name.length < 2) return formError('#regError', 'Escribí un nombre de al menos 2 letras.');
  if (pass.length < 4) return formError('#regError', 'La contraseña necesita al menos 4 caracteres.');
  if (state.users.some(function (u) { return u.name.toLowerCase() === name.toLowerCase(); })) {
    return formError('#regError', 'Ya existe un perfil con ese nombre en este dispositivo.');
  }

  var salt = uid() + uid();
  hashPass(pass, salt).then(function (hash) {
    var account = {
      id: uid(), name: name, salt: salt, hash: hash, createdAt: Date.now(),
      profile: { name: name, weightKg: peso, heightCm: altura, objetivo: objetivo, level: nivel, days: 3 },
    };
    state.users.push(account);
    saveUsers();
    loadAccount(account.id);
    // La próxima persona que cree un perfil en este dispositivo arranca de cero.
    state.pendingObjetivo = null;
    state.pendingNivel = null;
    go('#/hoy');
    toast('Perfil creado. ¡A entrenar!', 'sign');
  });
}

function login(ev) {
  ev.preventDefault();
  var typed = ($('#loginUser').value || '').trim();
  var pass = $('#loginPass').value;
  if (!typed) return formError('#loginError', 'Escribí el nombre de tu perfil.');
  // Se acepta el nombre (como se escribe) o el id interno, por compatibilidad.
  var acc = state.users.filter(function (u) {
    return u.id === typed || u.name.toLowerCase() === typed.toLowerCase();
  })[0];
  if (!acc) return formError('#loginError', 'En este dispositivo no hay ningún perfil con ese nombre.');
  hashPass(pass, acc.salt).then(function (hash) {
    if (hash !== acc.hash) return formError('#loginError', 'Contraseña incorrecta.');
    loadAccount(acc.id);
    go('#/hoy');
  });
}

/* Cambio de contraseña: la cuenta es local, así que el usuario manda. */
function changePassword(ev) {
  ev.preventDefault();
  var a = $('#newPass').value;
  var b = $('#newPass2').value;
  var err = $('#passError');
  err.hidden = true;
  if (a.length < 4) { err.textContent = 'La contraseña necesita al menos 4 caracteres.'; err.hidden = false; return; }
  if (a !== b) { err.textContent = 'Las dos contraseñas no coinciden.'; err.hidden = false; return; }
  hashPass(a, state.account.salt).then(function (hash) {
    state.account.hash = hash;
    saveUsers();
    $('#passForm').hidden = true;
    $('#newPass').value = '';
    $('#newPass2').value = '';
    toast('Contraseña actualizada. Usala la próxima vez que entres.', 'sign');
  });
}

function logout() {
  state.account = null;
  state.data = null;
  state._sheetEntry = null;
  Rest.stop();
  Store.del(K.session);
  go('#/acceso');
  toast('Sesión cerrada.');
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

/* Pulso sonoro + vibración al terminar el descanso. */
var audioCtx = null;
function beep() {
  if (!state.data || !state.data.prefs.sound) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var t = audioCtx.currentTime;
    [0, 0.18].forEach(function (offset, i) {
      var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = i ? 1180 : 880;
      gain.gain.setValueAtTime(0.0001, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, t + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.14);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(t + offset); osc.stop(t + offset + 0.16);
    });
  } catch (e) { /* sin audio: no es crítico */ }
}
function announceRestOver() {
  beep();
  if (state.data && state.data.prefs.vibrate && navigator.vibrate) navigator.vibrate([120, 70, 120]);
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

/* ── 8.1 Acceso ───────────────────────────────────────────────────────── */

function viewGate() {
  var hasUsers = state.users.length > 0;
  var tabs = '<div class="gate__tabs" role="tablist" aria-label="Acceso">' +
    '<button class="gate__tab" role="tab" id="tabLogin" aria-controls="panelLogin" aria-selected="true" data-act="gate-tab" data-tab="login">Entrar</button>' +
    '<button class="gate__tab" role="tab" id="tabRegister" aria-controls="panelRegister" aria-selected="false" data-act="gate-tab" data-tab="register">Crear perfil</button>' +
  '</div>';

  var loginPanel =
    '<form class="form" data-form="login" role="tabpanel" id="panelLogin" aria-labelledby="tabLogin" ' + (hasUsers ? '' : 'hidden') + '>' +
      '<div class="field">' +
        '<label class="field__label" for="loginUser">Tu nombre de perfil</label>' +
        '<input class="input" id="loginUser" list="loginPerfiles" autocomplete="username" placeholder="Escribí tu nombre">' +
        '<datalist id="loginPerfiles">' +
          state.users.map(function (u) { return '<option value="' + esc(u.name) + '"></option>'; }).join('') +
        '</datalist>' +
        '<span class="field__hint">Escribí tu nombre o elegilo de la lista de este dispositivo.</span>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label" for="loginPass">Contraseña</label>' +
        '<input class="input" id="loginPass" type="password" autocomplete="current-password" required>' +
      '</div>' +
      '<p class="alert alert--error" id="loginError" hidden></p>' +
      '<button class="btn btn--sign btn--block" type="submit"><i class="fa-solid fa-arrow-right-to-bracket"></i> Entrar</button>' +
      '<p class="gate__note">¿Primera vez en este navegador? ' +
        '<button type="button" class="link-btn" data-act="gate-tab" data-tab="register">Creá tu perfil acá</button>.</p>' +
      '<p class="gate__note">Las cuentas viven en este navegador. No se envían a ningún servidor.</p>' +
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

  var registerPanel =
    '<form class="form" data-form="register" role="tabpanel" id="panelRegister" aria-labelledby="tabRegister" ' + (hasUsers ? 'hidden' : '') + '>' +
      (hasUsers ? '' : '<h2 class="gate__h2">Creá tu perfil</h2><p class="gate__note">Es la primera vez en este dispositivo. Elegí un nombre y una contraseña; con eso entrás las próximas veces.</p>') +
      '<div class="field"><label class="field__label" for="regName">Tu nombre</label>' +
        '<input class="input" id="regName" autocomplete="name" required></div>' +
      '<div class="field"><label class="field__label" for="regPass">Contraseña</label>' +
        '<input class="input" id="regPass" type="password" autocomplete="new-password" required>' +
        '<span class="field__hint">Separa tu perfil del de otras personas en este dispositivo.</span></div>' +
      '<div class="grid-2">' +
        '<div class="field"><label class="field__label" for="regWeight">Peso (kg)</label>' +
          '<input class="input" id="regWeight" type="text" inputmode="decimal" value="75"></div>' +
        '<div class="field"><label class="field__label" for="regHeight">Altura (cm)</label>' +
          '<input class="input" id="regHeight" type="text" inputmode="numeric" value="175"></div>' +
      '</div>' +
      '<div class="field"><span class="field__label" id="lblObjetivo">Objetivo principal</span><div class="choice" role="group" aria-labelledby="lblObjetivo">' + objetivos + '</div></div>' +
      '<div class="field"><span class="field__label" id="lblNivel">Experiencia</span><div class="choice" role="group" aria-labelledby="lblNivel">' + niveles + '</div></div>' +
      '<p class="alert alert--error" id="regError" hidden></p>' +
      '<button class="btn btn--sign btn--block" type="submit"><i class="fa-solid fa-user-plus"></i> Crear perfil y empezar</button>' +
    '</form>';

  return '<div class="gate">' +
    '<div>' +
      '<h1 class="gate__word">HIERRO</h1>' +
      '<p class="gate__claim">Registrá cada serie en tres toques. La app te dice qué discos cargar en cada lado de la barra.</p>' +
    '</div>' +
    '<div class="gate__band"><i class="fa-solid fa-dumbbell"></i><span>Tu progreso queda en este dispositivo</span></div>' +
    (hasUsers
      ? tabs + '<div class="gate__panel">' + loginPanel + registerPanel + '</div>'
      : '<div class="gate__panel">' + registerPanel + '</div>') +
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

function routinePicker() {
  var todas = state.filter === 'todas';
  var obj = todas ? '' : (state.filter || state.data.profile.objetivo);
  var chips = Object.keys(RT.objetivos).map(function (o) {
    return '<button class="chip" data-act="filter" data-value="' + o + '" aria-pressed="' + (!todas && obj === o) + '">' + esc(RT.objetivos[o].label) + '</button>';
  }).join('') + '<button class="chip" data-act="filter" data-value="" aria-pressed="' + todas + '">Todas</button>';

  var list = routinesFor(obj).map(function (r) { return routineCard(r, false); }).join('');

  return '<div class="view__head"><div>' +
      '<h1 class="view__title">Elegí tu rutina</h1>' +
      '<p class="view__sub">' + esc((RT.objetivos[obj] && RT.objetivos[obj].desc) || 'Todas las rutinas disponibles, ordenadas por objetivo y nivel.') + '</p>' +
    '</div></div>' +

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
    '</div>' +

    '<div class="filters">' + chips + '</div>' + list;
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

function viewProfile() {
  var d = state.data, p = d.profile, prefs = d.prefs;
  var objetivos = Object.keys(RT.objetivos).map(function (o) {
    return '<button type="button" class="chip" data-act="set-objetivo" data-value="' + o + '" aria-pressed="' + (p.objetivo === o) + '">' + esc(RT.objetivos[o].label) + '</button>';
  }).join('');
  var niveles = ['Principiante', 'Intermedio', 'Avanzado'].map(function (n) {
    return '<button type="button" class="chip" data-act="set-nivel" data-value="' + n + '" aria-pressed="' + (p.level === n) + '">' + n + '</button>';
  }).join('');

  return '<div class="view__head"><div><h1 class="view__title">Perfil</h1>' +
    '<p class="view__sub">' + esc(state.account.name) + ' · ' + d.sessions.length + ' sesiones registradas</p></div></div>' +

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
      '<div class="filters" style="margin:0">' +
        '<button class="chip" data-act="toggle-sound" aria-pressed="' + prefs.sound + '">Aviso sonoro</button>' +
        '<button class="chip" data-act="toggle-vibrate" aria-pressed="' + prefs.vibrate + '">Vibración</button>' +
        '<button class="chip" data-act="toggle-wake" aria-pressed="' + prefs.wake + '">Pantalla encendida</button>' +
        '<button class="chip" data-act="toggle-prog" aria-pressed="' + prefs.prog + '">Progresión automática</button>' +
      '</div>' +
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

    '<div class="section"><div class="section__head"><h2 class="section__title">Datos</h2><span class="section__note">todo queda en este navegador</span></div>' +
      '<div class="rows">' +
        '<button class="row-link" data-act="pass-toggle"><span class="row-link__icon"><i class="fa-solid fa-key"></i></span><span class="row-link__text"><span class="row-link__name">Cambiar contraseña</span><span class="row-link__desc">Solo separa perfiles en este dispositivo</span></span></button>' +
        '<button class="row-link" data-act="export"><span class="row-link__icon"><i class="fa-solid fa-file-export"></i></span><span class="row-link__text"><span class="row-link__name">Exportar copia</span><span class="row-link__desc">Descarga un archivo JSON con tu historial</span></span></button>' +
        '<button class="row-link" data-act="import"><span class="row-link__icon"><i class="fa-solid fa-file-import"></i></span><span class="row-link__text"><span class="row-link__name">Importar copia</span><span class="row-link__desc">Reemplaza los datos de este perfil</span></span></button>' +
        '<button class="row-link" data-act="wipe"><span class="row-link__icon"><i class="fa-solid fa-trash"></i></span><span class="row-link__text"><span class="row-link__name">Borrar mis datos</span><span class="row-link__desc">Sesiones, récords y peso corporal</span></span></button>' +
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
  clock.hidden = !resting;
  progress.hidden = !resting;
  addBtn.hidden = !resting;
  skipBtn.hidden = !resting;
  if (resting) {
    $('#clockValue').textContent = fmtClock((Rest.endsAt - Date.now()) / 1000);
    progress.firstElementChild.style.transform = 'scaleX(' + clamp((Rest.endsAt - Date.now()) / 1000 / Rest.total, 0, 1) + ')';
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
    case 'import': importData(); break;

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
    if (el.id === 'pfUnit') state.data.prefs.unit = el.value;
    if (el.id === 'pfBar') state.data.prefs.barKg = clamp(parseFloat(el.value) || 20, 5, 30);
    if (el.id === 'pfRest') state.data.prefs.defaultRest = clamp(parseInt(el.value, 10) || 90, 15, 600);
    if (el.id === 'pfWeight') {
      var pv = parseFloat(String(el.value).replace(',', '.'));
      if (!isNaN(pv)) state.data.profile.weightKg = Math.round(toKg(pv) * 10) / 10;
    }
    if (el.id === 'pfHeight') state.data.profile.heightCm = parseFloat(el.value) || 0;
    saveData();
    if (el.id === 'pfUnit') render();
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
  if (form === 'register') register(ev);
  else if (form === 'login') login(ev);
  else if (form === 'password') changePassword(ev);
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
function exportData() {
  var payload = {
    app: 'hierro', version: DB.meta.version, exportedAt: new Date().toISOString(),
    profile: state.data.profile, prefs: state.data.prefs, sessions: state.data.sessions,
    prs: state.data.prs, bodyweight: state.data.bodyweight,
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hierro-' + todayISO() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  toast('Copia exportada.', 'sign');
}

function importData() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        if (!data || !Array.isArray(data.sessions)) throw new Error('formato');
        if (!confirm('Se reemplazan las sesiones, récords y peso de este perfil. ¿Seguir?')) return;
        state.data.sessions = data.sessions;
        state.data.prs = data.prs || {};
        state.data.bodyweight = data.bodyweight || [];
        if (data.prefs) state.data.prefs = Object.assign(state.data.prefs, data.prefs);
        state.data.activeSession = null;
        saveData(); render();
        toast('Copia importada: ' + data.sessions.length + ' sesiones.', 'sign');
      } catch (e) {
        toast('No pudimos leer el archivo. Tiene que ser la copia JSON de HIERRO.', 'error');
      }
    };
    reader.readAsText(file);
  });
  input.click();
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
   se frenan en segundo plano y el reloj debe seguir siendo real). */
document.addEventListener('visibilitychange', function () {
  if (!document.hidden && Rest.running) Rest.tick();
  if (!document.hidden) { updateBand(); Wake.sync(); }
});
window.addEventListener('hashchange', render);

/* ── Arranque ─────────────────────────────────────────────────────────── */
function boot() {
  state.users = Store.get(K.users, []);
  var last = Store.get(K.session, null);
  if (last && state.users.some(function (u) { return u.id === last; })) {
    loadAccount(last);
    if (!location.hash || location.hash === '#/acceso') location.hash = '#/hoy';
  } else if (!location.hash) {
    location.hash = '#/acceso';
  }
  render();
  // Si había una sesión activa con descanso en curso, se retoma con la hora real.
  if (state.data && state.data.activeSession) {
    var p = firstPending(state.data.activeSession);
    if (p) updateBand();
  }
}
boot();

// Expuesto para depuración desde la consola del navegador.
window.HIERRO = {
  state: state, Store: Store, render: render, plateMath: plateMath, DB: DB, RT: RT,
  // Lógica derivada: se expone para poder verificarla desde la prueba de humo.
  progression: {
    estimate1RM: estimate1RM, repRange: repRange, exerciseHistory: exerciseHistory,
    prescriptionFor: prescriptionFor, best1RMOf: best1RMOf, strengthSeries: strengthSeries,
    muscleStats: muscleStats, policyFor: policyFor,
  },
  wake: Wake,
};
})();
