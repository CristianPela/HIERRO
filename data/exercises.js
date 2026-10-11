/* ═══════════════════════════════════════════════════════════════════════════
   BASE DE DATOS DE EJERCICIOS  ·  data/exercises.js
   ───────────────────────────────────────────────────────────────────────────
   CÓMO EDITAR ESTA BASE
   Cada ejercicio es un objeto con estos campos:
     key         Identificador estable. Lo usan las rutinas (data/routines.js).
                 Si lo cambiás, actualizá también las rutinas. Nunca lo repitas.
     id          Nombre de la carpeta del ejercicio dentro del repositorio de
                 microfiguras. Define las fotos que se muestran.
     name        Nombre en español (el que ve el usuario).
     nameEn      Nombre original en el repositorio (referencia).
     muscle      Grupo muscular principal, en español.
     equipment   Implemento: Barra, Mancuernas, Máquina, Polea, Peso corporal...
     load        Tipo de carga: barbell | dumbbell | machine | cable | body
                 Solo 'barbell' activa la calculadora de discos.
     pattern     Patrón de movimiento. Decide el pictograma vectorial de respaldo
                 cuando no hay conexión: horizontal_push, vertical_push,
                 horizontal_pull, vertical_pull, squat, hinge, lunge, core,
                 arm, calf, cardio.
     defaultSets / defaultReps / defaultRest   Valores con los que arranca la serie.

   CÓMO CAMBIAR EL REPOSITORIO DE MICROFIGURAS
   La ruta de cada figura depende de meta.frameCount:
     frameCount = 2  ->  imageBase + id + '/0' + frameExt   (y '/1' para el segundo frame)
                         La app cruza los dos frames en fundido.
     frameCount = 1  ->  imageBase + id + frameExt          (un solo archivo: GIF o SVG)
   Ejemplo con 2 frames:  .../exercises/Barbell_Squat/0.jpg
   Para usar tu propio repositorio editá meta.imageBase, meta.frameExt y meta.frameCount.
   ═══════════════════════════════════════════════════════════════════════════ */

window.GYM_DATA = {
  meta: {
    version: '2026.10.10',
    /* Orden en que se muestran los grupos musculares al armar el día.
       Editá esta lista para cambiar el orden o el nombre de los grupos. */
    grupos: ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos', 'Core', 'Cuerpo completo'],
    // Cuántos ejercicios se sugieren de cada grupo al elegirlo al armar el día.
    porGrupo: 3,
    attribution: 'Microfiguras: repositorio público yuhonas/free-exercise-db (dominio público).',
    // Base de las microfiguras. Cambiala por tu repositorio si usás figuras propias.
    imageBase: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/',
    // Espejo alternativo si el CDN no responde.
    imageAltBase: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/',
    frameCount: 2,          // 2 = posición inicial y final, cruzadas en fundido
    frameExt: '.jpg',       // .jpg | .gif | .svg | .webp
  },

  exercises: [
    /* ── PECHO ────────────────────────────────────────────────────────── */
    {
      key: 'bench_press', id: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Press de banca',
      nameEn: 'Barbell Bench Press - Medium Grip', muscle: 'Pecho', equipment: 'Barra',
      load: 'barbell', pattern: 'horizontal_push', defaultSets: 4, defaultReps: '8-10', defaultRest: 150,
      cues: [
        'Escápulas retraídas y apoyadas; el pecho sale, los hombros no.',
        'La barra baja a la línea del pezón, con los codos a unos 45°.',
        'Empujá el piso con los pies para estabilizar.',
      ],
    },
    {
      key: 'incline_bench', id: 'Barbell_Incline_Bench_Press_-_Medium_Grip', name: 'Press inclinado con barra',
      nameEn: 'Barbell Incline Bench Press - Medium Grip', muscle: 'Pecho', equipment: 'Barra',
      load: 'barbell', pattern: 'horizontal_push', defaultSets: 4, defaultReps: '8-10', defaultRest: 150,
      cues: [
        'Banco a 30-40°: más inclinación convierte el ejercicio en press de hombros.',
        'La barra toca arriba del pecho, no en el cuello.',
        'Bajá controlado en 2 segundos.',
      ],
    },
    {
      key: 'incline_db_press', id: 'Incline_Dumbbell_Press', name: 'Press inclinado con mancuernas',
      nameEn: 'Incline Dumbbell Press', muscle: 'Pecho', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'horizontal_push', defaultSets: 3, defaultReps: '10-12', defaultRest: 120,
      cues: [
        'Muñecas alineadas con los codos, sin quebrarlas hacia atrás.',
        'Las mancuernas bajan hasta el pecho sin perder la retracción.',
        'Juntá las mancuernas arriba sin chocarlas.',
      ],
    },
    {
      key: 'db_fly', id: 'Dumbbell_Flyes', name: 'Aperturas con mancuernas',
      nameEn: 'Dumbbell Flyes', muscle: 'Pecho', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'horizontal_push', defaultSets: 3, defaultReps: '12-15', defaultRest: 90,
      cues: [
        'Codos semiflexionados y fijos: el movimiento es de hombro.',
        'Abrí hasta sentir el estiramiento, no hasta el dolor.',
        'Juntá arriba como si abrazaras un tronco.',
      ],
    },
    {
      key: 'cable_crossover', id: 'Cable_Crossover', name: 'Cruces en polea',
      nameEn: 'Cable Crossover', muscle: 'Pecho', equipment: 'Polea',
      load: 'cable', pattern: 'horizontal_push', defaultSets: 3, defaultReps: '12-15', defaultRest: 75,
      cues: [
        'Inclinate levemente hacia adelante y fijá el torso.',
        'Cerrá las manos abajo y adelante, buscando contraer el pecho.',
        'Volvé lento, sin dejar que el peso tire de los hombros.',
      ],
    },
    {
      key: 'machine_chest_press', id: 'Machine_Bench_Press', name: 'Press de pecho en máquina',
      nameEn: 'Machine Bench Press', muscle: 'Pecho', equipment: 'Máquina',
      load: 'machine', pattern: 'horizontal_push', defaultSets: 3, defaultReps: '10-12', defaultRest: 90,
      cues: [
        'Regulá el asiento hasta que las manijas queden a la altura del pecho.',
        'Espalda completa apoyada en el respaldo.',
        'No trabes los codos: dejá tensión continua.',
      ],
    },
    {
      key: 'pushup', id: 'Pushups', name: 'Flexiones de brazos',
      nameEn: 'Pushups', muscle: 'Pecho', equipment: 'Peso corporal',
      load: 'body', pattern: 'horizontal_push', defaultSets: 3, defaultReps: '12-20', defaultRest: 60,
      cues: [
        'Cuerpo en línea: glúteos y abdomen firmes.',
        'Manos algo más anchas que los hombros.',
        'El pecho toca casi el piso, los codos a 45°.',
      ],
    },
    {
      key: 'chest_dip', id: 'Dips_-_Chest_Version', name: 'Fondos en paralelas (pecho)',
      nameEn: 'Dips - Chest Version', muscle: 'Pecho', equipment: 'Peso corporal',
      load: 'body', pattern: 'horizontal_push', defaultSets: 3, defaultReps: '8-12', defaultRest: 90,
      cues: [
        'Torso inclinado adelante para cargar el pecho.',
        'Bajá hasta que los hombros queden al nivel de los codos.',
        'Sumá peso con cinturón cuando pases las 12 repeticiones.',
      ],
    },

    /* ── HOMBROS ──────────────────────────────────────────────────────── */
    {
      key: 'ohp', id: 'Standing_Military_Press', name: 'Press militar de pie',
      nameEn: 'Standing Military Press', muscle: 'Hombros', equipment: 'Barra',
      load: 'barbell', pattern: 'vertical_push', defaultSets: 4, defaultReps: '6-8', defaultRest: 150,
      cues: [
        'Abdomen y glúteos firmes: no arquees la lumbar.',
        'La barra sube pegada a la cara hasta pasar la frente.',
        'Terminá con la cabeza entre los brazos.',
      ],
    },
    {
      key: 'db_shoulder_press', id: 'Dumbbell_Shoulder_Press', name: 'Press de hombros con mancuernas',
      nameEn: 'Dumbbell Shoulder Press', muscle: 'Hombros', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'vertical_push', defaultSets: 3, defaultReps: '8-12', defaultRest: 120,
      cues: [
        'Arrancá con las mancuernas a la altura de las orejas.',
        'Subí sin bloquear de golpe los codos.',
        'Si necesitás impulso con las piernas, es otro ejercicio (push press).',
      ],
    },
    {
      key: 'arnold_press', id: 'Arnold_Dumbbell_Press', name: 'Press Arnold',
      nameEn: 'Arnold Dumbbell Press', muscle: 'Hombros', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'vertical_push', defaultSets: 3, defaultReps: '10-12', defaultRest: 90,
      cues: [
        'Arrancá con las palmas hacia vos y rotá al subir.',
        'El giro es continuo, no en dos tiempos.',
        'Codos adelante, no abiertos al costado.',
      ],
    },
    {
      key: 'lateral_raise', id: 'Side_Lateral_Raise', name: 'Elevaciones laterales',
      nameEn: 'Side Lateral Raise', muscle: 'Hombros', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'vertical_push', defaultSets: 3, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Subí con los codos, no con las manos.',
        'Pará a la altura de los hombros: más arriba entra el trapecio.',
        'Poco peso y sin balanceo del torso.',
      ],
    },
    {
      key: 'front_raise', id: 'Front_Dumbbell_Raise', name: 'Elevaciones frontales',
      nameEn: 'Front Dumbbell Raise', muscle: 'Hombros', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'vertical_push', defaultSets: 3, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Subí hasta la altura de los ojos, sin balanceo.',
        'Muñecas neutras y hombros abajo.',
        'Alterná brazos si te ayuda a controlar el torso.',
      ],
    },
    {
      key: 'rear_delt_fly', id: 'Reverse_Flyes', name: 'Pájaros (deltoide posterior)',
      nameEn: 'Reverse Flyes', muscle: 'Hombros', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'horizontal_pull', defaultSets: 3, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Torso inclinado casi paralelo al piso.',
        'Abrí con los codos, juntando los omóplatos.',
        'Sin impulso: si lo necesitás, bajá el peso.',
      ],
    },
    {
      key: 'face_pull', id: 'Face_Pull', name: 'Face pull en polea',
      nameEn: 'Face Pull', muscle: 'Hombros', equipment: 'Polea',
      load: 'cable', pattern: 'horizontal_pull', defaultSets: 3, defaultReps: '15-20', defaultRest: 60,
      cues: [
        'Tirá la cuerda hacia la frente, separando las manos.',
        'Codos altos, a la altura de los hombros.',
        'Terminá con los omóplatos juntos: es el mejor seguro para el hombro.',
      ],
    },
    {
      key: 'push_press', id: 'Push_Press', name: 'Push press',
      nameEn: 'Push Press', muscle: 'Hombros', equipment: 'Barra',
      load: 'barbell', pattern: 'vertical_push', defaultSets: 5, defaultReps: '5', defaultRest: 180,
      cues: [
        'Dip corto de rodillas y cadera, torso vertical.',
        'El impulso de piernas lanza la barra; los brazos la acompañan.',
        'Bajá la barra a los hombros con control.',
      ],
    },
    {
      key: 'shrug', id: 'Barbell_Shrug', name: 'Encogimientos con barra',
      nameEn: 'Barbell Shrug', muscle: 'Hombros', equipment: 'Barra',
      load: 'barbell', pattern: 'vertical_pull', defaultSets: 3, defaultReps: '12-15', defaultRest: 90,
      cues: [
        'Subí los hombros hacia las orejas, sin doblar los codos.',
        'Pausa de un segundo arriba.',
        'No rotes los hombros: sube y baja.',
      ],
    },

    /* ── ESPALDA ──────────────────────────────────────────────────────── */
    {
      key: 'pullup', id: 'Pullups', name: 'Dominadas',
      nameEn: 'Pullups', muscle: 'Espalda', equipment: 'Peso corporal',
      load: 'body', pattern: 'vertical_pull', defaultSets: 4, defaultReps: '5-10', defaultRest: 120,
      cues: [
        'Agarre prono algo más ancho que los hombros.',
        'Iniciá bajando los omóplatos, después flexioná los codos.',
        'El mentón pasa la barra sin pataleo.',
      ],
    },
    {
      key: 'chinup', id: 'Chin-Up', name: 'Dominadas supinas',
      nameEn: 'Chin-Up', muscle: 'Espalda', equipment: 'Peso corporal',
      load: 'body', pattern: 'vertical_pull', defaultSets: 4, defaultReps: '6-10', defaultRest: 120,
      cues: [
        'Palmas hacia vos: entra más el bíceps.',
        'Codos al frente y abajo, no al costado.',
        'Bajá hasta extender del todo los brazos.',
      ],
    },
    {
      key: 'lat_pulldown', id: 'Wide-Grip_Lat_Pulldown', name: 'Jalón al pecho agarre amplio',
      nameEn: 'Wide-Grip Lat Pulldown', muscle: 'Espalda', equipment: 'Polea',
      load: 'cable', pattern: 'vertical_pull', defaultSets: 4, defaultReps: '10-12', defaultRest: 90,
      cues: [
        'Pecho arriba y mirada al frente: no lleves la barra al pecho con el cuello.',
        'Tirá con los codos hacia el piso.',
        'Subí lento y dejá que la espalda se estire.',
      ],
    },
    {
      key: 'close_pulldown', id: 'Close-Grip_Front_Lat_Pulldown', name: 'Jalón al pecho agarre cerrado',
      nameEn: 'Close-Grip Front Lat Pulldown', muscle: 'Espalda', equipment: 'Polea',
      load: 'cable', pattern: 'vertical_pull', defaultSets: 3, defaultReps: '10-12', defaultRest: 90,
      cues: [
        'Agarre neutro al ancho de los hombros.',
        'Llevá los codos al bolsillo, no la barra a la cara.',
        'Sin balancear el torso hacia atrás.',
      ],
    },
    {
      key: 'barbell_row', id: 'Bent_Over_Barbell_Row', name: 'Remo con barra',
      nameEn: 'Bent Over Barbell Row', muscle: 'Espalda', equipment: 'Barra',
      load: 'barbell', pattern: 'horizontal_pull', defaultSets: 4, defaultReps: '8-10', defaultRest: 120,
      cues: [
        'Cadera atrás, espalda neutra, torso a 45°.',
        'Tirá la barra al ombligo, no al pecho.',
        'Sin tirones de lumbar: si sube el torso, el peso es mucho.',
      ],
    },
    {
      key: 'db_row', id: 'One-Arm_Dumbbell_Row', name: 'Remo a una mano con mancuerna',
      nameEn: 'One-Arm Dumbbell Row', muscle: 'Espalda', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'horizontal_pull', defaultSets: 3, defaultReps: '10-12', defaultRest: 90,
      cues: [
        'Apoyá mano y rodilla, columna neutra.',
        'Llevá el codo hacia la cadera.',
        'No rotes el torso para completar la repetición.',
      ],
    },
    {
      key: 'seated_row', id: 'Seated_Cable_Rows', name: 'Remo sentado en polea',
      nameEn: 'Seated Cable Rows', muscle: 'Espalda', equipment: 'Polea',
      load: 'cable', pattern: 'horizontal_pull', defaultSets: 4, defaultReps: '10-12', defaultRest: 90,
      cues: [
        'Rodillas semiflexionadas y torso firme a 90°.',
        'Tirá al abdomen y juntá los omóplatos.',
        'Volvé dejando estirar, sin encorvar la espalda.',
      ],
    },
    {
      key: 't_bar_row', id: 'T-Bar_Row_with_Handle', name: 'Remo en T',
      nameEn: 'T-Bar Row with Handle', muscle: 'Espalda', equipment: 'Barra',
      load: 'barbell', pattern: 'horizontal_pull', defaultSets: 4, defaultReps: '8-10', defaultRest: 120,
      cues: [
        'Pecho apoyado si el banco lo permite: saca la lumbar del esfuerzo.',
        'Tirá con los codos, no con las manos.',
        'Estirá abajo sin perder la curvatura neutra.',
      ],
    },
    {
      key: 'inverted_row', id: 'Inverted_Row', name: 'Remo invertido',
      nameEn: 'Inverted Row', muscle: 'Espalda', equipment: 'Peso corporal',
      load: 'body', pattern: 'horizontal_pull', defaultSets: 3, defaultReps: '10-15', defaultRest: 75,
      cues: [
        'Cuerpo en tabla, talones en el piso.',
        'Tocá la barra con el pecho.',
        'Cuanto más horizontal el cuerpo, más difícil.',
      ],
    },
    {
      key: 'straight_arm_pulldown', id: 'Straight-Arm_Pulldown', name: 'Pullover en polea',
      nameEn: 'Straight-Arm Pulldown', muscle: 'Espalda', equipment: 'Polea',
      load: 'cable', pattern: 'vertical_pull', defaultSets: 3, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Brazos casi extendidos y fijos.',
        'Bajá la barra hasta los muslos con la espalda, no con el tríceps.',
        'Torso quieto, sin convertirlo en un jalón.',
      ],
    },
    {
      key: 'good_morning', id: 'Good_Morning', name: 'Buenos días',
      nameEn: 'Good Morning', muscle: 'Isquios', equipment: 'Barra',
      load: 'barbell', pattern: 'hinge', defaultSets: 3, defaultReps: '10-12', defaultRest: 120,
      cues: [
        'Barra alta en la espalda, rodillas apenas flexionadas.',
        'Llevá la cadera atrás hasta sentir el estiramiento.',
        'Subí apretando glúteos, no con la lumbar.',
      ],
    },

    /* ── BÍCEPS Y TRÍCEPS ─────────────────────────────────────────────── */
    {
      key: 'barbell_curl', id: 'Barbell_Curl', name: 'Curl con barra',
      nameEn: 'Barbell Curl', muscle: 'Bíceps', equipment: 'Barra',
      load: 'barbell', pattern: 'arm', defaultSets: 3, defaultReps: '8-12', defaultRest: 90,
      cues: [
        'Codos pegados al torso y fijos.',
        'Sin balanceo de cadera: si lo necesitás, bajá el peso.',
        'Bajá en 2-3 segundos, controlando.',
      ],
    },
    {
      key: 'db_curl', id: 'Dumbbell_Bicep_Curl', name: 'Curl con mancuernas',
      nameEn: 'Dumbbell Bicep Curl', muscle: 'Bíceps', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'arm', defaultSets: 3, defaultReps: '10-12', defaultRest: 75,
      cues: [
        'Alterná o hacé las dos a la vez, pero sin mover los codos.',
        'Supiná la muñeca al subir.',
        'Apretá arriba una fracción de segundo.',
      ],
    },
    {
      key: 'hammer_curl', id: 'Hammer_Curls', name: 'Curl martillo',
      nameEn: 'Hammer Curls', muscle: 'Bíceps', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'arm', defaultSets: 3, defaultReps: '10-12', defaultRest: 75,
      cues: [
        'Palmas enfrentadas todo el recorrido.',
        'Trabaja el braquial: útil para grosor del brazo.',
        'Codos quietos, muñeca neutra.',
      ],
    },
    {
      key: 'preacher_curl', id: 'Preacher_Curl', name: 'Curl en banco Scott',
      nameEn: 'Preacher Curl', muscle: 'Bíceps', equipment: 'Barra',
      load: 'barbell', pattern: 'arm', defaultSets: 3, defaultReps: '10-12', defaultRest: 75,
      cues: [
        'Axilas apoyadas en el borde del banco.',
        'No extiendas del todo si te molesta el codo.',
        'El banco aísla: no hay dónde hacer trampa.',
      ],
    },
    {
      key: 'incline_curl', id: 'Incline_Dumbbell_Curl', name: 'Curl inclinado',
      nameEn: 'Incline Dumbbell Curl', muscle: 'Bíceps', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'arm', defaultSets: 3, defaultReps: '10-12', defaultRest: 75,
      cues: [
        'Banco a 45-60°: los brazos quedan detrás del torso.',
        'Estira bien abajo, es la parte más valiosa del recorrido.',
        'Sin mover los hombros hacia adelante.',
      ],
    },
    {
      key: 'triceps_pushdown', id: 'Triceps_Pushdown', name: 'Extensión de tríceps en polea',
      nameEn: 'Triceps Pushdown', muscle: 'Tríceps', equipment: 'Polea',
      load: 'cable', pattern: 'arm', defaultSets: 3, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Codos pegados al costado y fijos.',
        'Extendé del todo y apretá el tríceps abajo.',
        'Torso levemente inclinado, sin ayudarte con el peso del cuerpo.',
      ],
    },
    {
      key: 'skullcrusher', id: 'Lying_Triceps_Press', name: 'Extensión de tríceps acostado',
      nameEn: 'Lying Triceps Press', muscle: 'Tríceps', equipment: 'Barra',
      load: 'barbell', pattern: 'arm', defaultSets: 3, defaultReps: '10-12', defaultRest: 90,
      cues: [
        'Codos apuntando al techo, sin abrirlos.',
        'Bajá la barra hacia la frente o detrás de la cabeza.',
        'Extendé sin mover los hombros.',
      ],
    },
    {
      key: 'close_grip_bench', id: 'Close-Grip_Barbell_Bench_Press', name: 'Press de banca agarre cerrado',
      nameEn: 'Close-Grip Barbell Bench Press', muscle: 'Tríceps', equipment: 'Barra',
      load: 'barbell', pattern: 'horizontal_push', defaultSets: 3, defaultReps: '8-10', defaultRest: 120,
      cues: [
        'Manos al ancho de los hombros, no más cerradas.',
        'Codos cerca del torso durante todo el recorrido.',
        'Punto de contacto un poco más abajo que en el press normal.',
      ],
    },
    {
      key: 'overhead_triceps', id: 'Standing_Dumbbell_Triceps_Extension', name: 'Extensión sobre la cabeza',
      nameEn: 'Standing Dumbbell Triceps Extension', muscle: 'Tríceps', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'arm', defaultSets: 3, defaultReps: '10-12', defaultRest: 75,
      cues: [
        'Codos apuntando al techo y cerca de la cabeza.',
        'Estirá el tríceps por completo arriba.',
        'Abdomen firme para no arquear la espalda.',
      ],
    },
    {
      key: 'triceps_dip', id: 'Dips_-_Triceps_Version', name: 'Fondos en paralelas (tríceps)',
      nameEn: 'Dips - Triceps Version', muscle: 'Tríceps', equipment: 'Peso corporal',
      load: 'body', pattern: 'vertical_push', defaultSets: 3, defaultReps: '8-12', defaultRest: 90,
      cues: [
        'Torso vertical para cargar el tríceps.',
        'Bajá hasta 90° de codo, sin hundir los hombros.',
        'Sumá peso cuando pases las 12 repeticiones.',
      ],
    },

    /* ── PIERNAS ──────────────────────────────────────────────────────── */
    {
      key: 'squat', id: 'Barbell_Squat', name: 'Sentadilla trasera',
      nameEn: 'Barbell Squat', muscle: 'Cuádriceps', equipment: 'Barra',
      load: 'barbell', pattern: 'squat', defaultSets: 5, defaultReps: '5-8', defaultRest: 180,
      cues: [
        'Pies al ancho de los hombros, puntas levemente afuera.',
        'Bajá llevando la cadera atrás y las rodillas en línea con las puntas.',
        'Bajá hasta romper la paralela si tu movilidad lo permite; subí apretando glúteos.',
      ],
    },
    {
      key: 'front_squat', id: 'Front_Barbell_Squat', name: 'Sentadilla frontal',
      nameEn: 'Front Barbell Squat', muscle: 'Cuádriceps', equipment: 'Barra',
      load: 'barbell', pattern: 'squat', defaultSets: 4, defaultReps: '6-8', defaultRest: 180,
      cues: [
        'Barra sobre los deltoides anteriores, codos altos.',
        'Torso lo más vertical posible.',
        'Si los codos bajan, la barra se cae: mirá al frente.',
      ],
    },
    {
      key: 'goblet_squat', id: 'Goblet_Squat', name: 'Sentadilla goblet',
      nameEn: 'Goblet Squat', muscle: 'Cuádriceps', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'squat', defaultSets: 3, defaultReps: '12-15', defaultRest: 90,
      cues: [
        'Mancuerna pegada al pecho, codos adentro.',
        'Bajá profundo manteniendo el torso alto.',
        'Ideal para aprender el patrón con seguridad.',
      ],
    },
    {
      key: 'leg_press', id: 'Leg_Press', name: 'Prensa de piernas',
      nameEn: 'Leg Press', muscle: 'Cuádriceps', equipment: 'Máquina',
      load: 'machine', pattern: 'squat', defaultSets: 4, defaultReps: '10-12', defaultRest: 120,
      cues: [
        'Espalda y cadera completas contra el respaldo.',
        'Bajá hasta 90° sin despegar la cadera.',
        'No trabes las rodillas arriba: dejá una leve flexión.',
      ],
    },
    {
      key: 'lunge', id: 'Dumbbell_Lunges', name: 'Zancadas con mancuernas',
      nameEn: 'Dumbbell Lunges', muscle: 'Cuádriceps', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'lunge', defaultSets: 3, defaultReps: '10-12 por pierna', defaultRest: 90,
      cues: [
        'Paso largo: la rodilla de adelante no pasa demasiado la punta del pie.',
        'Bajá la rodilla de atrás casi al piso.',
        'Torso erguido todo el tiempo.',
      ],
    },
    {
      key: 'split_squat', id: 'Split_Squat_with_Dumbbells', name: 'Sentadilla búlgara',
      nameEn: 'Split Squat with Dumbbells', muscle: 'Cuádriceps', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'lunge', defaultSets: 3, defaultReps: '8-12 por pierna', defaultRest: 90,
      cues: [
        'Pie de atrás elevado en un banco.',
        'Bajá vertical, sin tirar el torso adelante.',
        'Empezá sin peso: el equilibrio es la parte difícil.',
      ],
    },
    {
      key: 'step_up', id: 'Dumbbell_Step_Ups', name: 'Subidas al cajón',
      nameEn: 'Dumbbell Step Ups', muscle: 'Glúteos', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'lunge', defaultSets: 3, defaultReps: '10 por pierna', defaultRest: 75,
      cues: [
        'Cajón a la altura de la rodilla.',
        'Subí empujando con la pierna de arriba, no con la de abajo.',
        'Bajá controlado, sin dejarte caer.',
      ],
    },
    {
      key: 'romanian_dl', id: 'Romanian_Deadlift', name: 'Peso muerto rumano',
      nameEn: 'Romanian Deadlift', muscle: 'Isquios', equipment: 'Barra',
      load: 'barbell', pattern: 'hinge', defaultSets: 4, defaultReps: '8-10', defaultRest: 150,
      cues: [
        'Rodillas semiflexionadas y fijas: el movimiento es de cadera.',
        'La barra roza los muslos al bajar; espalda neutra siempre.',
        'Bajá hasta sentir el estiramiento en los isquios, no hasta el piso.',
      ],
    },
    {
      key: 'deadlift', id: 'Barbell_Deadlift', name: 'Peso muerto convencional',
      nameEn: 'Barbell Deadlift', muscle: 'Espalda', equipment: 'Barra',
      load: 'barbell', pattern: 'hinge', defaultSets: 4, defaultReps: '3-5', defaultRest: 210,
      cues: [
        'Barra sobre la mitad del pie, canillas casi tocándola.',
        'Pecho arriba y espalda neutra antes de tirar.',
        'Empujá el piso con los pies; la barra sube pegada a las piernas.',
      ],
    },
    {
      key: 'sumo_dl', id: 'Sumo_Deadlift', name: 'Peso muerto sumo',
      nameEn: 'Sumo Deadlift', muscle: 'Glúteos', equipment: 'Barra',
      load: 'barbell', pattern: 'hinge', defaultSets: 4, defaultReps: '5', defaultRest: 180,
      cues: [
        'Pies bien abiertos, puntas a 45°, manos adentro de las piernas.',
        'Cadera baja y cerca de la barra al arrancar.',
        'Abrí el piso con los pies durante todo el tirón.',
      ],
    },
    {
      key: 'hip_thrust', id: 'Barbell_Hip_Thrust', name: 'Hip thrust con barra',
      nameEn: 'Barbell Hip Thrust', muscle: 'Glúteos', equipment: 'Barra',
      load: 'barbell', pattern: 'hinge', defaultSets: 3, defaultReps: '10-12', defaultRest: 120,
      cues: [
        'Omóplatos apoyados en el banco, no el cuello.',
        'Subí hasta alinear cadera y rodillas, apretando glúteos.',
        'Mentón al pecho para no hiperextender la lumbar.',
      ],
    },
    {
      key: 'glute_bridge', id: 'Butt_Lift_Bridge', name: 'Puente de glúteos',
      nameEn: 'Butt Lift Bridge', muscle: 'Glúteos', equipment: 'Peso corporal',
      load: 'body', pattern: 'hinge', defaultSets: 3, defaultReps: '15-20', defaultRest: 60,
      cues: [
        'Talones cerca de los glúteos.',
        'Subí la cadera y apretá arriba un segundo.',
        'Sin arquear la lumbar: el trabajo es del glúteo.',
      ],
    },
    {
      key: 'leg_extension', id: 'Leg_Extensions', name: 'Extensión de cuádriceps',
      nameEn: 'Leg Extensions', muscle: 'Cuádriceps', equipment: 'Máquina',
      load: 'machine', pattern: 'squat', defaultSets: 3, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Rodilla alineada con el eje de la máquina.',
        'Extendé del todo y apretá arriba.',
        'Bajá controlado, sin soltar el peso.',
      ],
    },
    {
      key: 'leg_curl', id: 'Lying_Leg_Curls', name: 'Curl femoral acostado',
      nameEn: 'Lying Leg Curls', muscle: 'Isquios', equipment: 'Máquina',
      load: 'machine', pattern: 'squat', defaultSets: 3, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Cadera pegada al banco: no la levantes.',
        'Llevá los talones a los glúteos sin impulso.',
        'Bajá en 2-3 segundos.',
      ],
    },
    {
      key: 'seated_leg_curl', id: 'Seated_Leg_Curl', name: 'Curl femoral sentado',
      nameEn: 'Seated Leg Curl', muscle: 'Isquios', equipment: 'Máquina',
      load: 'machine', pattern: 'squat', defaultSets: 3, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Rodillas alineadas con el eje y el rodillo sobre los tobillos.',
        'Espalda apoyada, sin despegar la cadera.',
        'Estirá del todo arriba para el pico de contracción.',
      ],
    },
    {
      key: 'standing_calf', id: 'Standing_Calf_Raises', name: 'Elevación de gemelos de pie',
      nameEn: 'Standing Calf Raises', muscle: 'Gemelos', equipment: 'Máquina',
      load: 'machine', pattern: 'calf', defaultSets: 4, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Rango completo: talón bien abajo, punta bien arriba.',
        'Pausa de un segundo arriba y abajo.',
        'Sin rebotar: el rebote se come el trabajo.',
      ],
    },
    {
      key: 'seated_calf', id: 'Seated_Calf_Raise', name: 'Elevación de gemelos sentado',
      nameEn: 'Seated Calf Raise', muscle: 'Gemelos', equipment: 'Máquina',
      load: 'machine', pattern: 'calf', defaultSets: 4, defaultReps: '15-20', defaultRest: 45,
      cues: [
        'Rodillas a 90°, almohadilla sobre los muslos.',
        'Con la rodilla flexionada trabaja más el sóleo.',
        'Subí lento y bajá más lento.',
      ],
    },
    {
      key: 'hip_abduction', id: 'Thigh_Abductor', name: 'Abducción de cadera',
      nameEn: 'Thigh Abductor', muscle: 'Glúteos', equipment: 'Máquina',
      load: 'machine', pattern: 'squat', defaultSets: 3, defaultReps: '15-20', defaultRest: 45,
      cues: [
        'Torso levemente adelante para más glúteo medio.',
        'Abrí hasta el tope y volvé sin golpear.',
        'Pausa arriba para evitar el impulso.',
      ],
    },
    {
      key: 'cable_kickback', id: 'One-Legged_Cable_Kickback', name: 'Patada de glúteo en polea',
      nameEn: 'One-Legged Cable Kickback', muscle: 'Glúteos', equipment: 'Polea',
      load: 'cable', pattern: 'hinge', defaultSets: 3, defaultReps: '12-15 por pierna', defaultRest: 60,
      cues: [
        'Torso firme, sin arquear la lumbar al patear.',
        'El movimiento es de cadera, no de la pierna sola.',
        'Apretá el glúteo arriba antes de volver.',
      ],
    },

    /* ── CORE Y ACONDICIONAMIENTO ─────────────────────────────────────── */
    {
      key: 'plank', id: 'Plank', name: 'Plancha frontal',
      nameEn: 'Plank', muscle: 'Core', equipment: 'Peso corporal',
      load: 'body', pattern: 'core', defaultSets: 3, defaultReps: '30-60 s', defaultRest: 45,
      cues: [
        'Codos bajo los hombros, cuerpo en línea.',
        'Apretá glúteos y abdomen: es lo que sostiene.',
        'Si la cadera cae, cortá la serie antes.',
      ],
    },
    {
      key: 'side_plank', id: 'Side_Bridge', name: 'Plancha lateral',
      nameEn: 'Side Bridge', muscle: 'Core', equipment: 'Peso corporal',
      load: 'body', pattern: 'core', defaultSets: 3, defaultReps: '30-45 s por lado', defaultRest: 45,
      cues: [
        'Codo bajo el hombro, cadera alta.',
        'Cuerpo en línea desde el tobillo a la cabeza.',
        'Hacé los dos lados con el mismo tiempo.',
      ],
    },
    {
      key: 'hanging_leg_raise', id: 'Hanging_Leg_Raise', name: 'Elevación de piernas colgado',
      nameEn: 'Hanging Leg Raise', muscle: 'Core', equipment: 'Peso corporal',
      load: 'body', pattern: 'core', defaultSets: 3, defaultReps: '10-15', defaultRest: 75,
      cues: [
        'Sin balanceo: arrancá con el cuerpo quieto.',
        'Enrollá la pelvis hacia el abdomen al subir.',
        'Bajá lento para evitar el columpio.',
      ],
    },
    {
      key: 'crunch', id: 'Crunches', name: 'Abdominales cortos',
      nameEn: 'Crunches', muscle: 'Core', equipment: 'Peso corporal',
      load: 'body', pattern: 'core', defaultSets: 3, defaultReps: '15-20', defaultRest: 45,
      cues: [
        'Enrollá la columna, no tirés del cuello.',
        'Exhalá al subir, con la lumbar apoyada.',
        'Poco recorrido, mucha contracción.',
      ],
    },
    {
      key: 'cable_crunch', id: 'Cable_Crunch', name: 'Crunch en polea alta',
      nameEn: 'Cable Crunch', muscle: 'Core', equipment: 'Polea',
      load: 'cable', pattern: 'core', defaultSets: 3, defaultReps: '12-15', defaultRest: 60,
      cues: [
        'Arrodillado con la cuerda a los lados de la cabeza.',
        'El movimiento es de columna: enrollá el torso.',
        'Cadera quieta y fija.',
      ],
    },
    {
      key: 'russian_twist', id: 'Russian_Twist', name: 'Giro ruso',
      nameEn: 'Russian Twist', muscle: 'Core', equipment: 'Peso corporal',
      load: 'body', pattern: 'core', defaultSets: 3, defaultReps: '20-30', defaultRest: 45,
      cues: [
        'Torso inclinado atrás, espalda recta.',
        'Rotá desde el torso, no solo con los brazos.',
        'Podés sumar disco para progresar.',
      ],
    },
    {
      key: 'ab_wheel', id: 'Ab_Roller', name: 'Rueda abdominal',
      nameEn: 'Ab Roller', muscle: 'Core', equipment: 'Otro',
      load: 'other', pattern: 'core', defaultSets: 3, defaultReps: '8-12', defaultRest: 75,
      cues: [
        'Rodillas apoyadas y pelvis en retroversión.',
        'Estirá solo hasta donde no se hunda la lumbar.',
        'Volvé traccionando con el abdomen.',
      ],
    },
    {
      key: 'mountain_climber', id: 'Mountain_Climbers', name: 'Escaladores',
      nameEn: 'Mountain Climbers', muscle: 'Core', equipment: 'Peso corporal',
      load: 'body', pattern: 'cardio', defaultSets: 3, defaultReps: '30-40 s', defaultRest: 45,
      cues: [
        'Cadera baja y quieta: no rebotes.',
        'Rodillas al pecho, ritmo constante.',
        'Manos firmes bajo los hombros.',
      ],
    },
    {
      // OJO: el repositorio de origen no incluye este ejercicio (no existe la carpeta
      // 'Burpee'). Con id vacío la app dibuja el pictograma vectorial local. Para ponerle
      // figura propia, subí tu GIF/SVG y poné acá el nombre de su carpeta.
      key: 'burpee', id: '', name: 'Burpees',
      nameEn: 'Burpee', muscle: 'Cuerpo completo', equipment: 'Peso corporal',
      load: 'body', pattern: 'cardio', defaultSets: 4, defaultReps: '10-15', defaultRest: 60,
      cues: [
        'Pecho al piso en cada repetición.',
        'Saltá con la cadera extendida.',
        'Marcá un ritmo que puedas sostener todas las series.',
      ],
    },
    {
      key: 'jump_rope', id: 'Rope_Jumping', name: 'Salto de soga',
      nameEn: 'Rope Jumping', muscle: 'Cuerpo completo', equipment: 'Otro',
      load: 'other', pattern: 'cardio', defaultSets: 5, defaultReps: '60 s', defaultRest: 45,
      cues: [
        'Saltos bajos, apenas te despegás del piso.',
        'Muñecas, no brazos enteros.',
        'Rodillas suaves al caer.',
      ],
    },
    {
      key: 'kb_swing', id: 'One-Arm_Kettlebell_Swings', name: 'Swing con pesa rusa',
      nameEn: 'One-Arm Kettlebell Swings', muscle: 'Cuerpo completo', equipment: 'Otro',
      load: 'other', pattern: 'hinge', defaultSets: 5, defaultReps: '15-20', defaultRest: 60,
      cues: [
        'Es un movimiento de cadera, no de brazos.',
        'La pesa flota: la cadera la lanza hacia adelante.',
        'Espalda neutra en cada repetición.',
      ],
    },
    {
      key: 'box_jump', id: 'Box_Jump_Multiple_Response', name: 'Salto al cajón',
      nameEn: 'Box Jump', muscle: 'Cuerpo completo', equipment: 'Otro',
      load: 'other', pattern: 'cardio', defaultSets: 4, defaultReps: '6-8', defaultRest: 90,
      cues: [
        'Cajón a una altura que te deje aterrizar seguro.',
        'Caé suave, con rodillas flexionadas y absorbentes.',
        'Bajá del cajón caminando, no saltando.',
      ],
    },
    {
      key: 'battle_ropes', id: 'Battling_Ropes', name: 'Cuerdas de batalla',
      nameEn: 'Battle Ropes', muscle: 'Cuerpo completo', equipment: 'Otro',
      load: 'other', pattern: 'cardio', defaultSets: 5, defaultReps: '30 s', defaultRest: 45,
      cues: [
        'Rodillas semiflexionadas y core firme.',
        'Ondas rápidas y continuas hasta el anclaje.',
        'Respirá: no aguantes el aire.',
      ],
    },
    {
      key: 'farmers_walk', id: 'Farmers_Walk', name: 'Caminata del granjero',
      nameEn: 'Farmers Walk', muscle: 'Cuerpo completo', equipment: 'Mancuernas',
      load: 'dumbbell', pattern: 'cardio', defaultSets: 4, defaultReps: '40 m', defaultRest: 90,
      cues: [
        'Hombros atrás y abajo, pasos cortos.',
        'Torso vertical, sin inclinarte a un lado.',
        'Apretá el core como si fueran a golpearte.',
      ],
    },
    {
      key: 'rowing_machine', id: 'Rowing_Stationary', name: 'Remo ergómetro',
      nameEn: 'Rowing, Stationary', muscle: 'Cuerpo completo', equipment: 'Máquina',
      load: 'machine', pattern: 'cardio', defaultSets: 4, defaultReps: '2 min', defaultRest: 60,
      cues: [
        'Secuencia: piernas, cadera, brazos. Al volver, al revés.',
        'El impulso sale de las piernas, no del torso.',
        'Ritmo sostenible: 20-24 paladas por minuto.',
      ],
    },
  ],
};

// Índice rápido por clave (no editar).
window.GYM_DATA.index = Object.fromEntries(window.GYM_DATA.exercises.map(e => [e.key, e]));
