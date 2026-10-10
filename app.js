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
function fmtDayLong(iso) {
  var p = String(iso).split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS[d.getMonth()];
}
function fmtDayShort(iso) {
  var p = String(iso).split('-');
  return (+p[2]) + '/' + (+p[1]);
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
  pendingObjetivo: null,  // elección provisional mientras se crea un perfil
  pendingNivel: null,
  _sheetEntry: null,      // ejercicio cuya hoja de técnica está abierta
  _stamp: null,           // serie recién marcada, para animar el check tras el render
};

function blankData(profile) {
  return {
    profile: profile,
    prefs: { sound: true, vibrate: true, barKg: 20, defaultRest: 90, unit: 'kg' },
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

function startSession(routineKey) {
  var r = routineOf(routineKey);
  if (!r) return;
  // Nunca se descarta una sesión en curso sin preguntar.
  if (state.data.activeSession &&
      !confirm('Tenés una sesión sin terminar. ¿Empezar «' + r.name + '» y descartar la anterior?')) return;
  var session = {
    id: uid(), routineKey: r.key, routineName: r.name,
    objetivo: r.objetivo[0], date: todayISO(), startedAt: Date.now(), finishedAt: null,
    entries: r.items.map(function (it) {
      var ex = exOf(it.ex);
      // La rutina manda; los valores del ejercicio son el respaldo documentado.
      var objetivoReps = it.reps || ex.defaultReps || '10';
      var cantidad = it.sets || ex.defaultSets || 3;
      var reps = firstNumber(objetivoReps) || 10;
      return {
        ex: it.ex, name: ex.name, muscle: ex.muscle, img: ex.id || '', pattern: ex.pattern, load: ex.load,
        unit: repUnitOf(objetivoReps),
        rest: it.rest || ex.defaultRest || 90,
        sets: Array.from({ length: cantidad }, function () {
          return { target: objetivoReps, reps: reps, weight: Number(it.w) || 0, done: false, ts: null, pr: false };
        }),
      };
    }),
  };
  state.data.activeSession = session;
  state.data.lastRoutine = r.key;
  saveData();
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
    '<button class="gate__tab" role="tab" id="tabLogin" aria-controls="panelLogin" aria-selected="' + (hasUsers ? 'true' : 'false') + '" data-act="gate-tab" data-tab="login"' + (hasUsers ? '' : ' disabled') + '>Entrar</button>' +
    '<button class="gate__tab" role="tab" id="tabRegister" aria-controls="panelRegister" aria-selected="' + (!hasUsers ? 'true' : 'false') + '" data-act="gate-tab" data-tab="register">Crear perfil</button>' +
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
      (hasUsers ? '' : '<p class="alert alert--sign">Primera vez en este dispositivo: creá tu perfil acá. Después vas a poder entrar escribiendo tu nombre.</p>') +
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
    tabs + '<div class="gate__panel">' + loginPanel + registerPanel + '</div>' +
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
  var first = r.items.slice(0, 3).map(function (it) { return exOf(it.ex).name; }).join(' · ');
  return '<button class="routine" data-act="start" data-routine="' + r.key + '">' +
    '<span class="routine__head' + (highlight ? ' routine__head--sign' : '') + '">' +
      '<span style="min-width:0"><span class="routine__name">' + esc(r.name) + '</span>' +
      '<span class="routine__meta">' + esc(r.level) + ' · ' + esc(r.duration) + '</span></span>' +
      '<span class="routine__count">' + r.items.length + '</span>' +
    '</span>' +
    '<span class="routine__body">' +
      '<span class="routine__exercises">' + esc(first) + '…</span>' +
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
    '<p class="view__sub">' + st.doneSets + ' de ' + st.totalSets + ' series · ' + fmtNum(toDisplay(st.volume)) + ' ' + unit() + ' de volumen</p>' +
    '</div></div>' +
    '<div class="progress" style="margin-bottom:16px"><span style="transform:scaleX(' + (st.percent / 100) + ')"></span></div>';

  s.entries.forEach(function (e, i) { html += unitCard(e, i); });

  html += '<div style="display:grid;gap:9px;margin-top:16px">' +
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

  return '<section class="unit' + (current ? ' is-active' : '') + (done ? ' is-done' : '') + '">' +
    '<div class="unit__head">' +
      '<button class="unit__picto" data-act="sheet" data-entry="' + i + '" aria-label="Ver la técnica de ' + esc(e.name) + '">' + picto + '</button>' +
      '<div class="unit__id">' +
        '<h2 class="unit__name">' + esc(e.name) + '</h2>' +
        '<div class="unit__meta">' +
          '<span class="unit__muscle">' + esc(e.muscle) + '</span>' +
          '<span class="unit__summary">' + e.sets.length + ' × ' + esc(e.sets[0].target) + ' · ' + e.rest + ' s descanso</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="sets">' + rows + '</div>' +
    '<div class="unit__foot">' +
      '<button class="btn btn--sm" data-act="add-set" data-entry="' + i + '"><i class="fa-solid fa-plus"></i> Agregar serie</button>' +
      '<button class="btn btn--sm btn--ghost" data-act="del-set" data-entry="' + i + '"' + (e.sets.length < 2 ? ' disabled' : '') + '><i class="fa-solid fa-minus"></i> Quitar</button>' +
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

  var list = '<div class="section"><div class="section__head"><h2 class="section__title">Sesiones</h2></div>' +
    d.sessions.map(function (s, i) { return sessionRow(s, i); }).join('') + '</div>';

  return head + board + chart + bwBlock + prBlock + list;
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
      '</div>' +
    '</div></div>' +

    '<div class="section"><div class="section__head"><h2 class="section__title">Instalar en el celular</h2>' +
      '<span class="section__note">' + (enModoApp() ? 'ya estás usando la app instalada' : 'funciona sin conexión') + '</span></div>' +
      (enModoApp()
        ? '<div class="alert alert--sign"><b>Listo:</b> estás usando HIERRO como aplicación instalada. Los datos viven en este dispositivo.</div>'
        : '<div class="alert">' + textoInstalar() + '</div>') +
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
    var scrim = ev.target.closest ? ev.target.closest('[data-close-sheet]') : null;
    if (scrim) closeSheet();
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
      $('[data-form="login"]').hidden = !isLogin;
      $('[data-form="register"]').hidden = isLogin;
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
      startSession(el.getAttribute('data-routine'));
      go('#/entrenar');
      render();
      toast('Sesión iniciada. ¡A cargar la barra!', 'sign');
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

/* Escape cierra la hoja de técnica. */
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape') closeSheet();
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
  if (!document.hidden) updateBand();
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
window.HIERRO = { state: state, Store: Store, render: render, plateMath: plateMath, DB: DB, RT: RT };
})();
