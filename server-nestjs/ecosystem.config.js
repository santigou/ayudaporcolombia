// Configuración de PM2 en modo CLUSTER para el backend NestJS.
// Levanta N procesos (workers) en paralelo —uno por núcleo de CPU, o el valor de
// la variable de entorno WEB_CONCURRENCY— y reparte las conexiones entre ellos.
// Esto multiplica la capacidad del servidor por el número de núcleos.
//
// El chat en tiempo real funciona entre workers gracias al adaptador de Redis:
// cada worker tiene su propio Socket.IO, pero Redis sincroniza salas y mensajes
// entre todos. El cliente usa transporte WebSocket directo (sin polling) para
// evitar la necesidad de "sticky sessions" entre workers.
module.exports = {
  apps: [
    {
      name: 'ayuda-back',
      script: 'dist/main.js',
      // 'max' = un worker por núcleo de CPU. Fija el número con WEB_CONCURRENCY
      // si el contenedor tiene un límite de CPU (cpus:) que PM2 no detecta.
      instances: process.env.WEB_CONCURRENCY || 'max',
      exec_mode: 'cluster',
      // PM2 espera a que cada worker envíe 'ready' (process.send('ready') en
      // main.ts) antes de enrutarle tráfico: evita peticiones a workers tibios.
      wait_ready: true,
      // Tiempo máximo para que el worker haga process.send('ready').
      listen_timeout: 30000,
      // Reinicia automáticamente un worker que muera (sin bajar todo el servicio).
      autorestart: true,
      max_restarts: 10,
      // No reinicia por uso de memoria (dejamos que el límite del contenedor lo
      // gestione Docker). Cámbialo a '1G' si quieres protección contra fugas.
      max_memory_restart: undefined,
      // El entorno "production" (se selecciona con --env production en el
      // entrypoint). Las variables sensibles (DATABASE_URL, REDIS_URL, JWT...)
      // las inyecta docker-compose, no hace falta duplicarlas aquí.
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
