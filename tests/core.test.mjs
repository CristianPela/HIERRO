/* ═══════════════════════════════════════════════════════════════════════════
   Tests unitarios del núcleo de HIERRO.
   Se corren con:  node --test tests/
   Cubren lo puro: credenciales, paquetes de alta, CSV, migración y validación.
   IndexedDB se prueba en el navegador (tests/smoke.html).
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const codigo = readFileSync(path.join(here, '..', 'app-core.js'), 'utf8');

/* Se evalúa el archivo con un `window` mínimo: así se prueba exactamente el
   mismo código que corre en el navegador. */
const sandbox = {
  crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, Buffer,
  console, Date, Math, JSON, Promise, Uint8Array, Array, Object, String, Number,
  indexedDB: undefined, localStorage: undefined,
};
sandbox.window = sandbox;
const CORE = new Function('window', 'globalThis', codigo + '\nreturn window.HIERRO_CORE;')(sandbox, sandbox);

const { crypto: cred, packs, csv, migrate, validate } = CORE;

test('una contraseña se deriva con PBKDF2 y no se guarda en claro', async () => {
  const c = await cred.newCredential('cristisn0916');
  assert.match(c.hash, /^pbkdf2\$150000\$/);
  assert.ok(!c.hash.includes('cristisn0916'), 'la contraseña no debe aparecer en el hash');
  assert.equal(c.iterations, 150000);
});

test('la misma contraseña con distinta sal da hashes distintos', async () => {
  const a = await cred.newCredential('repetida123');
  const b = await cred.newCredential('repetida123');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

test('verifica la contraseña correcta y rechaza la incorrecta', async () => {
  const c = await cred.newCredential('clave-segura');
  const user = { salt: c.salt, hash: c.hash, iterations: c.iterations };
  assert.equal(await cred.verifyCredential('clave-segura', user), true);
  assert.equal(await cred.verifyCredential('clave-segura ', user), false);
  assert.equal(await cred.verifyCredential('otra', user), false);
});

test('acepta una credencial del formato viejo (SHA-256 de una pasada)', async () => {
  const salt = 'sal-vieja';
  const hash = createHash('sha256').update(salt + '::' + 'clave1234', 'utf8').digest('hex');
  assert.equal(await cred.verifyLegacy('clave1234', { salt, hash }), true);
  assert.equal(await cred.verifyLegacy('otra', { salt, hash }), false);
});

test('el paquete de alta va y vuelve, y no lleva la contraseña', async () => {
  const c = await cred.newCredential('mi-clave-123');
  const user = {
    name: 'Cristian', role: 'admin', salt: c.salt, hash: c.hash, iterations: c.iterations,
    createdAt: 1700000000000, profile: { weightKg: 82 },
  };
  const code = packs.packAccount(user);
  assert.ok(!code.includes('mi-clave-123'), 'el paquete no debe contener la contraseña');
  const back = packs.unpackAccount(code);
  assert.equal(back.name, 'Cristian');
  assert.equal(back.role, 'admin');
  assert.equal(back.hash, c.hash);
  assert.equal(back.profile.weightKg, 82);
});

test('un paquete corrupto devuelve null en lugar de romper', () => {
  assert.equal(packs.unpackAccount('esto no es base64 valido %%%'), null);
  assert.equal(packs.unpackAccount(''), null);
});

test('el CSV exporta una fila por serie hecha y se puede releer', () => {
  const sessions = [{
    date: '2026-10-10', routineName: 'Empuje',
    entries: [{ name: 'Press de banca', muscle: 'Pecho', sets: [
      { target: '8-10', reps: 10, weight: 50, done: true },
      { target: '8-10', reps: 8, weight: 55, done: true },
      { target: '8-10', reps: 8, weight: 60, done: false },
    ] }],
  }];
  const texto = csv.sessionsToCsv(sessions);
  const lineas = texto.split('\r\n');
  assert.equal(lineas[0], 'fecha,rutina,ejercicio,musculo,serie,reps,kg,volumen_kg,objetivo');
  assert.equal(lineas.length, 3, 'solo las series hechas');
  assert.ok(lineas[1].startsWith('2026-10-10,Empuje,Press de banca,Pecho,1,10,50,500,8-10'));

  const parsed = csv.parseCsv(texto);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].ejercicio, 'Press de banca');

  const vueltas = csv.csvToSessions(texto);
  assert.equal(vueltas.length, 1);
  assert.equal(vueltas[0].date, '2026-10-10');
  assert.equal(vueltas[0].entries[0].sets.length, 2);
});

test('el CSV escapa comas y comillas', () => {
  const sessions = [{
    date: '2026-10-10', routineName: 'Día "A", pesado',
    entries: [{ name: 'Sentadilla, profunda', muscle: 'Cuádriceps', sets: [{ reps: 5, weight: 100, done: true }] }],
  }];
  const texto = csv.sessionsToCsv(sessions);
  const filas = csv.parseCsv(texto);
  assert.equal(filas.rows[0].rutina, 'Día "A", pesado');
  assert.equal(filas.rows[0].ejercicio, 'Sentadilla, profunda');
});

test('la migración v1 conserva sesiones y deja al primero como administrador', () => {
  const legacyUsers = [
    { id: 'u1', name: 'Cristian', salt: 's1', hash: 'h1', createdAt: 1000, profile: { weightKg: 82 } },
    { id: 'u2', name: 'Inv itado', salt: 's2', hash: 'h2', createdAt: 2000 },
  ];
  const legacyDocs = {
    u1: { sessions: [{ id: 's1', date: '2026-10-01', entries: [] }], prs: { squat: { weightKg: 100 } }, bodyweight: [{ date: '2026-10-01', kg: 82 }] },
  };
  const r = migrate.migrateV1(legacyUsers, legacyDocs);
  assert.equal(r.users.length, 2);
  assert.equal(r.users[0].role, 'admin');
  assert.equal(r.users[1].role, 'user');
  assert.equal(r.users[0].iterations, 0, 'la credencial vieja se marca para actualizar');
  assert.equal(r.documents[0].sessions.length, 1, 'no se pierde ninguna sesión');
  assert.equal(r.documents[0].prs.squat.weightKg, 100);
  assert.deepEqual(r.documents[0].bodyweight, [{ date: '2026-10-01', kg: 82 }]);
  assert.equal(r.documents[1].sessions.length, 0);
});

test('la migración de un dispositivo sin datos no inventa usuarios', () => {
  const r = migrate.migrateV1([], {});
  assert.equal(r.users.length, 0);
  assert.equal(r.documents.length, 0);
});

test('la validación normaliza datos corruptos en vez de aceptarlos', () => {
  const d = validate.validateDocument({ sessions: 'no es una lista', prefs: null, prs: 42, bodyweight: null }, 'u9');
  assert.deepEqual(d.sessions, []);
  assert.deepEqual(d.prefs, {});
  assert.deepEqual(d.prs, {});
  assert.deepEqual(d.bodyweight, []);
  assert.equal(d.schema, 2);
  assert.equal(d.userId, 'u9');
});

test('la validación de usuario rechaza lo incompleto y ordena el rol', () => {
  assert.equal(validate.validateUser({ name: 'sin id' }), null);
  assert.equal(validate.validateUser(null), null);
  const u = validate.validateUser({ id: 'x', name: 'Cristian', role: 'cualquiera' });
  assert.equal(u.role, 'user');
  assert.equal(u.disabled, false);
  const admin = validate.validateUser({ id: 'y', name: 'Admin', role: 'admin' });
  assert.equal(admin.role, 'admin');
});
