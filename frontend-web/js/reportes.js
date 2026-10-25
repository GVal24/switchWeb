import { API } from './api.js';
import { esc, pedirTexto, toast } from './ui.js';

export async function reportarUsuario(usuarioId, nombreUsuario) {
  const motivo = await pedirTexto({
    titulo: 'Reportar usuario',
    texto: `Contanos qué inconveniente tuviste con <strong>${esc(
      nombreUsuario
    )}</strong>. La administración revisa todos los reportes.`,
    etiqueta: 'Motivo del reporte',
    max: 500,
    requerido: true,
    textoOk: 'Enviar reporte',
    peligro: true,
  });
  if (!motivo) return;

  try {
    await API.reportar(usuarioId, nombreUsuario, motivo);
    toast('Reporte enviado. Gracias por cuidar la comunidad.', 'exito', 4200);
  } catch (e) {
    toast(e?.message || 'No pudimos enviar el reporte.', 'error');
  }
}
