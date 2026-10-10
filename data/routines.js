/* ═══════════════════════════════════════════════════════════════════════════
   RUTINAS  ·  data/routines.js
   ───────────────────────────────────────────────────────────────────────────
   CÓMO EDITAR
   Cada rutina tiene:
     key        Identificador estable de la rutina.
     name       Nombre visible.
     objetivo   Lista de objetivos para los que aparece: hipertrofia, fuerza,
                definicion, resistencia.
     days       Frecuencia sugerida (texto informativo).
     level      Nivel: Principiante | Intermedio | Avanzado.
     duration   Duración estimada de la sesión.
     note       Consejo de la rutina.
     items      Lista de ejercicios. Cada item:
                  ex    clave del ejercicio en data/exercises.js
                  sets  cantidad de series
                  reps  repeticiones objetivo (texto; admite '8-10' o '30 s')
                  rest  descanso entre series, en segundos
                  w     peso inicial sugerido en kg (opcional; 0 para peso corporal)

   El orden de los items es el orden en pantalla. Para crear una rutina nueva,
   copiá una existente, cambiá la key y agregala al arreglo.
   ═══════════════════════════════════════════════════════════════════════════ */

window.GYM_ROUTINES = {

  objetivos: {
    hipertrofia:  { label: 'Hipertrofia',  desc: 'Más músculo: 8-15 repeticiones con descansos medios.' },
    fuerza:       { label: 'Fuerza',       desc: 'Más kilos: pocas repeticiones, descansos largos.' },
    definicion:   { label: 'Definición',   desc: 'Más densidad: descansos cortos y circuito.' },
    resistencia:  { label: 'Resistencia',  desc: 'Más aguante: series largas y trabajo cardiovascular.' },
  },

  routines: [
    {
      key: 'full_body_a',
      name: 'Cuerpo completo',
      objetivo: ['hipertrofia', 'definicion', 'resistencia', 'fuerza'],
      days: '3 días por semana', level: 'Principiante', duration: '50-60 min',
      note: 'La rutina para arrancar: un empuje, un tirón, una pierna y core en cada sesión.',
      items: [
        { ex: 'squat',        sets: 3, reps: '8-10',    rest: 150, w: 40 },
        { ex: 'bench_press',  sets: 3, reps: '8-10',    rest: 150, w: 40 },
        { ex: 'seated_row',   sets: 3, reps: '10-12',   rest: 90,  w: 40 },
        { ex: 'db_shoulder_press', sets: 3, reps: '10-12', rest: 90, w: 12 },
        { ex: 'leg_curl',     sets: 3, reps: '12-15',   rest: 60,  w: 30 },
        { ex: 'plank',        sets: 3, reps: '30-45 s', rest: 45,  w: 0 },
      ],
    },
    {
      key: 'hipertrofia_empuje',
      name: 'Empuje',
      objetivo: ['hipertrofia'],
      days: 'Rota con Tirón y Pierna', level: 'Intermedio', duration: '60-70 min',
      note: 'Pecho, hombros y tríceps. Dejá 1-2 repeticiones en reserva en las primeras series.',
      items: [
        { ex: 'bench_press',     sets: 4, reps: '8-10',  rest: 150, w: 50 },
        { ex: 'incline_db_press', sets: 3, reps: '10-12', rest: 120, w: 18 },
        { ex: 'db_shoulder_press', sets: 3, reps: '10-12', rest: 90, w: 14 },
        { ex: 'lateral_raise',   sets: 3, reps: '12-15', rest: 60,  w: 8 },
        { ex: 'cable_crossover', sets: 3, reps: '12-15', rest: 60,  w: 15 },
        { ex: 'triceps_pushdown', sets: 3, reps: '12-15', rest: 60, w: 25 },
        { ex: 'overhead_triceps', sets: 3, reps: '10-12', rest: 60, w: 20 },
      ],
    },
    {
      key: 'hipertrofia_tiron',
      name: 'Tirón',
      objetivo: ['hipertrofia'],
      days: 'Rota con Empuje y Pierna', level: 'Intermedio', duration: '60-70 min',
      note: 'Espalda y bíceps. Empezá por el ejercicio más pesado, cuando estás fresco.',
      items: [
        { ex: 'pullup',           sets: 4, reps: '5-10',  rest: 120, w: 0 },
        { ex: 'barbell_row',      sets: 4, reps: '8-10',  rest: 120, w: 45 },
        { ex: 'lat_pulldown',     sets: 3, reps: '10-12', rest: 90,  w: 45 },
        { ex: 'seated_row',       sets: 3, reps: '10-12', rest: 90,  w: 45 },
        { ex: 'face_pull',        sets: 3, reps: '15-20', rest: 60,  w: 20 },
        { ex: 'barbell_curl',     sets: 3, reps: '8-12',  rest: 75,  w: 20 },
        { ex: 'hammer_curl',      sets: 3, reps: '10-12', rest: 60,  w: 10 },
      ],
    },
    {
      key: 'hipertrofia_pierna',
      name: 'Pierna',
      objetivo: ['hipertrofia'],
      days: 'Rota con Empuje y Tirón', level: 'Intermedio', duration: '60-70 min',
      note: 'Cuádriceps, isquios y glúteos. Calentá con la barra vacía antes de la primera serie.',
      items: [
        { ex: 'squat',          sets: 4, reps: '6-10',    rest: 180, w: 60 },
        { ex: 'romanian_dl',    sets: 4, reps: '8-10',    rest: 150, w: 50 },
        { ex: 'leg_press',      sets: 3, reps: '10-12',   rest: 120, w: 100 },
        { ex: 'leg_curl',       sets: 3, reps: '12-15',   rest: 60,  w: 35 },
        { ex: 'leg_extension',  sets: 3, reps: '12-15',   rest: 60,  w: 35 },
        { ex: 'hip_thrust',     sets: 3, reps: '10-12',   rest: 120, w: 60 },
        { ex: 'standing_calf',  sets: 4, reps: '12-15',   rest: 60,  w: 60 },
      ],
    },
    {
      key: 'fuerza_5x5_a',
      name: 'Fuerza A',
      objetivo: ['fuerza'],
      days: '2-3 días por semana, alternando A y B', level: 'Intermedio', duration: '55-65 min',
      note: 'Series de 5 con descansos largos. Sumá 2,5 kg cuando completes las 5×5.',
      items: [
        { ex: 'squat',         sets: 5, reps: '5',  rest: 180, w: 60 },
        { ex: 'bench_press',   sets: 5, reps: '5',  rest: 180, w: 50 },
        { ex: 'barbell_row',   sets: 5, reps: '5',  rest: 150, w: 45 },
        { ex: 'plank',         sets: 3, reps: '45 s', rest: 60, w: 0 },
      ],
    },
    {
      key: 'fuerza_5x5_b',
      name: 'Fuerza B',
      objetivo: ['fuerza'],
      days: '2-3 días por semana, alternando A y B', level: 'Intermedio', duration: '55-65 min',
      note: 'El día del peso muerto: prioridad técnica sobre kilos. Filmá una serie si podés.',
      items: [
        { ex: 'squat',            sets: 5, reps: '5',  rest: 180, w: 60 },
        { ex: 'ohp',              sets: 5, reps: '5',  rest: 180, w: 30 },
        { ex: 'deadlift',         sets: 3, reps: '5',  rest: 210, w: 80 },
        { ex: 'hanging_leg_raise', sets: 3, reps: '10-15', rest: 75, w: 0 },
      ],
    },
    {
      key: 'definicion_circuito',
      name: 'Circuito metabólico',
      objetivo: ['definicion'],
      days: '3-4 días por semana', level: 'Intermedio', duration: '40-45 min',
      note: 'Completá cada bloque sin pausa y descansá 90 segundos al terminarlo. Repetí 3 veces.',
      items: [
        { ex: 'goblet_squat',    sets: 3, reps: '15',    rest: 45, w: 16 },
        { ex: 'pushup',          sets: 3, reps: '12-20', rest: 45, w: 0 },
        { ex: 'db_row',          sets: 3, reps: '12 por lado', rest: 45, w: 16 },
        { ex: 'lunge',           sets: 3, reps: '12 por pierna', rest: 45, w: 10 },
        { ex: 'mountain_climber', sets: 3, reps: '40 s', rest: 45, w: 0 },
        { ex: 'russian_twist',   sets: 3, reps: '20-30', rest: 45, w: 0 },
        { ex: 'kb_swing',        sets: 3, reps: '15-20', rest: 45, w: 16 },
      ],
    },
    {
      key: 'resistencia_acondicionamiento',
      name: 'Acondicionamiento',
      objetivo: ['resistencia'],
      days: '2-3 días por semana', level: 'Intermedio', duration: '45-55 min',
      note: 'Trabajo continuo. Mantené un ritmo que te deje hablar entre bloques.',
      items: [
        { ex: 'rowing_machine',  sets: 4, reps: '2 min',  rest: 60, w: 0 },
        { ex: 'jump_rope',       sets: 5, reps: '60 s',   rest: 45, w: 0 },
        { ex: 'burpee',          sets: 4, reps: '10-15',  rest: 60, w: 0 },
        { ex: 'farmers_walk',    sets: 4, reps: '40 m',   rest: 90, w: 24 },
        { ex: 'battle_ropes',    sets: 5, reps: '30 s',   rest: 45, w: 0 },
        { ex: 'box_jump',        sets: 4, reps: '6-8',    rest: 90, w: 0 },
        { ex: 'side_plank',      sets: 3, reps: '40 s por lado', rest: 45, w: 0 },
      ],
    },
  ],
};

// Índice rápido por clave (no editar).
window.GYM_ROUTINES.index = Object.fromEntries(window.GYM_ROUTINES.routines.map(r => [r.key, r]));
