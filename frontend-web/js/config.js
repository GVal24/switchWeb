/* Configuración de conexión.
   El orden de prioridad para decidir la dirección del backend es:
   1. Lo que la persona haya elegido a mano (Accesibilidad > Conexión),
      guardado en localStorage.
   2. window.SWITCH_API_URL, si el HTML lo define antes de cargar este
      script. Se usa al publicar la web separada del backend (por ejemplo,
      la web en Vercel y el backend en Render).
   3. Si la web y el backend se sirven desde el mismo origen, usa /api.
   4. Si no, apunta al mismo host en el puerto 3000 (desarrollo local con
      Live Server u otro servidor estático). */
(function () {
  var PUERTO_API = 3000;
  var host = location.hostname || 'localhost';

  var mismoOrigen = location.protocol !== 'file:' && location.port === String(PUERTO_API);
  if (location.protocol === 'https:') mismoOrigen = true;

  var mismaRuta = location.origin + '/api';
  var desarrollo = 'http://' + (host === '' ? 'localhost' : host) + ':' + PUERTO_API + '/api';

  var porDefecto = window.SWITCH_API_URL
    ? String(window.SWITCH_API_URL)
    : mismoOrigen
      ? mismaRuta
      : desarrollo;

  var guardada = null;
  try { guardada = localStorage.getItem('switch_api_base'); } catch (e) {}

  var base = (guardada || porDefecto).replace(/\/+$/, '');

  window.SWITCH_CONFIG = {
    apiBase: base,
    puertoApi: PUERTO_API,
    porDefecto: porDefecto.replace(/\/+$/, ''),
    version: '1.0.0',
  };
})();
