# HIERRO — diario de entrenamiento

> Contexto de producto. Escrito a partir del brief explícito del usuario (2026-10-09).
> Supuestos inferidos del brief están marcados como **supuesto**.
> Este archivo no se sirve al navegador; es documentación de desarrollo.

## Qué es

Web App móvil (PWA, sin backend) para registrar entrenamientos de gimnasio y seguir la
progresión de cargas. Se instala desde el navegador y se despliega gratis en GitHub Pages.

## Para quién

**Supuesto:** persona que entrena con pesas 3–6 días por semana, en un gimnasio, con el
celular en la mano entre series, con una sola mano libre y prisa por volver a la barra.
Habla español. No quiere crear cuentas en servicios de terceros ni pagar suscripción.

## Escena de uso real

Sentado en el banco o de pie junto al rack. Luz de gimnasio, pantalla a media
luminosidad, sesión de 45–75 minutos, entre 15 y 40 series registradas por sesión.
El dato que se toca entre series es siempre el mismo: kilos y repeticiones de la serie
que acaba de terminar, y el cronómetro que arranca después.

## Trabajo principal

Registrar una serie en menos de tres toques y ver actualizado el volumen de la sesión.
Todo lo demás (rutinas, historial, récords, perfil) sirve a ese acto.

## Mecanismo propio

El peso no se escribe: se **carga con discos**. El registro muestra el disco que hay que
poner en cada lado de la barra y el color oficial de ese disco (rojo 25 kg, azul 20,
amarillo 15, verde 10, blanco 5). Cargar bien la barra es el cálculo mental que el
usuario hace cien veces por sesión; la app lo hace por él y lo usa como identidad visual.

## Requisitos obligatorios (del brief)

1. Autenticación local con perfiles múltiples y sesión persistente en `localStorage`.
2. Perfil: nombre, peso actual, objetivo (hipertrofia, fuerza, definición, resistencia).
3. Dashboard: ejercicios programados, volumen total (kg × reps de series hechas),
   porcentaje de progreso del día.
4. Rutinas seleccionables según objetivo.
5. Tarjeta por ejercicio: nombre, grupo muscular, microfigura instructiva desde un
   repositorio de GitHub, series interactivas (objetivo vs. real), check de completado
   con actualización inmediata de estadísticas, temporizador de descanso configurable.
6. Un solo despliegue estático: `index.html` + assets, compatible con GitHub Pages.
7. Comentarios claros para editar la base de ejercicios y cambiar el repositorio de figuras.

## Restricciones

- Sin Node.js en el camino de despliegue, sin paso de compilación, sin backend.
- Tailwind CSS, FontAwesome 6 y Google Fonts por CDN (según brief).
- Los datos viven en el dispositivo: la app debe funcionar con la red caída en el gimnasio
  (solo las microfiguras requieren red; hay respaldo vectorial local).
- Sesión local: el hash de contraseña es para separar perfiles en un dispositivo
  compartido, **no** es seguridad real. Debe decirlo en la interfaz.
- Todo en español rioplatense neutro, unidades kg/lb conmutables.

## Fuera de alcance

- Sincronización entre dispositivos, backend, cuentas en la nube.
- Nutrición, planes de dieta, integración con wearables.
- Compra/venta de planes o funciones de pago.

## Modelo de datos

- `hierro.v1.users` — lista de perfiles locales (nombre, hash, salt, perfil físico).
- `hierro.v1.session` — id del perfil activo.
- `hierro.v1.user.<id>` — rutinas asignadas, sesiones registradas, récords, peso corporal,
  preferencias (unidad, descanso por defecto, sonido/vibración, peso de la barra) y la
  sesión en curso.

## Fuente de microfiguras

Repositorio `yuhonas/free-exercise-db` (dominio público) servido por jsDelivr: dos fotos por
ejercicio (posición inicial y final) que la app cruza en fundido para animar el movimiento.
La base es conmutable desde `data/exercises.js` (`meta.imageBase`).
