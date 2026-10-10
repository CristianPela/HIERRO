/* ═══════════════════════════════════════════════════════════════════════════
   HIERRO · núcleo: almacenamiento, credenciales, formatos y migraciones
   ───────────────────────────────────────────────────────────────────────────
   Se carga ANTES de app.js. No depende de nada del resto de la app y también
   se puede cargar en Node (ver tests/core.test.mjs) porque todo lo que no sea
   IndexedDB es puro.

   Decisiones que importan:
     · Almacenamiento principal: IndexedDB. Si el navegador no lo permite
       (modo privado viejo, permisos raros) cae a localStorage con la MISMA
       interfaz: la app no se entera.
     · Credenciales: PBKDF2-SHA256 con 150.000 iteraciones y sal por usuario.
       Nunca se guarda la contraseña, solo su derivación.
     · Migración: los datos v1 de localStorage NUNCA se borran. Se copian a
       IndexedDB y quedan como respaldo. Volver atrás es posible.
     · El esquema está versionado (SCHEMA_VERSION) y cada documento se valida
       antes de guardarse, así un dato corrupto no entra.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var SCHEMA_VERSION = 2;
  var DB_NAME = 'hierro';
  var DB_VERSION = 2;   // v1 creaba 'meta' sin clave; v2 la recrea con keyPath
  var PBKDF2_ITERATIONS = 150000;
  var MAX_BACKUPS = 8;

  /* Claves del formato viejo (v1). No se borran nunca: son el respaldo. */
  var LEGACY = {
    users: 'hierro.v1.users',
    session: 'hierro.v1.session',
    userPrefix: 'hierro.v1.user.',
  };

  /* ── Codificación ────────────────────────────────────────────────────── */

  function bytesToBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    if (typeof btoa === 'function') return btoa(s);
    return Buffer.from(s, 'binary').toString('base64');
  }

  function base64ToBytes(b64) {
    var bin;
    if (typeof atob === 'function') bin = atob(b64);
    else bin = Buffer.from(b64, 'base64').toString('binary');
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }

  function utf8(text) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text);
    return Uint8Array.from(Buffer.from(text, 'utf8'));
  }

  function randomSalt() {
    var bytes = new Uint8Array(16);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return bytesToBase64(bytes);
  }

  /* ── Credenciales ────────────────────────────────────────────────────── */

  function hasWebCrypto() {
    return !!(root.crypto && root.crypto.subtle && root.crypto.subtle.deriveBits);
  }

  /* Derivación de la contraseña. Devuelve siempre una cadena comparable. */
  function hashPassword(password, saltB64, iterations) {
    if (hasWebCrypto()) {
      var iter = Number(iterations) || PBKDF2_ITERATIONS;
      return root.crypto.subtle.importKey('raw', utf8(String(password)), 'PBKDF2', false, ['deriveBits'])
        .then(function (key) {
          return root.crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations: iter, hash: 'SHA-256' },
            key, 256
          );
        })
        .then(function (bits) { return 'pbkdf2$' + iter + '$' + bytesToBase64(new Uint8Array(bits)); });
    }
    /* Respaldo sin WebCrypto: mejor que nada, y queda marcado como tal. */
    var text = String(saltB64) + '::' + String(password);
    var h1 = 2166136261, h2 = 5381;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      h1 = (h1 ^ c) * 16777619 >>> 0;
      h2 = ((h2 << 5) + h2 + c) >>> 0;
    }
    return Promise.resolve('weak$' + h1.toString(16) + h2.toString(16));
  }

  /* Credencial nueva para un usuario recién dado de alta. */
  function newCredential(password) {
    var salt = randomSalt();
    return hashPassword(password, salt, PBKDF2_ITERATIONS).then(function (hash) {
      return { salt: salt, iterations: PBKDF2_ITERATIONS, hash: hash };
    });
  }

  function verifyCredential(password, user) {
    if (!user || !user.salt) return Promise.resolve(false);
    return hashPassword(password, user.salt, user.iterations).then(function (hash) {
      return hash === user.hash;
    });
  }

  /* Las cuentas del formato viejo usaban SHA-256 de una pasada. Se aceptan una
     vez y se actualizan a PBKDF2 sin que el usuario haga nada. */
  function verifyLegacy(password, user) {
    if (!user || !user.salt || !user.hash) return Promise.resolve(false);
    var text = user.salt + '::' + String(password);
    if (root.crypto && root.crypto.subtle && root.crypto.subtle.digest) {
      return root.crypto.subtle.digest('SHA-256', utf8(text)).then(function (buf) {
        return bytesToHex(new Uint8Array(buf)) === user.hash;
      });
    }
    return Promise.resolve(false);
  }

  /* ── Paquete de alta ─────────────────────────────────────────────────────
     Permite que el administrador dé de alta a alguien en OTRO dispositivo sin
     backend: viaja el nombre, la sal y la derivación de la contraseña (nunca
     la contraseña). El enlace es tan sensible como la cuenta: hay que tratarlo
     como una credencial.                                                            */

  function packAccount(user) {
    var payload = {
      v: 1, name: user.name, salt: user.salt, hash: user.hash, iterations: user.iterations,
      role: user.role || 'user', profile: user.profile || null, createdAt: user.createdAt || Date.now(),
    };
    return bytesToBase64(utf8(JSON.stringify(payload)));
  }

  function unpackAccount(code) {
    try {
      var text = (typeof atob === 'function' ? atob(code) : Buffer.from(code, 'base64').toString('binary'));
      var text8 = decodeURIComponent(escape(text));
      var data = JSON.parse(text8);
      if (!data || data.v !== 1 || !data.name || !data.hash) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  /* ── Validación de documentos ────────────────────────────────────────────
     Nada corrupto entra a la base: si un documento viene mal, se normaliza. */

  function ensureArray(v) { return Array.isArray(v) ? v : []; }
  function ensureObject(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }

  function validateDocument(doc, userId) {
    var d = ensureObject(doc);
    return {
      userId: userId,
      schema: SCHEMA_VERSION,
      savedAt: Date.now(),
      prefs: ensureObject(d.prefs),
      sessions: ensureArray(d.sessions).filter(function (s) { return s && typeof s === 'object'; }),
      prs: ensureObject(d.prs),
      bodyweight: ensureArray(d.bodyweight),
      activeSession: d.activeSession && typeof d.activeSession === 'object' ? d.activeSession : null,
      lastRoutine: d.lastRoutine || null,
      customExercises: ensureArray(d.customExercises),
    };
  }

  function validateUser(user) {
    if (!user || !user.id || !user.name) return null;
    return {
      id: String(user.id),
      name: String(user.name),
      role: user.role === 'admin' ? 'admin' : 'user',
      salt: user.salt || '',
      hash: user.hash || '',
      iterations: Number(user.iterations) || 0,
      createdAt: Number(user.createdAt) || Date.now(),
      lastLogin: user.lastLogin || null,
      disabled: !!user.disabled,
      profile: user.profile && typeof user.profile === 'object' ? user.profile : null,
    };
  }

  /* ── Migración v1 → v2 ───────────────────────────────────────────────────
     Función pura: recibe lo que había en localStorage y devuelve el modelo
     nuevo. No escribe ni borra nada; de eso se encarga la base. */

  function migrateV1(legacyUsers, legacyDocs) {
    var users = [], docs = [];
    ensureArray(legacyUsers).forEach(function (u, i) {
      var nuevo = validateUser({
        id: u.id, name: u.name,
        role: i === 0 ? 'admin' : 'user',      // el primero creado queda como administrador
        salt: u.salt, hash: u.hash, iterations: 0,   // 0 = derivación vieja, se actualiza al entrar
        createdAt: u.createdAt, profile: u.profile,
      });
      if (nuevo) users.push(nuevo);
      var d = (legacyDocs || {})[u.id] || {};
      docs.push(validateDocument(d, u.id));
    });
    return { users: users, documents: docs, migratedAt: Date.now(), from: 'v1', to: SCHEMA_VERSION };
  }

  /* ── CSV ─────────────────────────────────────────────────────────────────
     Una fila por serie efectiva: es el formato que se abre en Excel y el que
     permite llevarse el historial a cualquier lado.                                */

  var CSV_HEAD = ['fecha', 'rutina', 'ejercicio', 'musculo', 'serie', 'reps', 'kg', 'volumen_kg', 'objetivo'];

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function sessionsToCsv(sessions, unitLabel) {
    var rows = [CSV_HEAD.join(',')];
    ensureArray(sessions).slice().reverse().forEach(function (s) {
      ensureArray(s.entries).forEach(function (e) {
        ensureArray(e.sets).forEach(function (st, i) {
          if (!st || !st.done) return;
          var kg = Number(st.weight) || 0;
          var reps = Number(st.reps) || 0;
          rows.push([
            s.date, s.routineName || '', e.name || '', e.muscle || '', i + 1,
            reps, kg, Math.round(kg * reps * 100) / 100, st.target || st.goal || '',
          ].map(csvCell).join(','));
        });
      });
    });
    return rows.join('\r\n');
  }

  /* Lee un CSV con encabezado. Solo se usa para importar lo que exportamos. */
  function parseCsvLine(line) {
    var out = [], cur = '', quoted = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }

  function parseCsv(text) {
    var lines = String(text || '').split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return { head: [], rows: [] };
    var head = parseCsvLine(lines[0]);
    var rows = lines.slice(1).map(parseCsvLine).map(function (cells) {
      var obj = {};
      head.forEach(function (h, i) { obj[h] = cells[i] == null ? '' : cells[i]; });
      return obj;
    });
    return { head: head, rows: rows };
  }

  /* Reconstruye sesiones a partir del CSV exportado. Se agrupa por fecha+rutina. */
  function csvToSessions(text) {
    var parsed = parseCsv(text);
    var porSesion = {};
    parsed.rows.forEach(function (r) {
      if (!r.fecha || !r.ejercicio) return;
      var clave = r.fecha + '|' + (r.rutina || '');
      var ses = porSesion[clave] || (porSesion[clave] = {
        id: 'csv-' + clave, routineName: r.rutina || 'Importado', date: r.fecha,
        entries: [], origen: 'csv',
      });
      var entry = null;
      for (var i = 0; i < ses.entries.length; i++) if (ses.entries[i].name === r.ejercicio) entry = ses.entries[i];
      if (!entry) {
        entry = { ex: null, name: r.ejercicio, muscle: r.musculo || '', sets: [] };
        ses.entries.push(entry);
      }
      entry.sets.push({
        target: r.objetivo || '', reps: Number(r.reps) || 0, weight: Number(r.kg) || 0,
        done: true, ts: null, pr: false,
      });
    });
    return Object.keys(porSesion).map(function (k) { return porSesion[k]; })
      .map(function (s) { s.startedAt = new Date(s.date + 'T12:00:00').getTime(); s.finishedAt = s.startedAt; return s; });
  }

  /* ── Almacenamiento ──────────────────────────────────────────────────────
     Índice por backend. La app usa siempre la misma interfaz asíncrona.            */

  var store = { backend: 'none', db: null };
  /* Traza corta de operaciones: sirve para diagnosticar en el dispositivo del
     usuario sin abrir herramientas de desarrollo. */
  var trace = [];
  function log(ev, det) {
    trace.push(ev + (det ? '[' + det + ']' : ''));
    if (trace.length > 40) trace.shift();
  }

  function openIdb() {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) return reject(new Error('sin indexedDB'));
      var req = root.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        // 'meta' guarda pares clave/valor: necesita keyPath para poder escribir.
        if (db.objectStoreNames.contains('meta')) {
          var metaVieja = req.transaction.objectStore('meta');
          if (!metaVieja.keyPath) db.deleteObjectStore('meta');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('data')) db.createObjectStore('data', { keyPath: 'userId' });
        if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('no se pudo abrir la base')); };
    });
  }

  function tx(db, names, mode, fn) {
    return new Promise(function (resolve, reject) {
      var t;
      try { t = db.transaction(names, mode); }
      catch (e) { log('tx-abrir-error', String(e && e.name)); reject(e); return; }
      var result;
      t.oncomplete = function () { log('tx-ok', names + '/' + mode); resolve(result); };
      t.onerror = function () { log('tx-error', String(t.error && t.error.name)); reject(t.error); };
      t.onabort = function () { log('tx-abort', String(t.error && t.error.name)); reject(t.error || new Error('transacción abortada')); };
      try { result = fn(t); }
      catch (e) { log('tx-fn-error', String(e && e.name)); reject(e); }
    });
  }

  function idbGet(storeName, key) {
    return tx(store.db, [storeName], 'readonly', function (t) {
      var out = { value: null };
      t.objectStore(storeName).get(key).onsuccess = function (e) { out.value = e.target.result || null; };
      return out;
    }).then(function (o) { return o.value; });
  }

  function idbGetAll(storeName) {
    return tx(store.db, [storeName], 'readonly', function (t) {
      var out = { value: [] };
      t.objectStore(storeName).getAll().onsuccess = function (e) { out.value = e.target.result || []; };
      return out;
    }).then(function (o) { return o.value; });
  }

  function idbPut(storeName, value) {
    return tx(store.db, [storeName], 'readwrite', function (t) { t.objectStore(storeName).put(value); });
  }

  function idbDel(storeName, key) {
    return tx(store.db, [storeName], 'readwrite', function (t) { t.objectStore(storeName).delete(key); });
  }

  function lsGet(key, fallback) {
    try { var raw = root.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function lsPut(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function lsDel(key) { try { root.localStorage.removeItem(key); } catch (e) {} }

  function readLegacy() {
    if (!root.localStorage) return null;
    var users = lsGet(LEGACY.users, null);
    if (!Array.isArray(users) || !users.length) return null;
    var docs = {};
    users.forEach(function (u) { docs[u.id] = lsGet(LEGACY.userPrefix + u.id, null); });
    return { users: users, session: lsGet(LEGACY.session, null), docs: docs };
  }

  /* Interfaz pública del almacenamiento. */
  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    PBKDF2_ITERATIONS: PBKDF2_ITERATIONS,
    backend: function () { return store.backend; },

    open: function () {
      return openIdb().then(function (db) {
        store.db = db;
        store.backend = 'idb';
        return migrarSiHaceFalta();
      }).catch(function () {
        store.backend = 'localStorage';
        return Promise.resolve({ migrado: false, backend: 'localStorage' });
      });
    },

    /* Usuarios ------------------------------------------------------------ */
    users: function () {
      if (store.backend === 'idb') return idbGetAll('users').then(function (list) { return list.map(validateUser).filter(Boolean); });
      return Promise.resolve((lsGet(LEGACY.users, []) || []).map(validateUser).filter(Boolean));
    },
    saveUser: function (user) {
      var u = validateUser(user);
      if (!u) { log('saveUser-invalido'); return Promise.reject(new Error('usuario inválido')); }
      log('saveUser', u.name);
      if (store.backend === 'idb') return idbPut('users', u).then(function () { return u; });
      var list = (lsGet(LEGACY.users, []) || []);
      var i = list.findIndex(function (x) { return x.id === u.id; });
      if (i === -1) list.push(u); else list[i] = Object.assign(list[i], u);
      lsPut(LEGACY.users, list);
      return Promise.resolve(u);
    },
    deleteUser: function (id) {
      if (store.backend === 'idb') {
        return Promise.all([idbDel('users', id), idbDel('data', id)]).then(function () { return true; });
      }
      lsPut(LEGACY.users, (lsGet(LEGACY.users, []) || []).filter(function (u) { return u.id !== id; }));
      lsDel(LEGACY.userPrefix + id);
      return Promise.resolve(true);
    },

    /* Datos de entrenamiento ---------------------------------------------- */
    document: function (userId) {
      if (store.backend === 'idb') return idbGet('data', userId);
      return Promise.resolve(lsGet(LEGACY.userPrefix + userId, null));
    },
    saveDocument: function (doc) {
      var d = validateDocument(doc, doc.userId);
      if (store.backend === 'idb') return idbPut('data', d).then(function () { return d; });
      lsPut(LEGACY.userPrefix + d.userId, d);
      return Promise.resolve(d);
    },

    /* Sesión activa -------------------------------------------------------- */
    sessionId: function () {
      if (store.backend === 'idb') {
        return idbGet('meta', 'sessionId').then(function (registro) {
          return registro && registro.value !== undefined ? registro.value : null;
        });
      }
      return Promise.resolve(lsGet(LEGACY.session, null));
    },
    setSessionId: function (id) {
      if (store.backend === 'idb') return idbPut('meta', { key: 'sessionId', value: id }).then(function () { return id; });
      lsPut(LEGACY.session, id);
      return Promise.resolve(id);
    },

    /* Respaldos automáticos ------------------------------------------------ */
    snapshot: function (label) {
      if (store.backend !== 'idb') return Promise.resolve(null);
      return Promise.all([idbGetAll('users'), idbGetAll('data')]).then(function (r) {
        var snap = { id: 'bk-' + Date.now(), at: Date.now(), label: label || 'automático', users: r[0], documents: r[1] };
        return idbPut('backups', snap).then(function () {
          return idbGetAll('backups');
        }).then(function (all) {
          all.sort(function (a, b) { return a.at - b.at; });
          var sobrantes = all.slice(0, Math.max(0, all.length - MAX_BACKUPS));
          return Promise.all(sobrantes.map(function (b) { return idbDel('backups', b.id); })).then(function () { return snap; });
        });
      });
    },
    backups: function () {
      if (store.backend !== 'idb') return Promise.resolve([]);
      return idbGetAll('backups').then(function (list) { return list.sort(function (a, b) { return b.at - a.at; }); });
    },
    restoreSnapshot: function (id) {
      if (store.backend !== 'idb') return Promise.reject(new Error('sin respaldos en este modo'));
      return idbGet('backups', id).then(function (snap) {
        if (!snap) throw new Error('respaldo inexistente');
        return Promise.all(snap.users.map(function (u) { return idbPut('users', u); }))
          .then(function () { return Promise.all(snap.documents.map(function (d) { return idbPut('data', d); })); })
          .then(function () { return { usuarios: snap.users.length, documentos: snap.documents.length, at: snap.at }; });
      });
    },

    /* Respaldo completo del dispositivo (JSON) ----------------------------- */
    fullBackup: function () {
      var usersP = this.users(), docsP = store.backend === 'idb' ? idbGetAll('data') : Promise.resolve(null);
      return Promise.all([usersP, docsP]).then(function (r) {
        var docs = r[1];
        if (!docs) {
          docs = r[0].map(function (u) { return lsGet(LEGACY.userPrefix + u.id, null); }).filter(Boolean);
        }
        return {
          app: 'hierro', kind: 'respaldo-completo', schema: SCHEMA_VERSION,
          exportedAt: new Date().toISOString(), users: r[0], documents: docs,
        };
      });
    },
    restoreFullBackup: function (payload) {
      if (!payload || !Array.isArray(payload.users)) return Promise.reject(new Error('respaldo inválido'));
      var users = payload.users.map(validateUser).filter(Boolean);
      var docs = (payload.documents || []).map(function (d) { return validateDocument(d, d.userId); });
      var guardarU = users.map(function (u) { return api.saveUser(u); });
      var guardarD = docs.map(function (d) { return api.saveDocument(d); });
      return Promise.all(guardarU.concat(guardarD)).then(function () {
        return { usuarios: users.length, documentos: docs.length };
      });
    },

    /* Diagnóstico ---------------------------------------------------------- */
    close: function () {
      if (store.db) { try { store.db.close(); } catch (e) {} store.db = null; }
    },
    /* Vacía la base sin borrarla. Borrar la base entera deja una operación
       pendiente que bloquea la próxima apertura; vaciar las tablas no. */
    reset: function () {
      if (store.backend !== 'idb') {
        try { root.localStorage.clear(); } catch (e) {}
        return Promise.resolve(true);
      }
      return tx(store.db, ['users', 'data', 'backups', 'meta'], 'readwrite', function (t) {
        t.objectStore('users').clear();
        t.objectStore('data').clear();
        t.objectStore('backups').clear();
        t.objectStore('meta').clear();
      }).then(function () { return true; });
    },
    info: function () {
      return {
        backend: store.backend, schema: SCHEMA_VERSION,
        legacyPresente: !!readLegacy(),
        dbName: DB_NAME, dbVersion: DB_VERSION,
      };
    },
  };

  /* Primera apertura: si hay datos del formato viejo, se copian a IndexedDB
     sin borrar nada de localStorage. */
  function migrarSiHaceFalta() {
    return idbGet('meta', 'schema').then(function (schema) {
      if (schema && schema.value >= SCHEMA_VERSION) return { migrado: false, backend: 'idb' };
      var legacy = readLegacy();
      var tareas = [];
      if (legacy) {
        var migrado = migrateV1(legacy.users, legacy.docs);
        migrado.users.forEach(function (u) { tareas.push(idbPut('users', u)); });
        migrado.documents.forEach(function (d) { tareas.push(idbPut('data', d)); });
        if (legacy.session) tareas.push(idbPut('meta', { key: 'sessionId', value: legacy.session }));
      }
      tareas.push(idbPut('meta', {
        key: 'schema', value: SCHEMA_VERSION,
        migratedAt: legacy ? Date.now() : null, from: legacy ? 'v1' : null,
      }));
      return Promise.all(tareas).then(function () {
        return { migrado: !!legacy, backend: 'idb' };
      });
    });
  }

  root.HIERRO_CORE = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    PBKDF2_ITERATIONS: PBKDF2_ITERATIONS,
    store: api,
    trace: trace,
    crypto: {
      newCredential: newCredential,
      verifyCredential: verifyCredential,
      verifyLegacy: verifyLegacy,
      hashPassword: hashPassword,
      randomSalt: randomSalt,
      hasWebCrypto: hasWebCrypto,
    },
    packs: { packAccount: packAccount, unpackAccount: unpackAccount },
    csv: { sessionsToCsv: sessionsToCsv, parseCsv: parseCsv, csvToSessions: csvToSessions },
    migrate: { migrateV1: migrateV1, readLegacy: readLegacy },
    validate: { validateDocument: validateDocument, validateUser: validateUser },
  };
})(typeof window !== 'undefined' ? window : globalThis);
