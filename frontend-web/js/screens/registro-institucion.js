/* Registro público de instituciones y sus necesidades de voluntariado. */

import { API } from '../api.js';
import { icon, esc, toast, cargarBoton, anunciar } from '../ui.js';
import { navegar } from '../router.js';

const TIPOS = [
  { valor: 'COMEDOR', etiqueta: 'Comedor' },
  { valor: 'HOGAR', etiqueta: 'Hogar' },
  { valor: 'BIBLIOTECA', etiqueta: 'Biblioteca' },
  { valor: 'CENTRO_DIA', etiqueta: 'Centro de día' },
  { valor: 'OTRO', etiqueta: 'Otro' },
];

const PRIORIDADES = [
  { valor: 'GENERAL', etiqueta: 'General' },
  { valor: 'PRIORITARIA', etiqueta: 'Prioritaria' },
  { valor: 'URGENTE', etiqueta: 'Urgente' },
];

export async function render(contenedor) {
  let necesidades = [nuevaNecesidad()];
  let enviando = false;

  contenedor.innerHTML = `
    <section class="pantalla pantalla-registro-inst">
      <header class="contacto-hero">
        <h1>${icon('town')} Sumar mi institución</h1>
        <p>Completá los datos y las necesidades de voluntariado. Al enviar el formulario vas a recibir un código QR para que tus voluntarios validen su presencia.</p>
      </header>

      <form id="inst-form" class="inst-form" novalidate>
        <div class="panel">
          <label class="campo" for="inst-nombre">
            <span class="campo-etiqueta">Nombre de la institución <span class="req">*</span></span>
            <input class="campo-input" id="inst-nombre" maxlength="120" required autocomplete="organization" placeholder="Ej. Comedor Los Amigos">
          </label>

          <label class="campo" for="inst-tipo">
            <span class="campo-etiqueta">Tipo de institución <span class="req">*</span></span>
            <select class="campo-input" id="inst-tipo" required>
              ${TIPOS.map(
                (t) =>
                  `<option value="${t.valor}" ${t.valor === 'COMEDOR' ? 'selected' : ''}>${t.etiqueta}</option>`
              ).join('')}
            </select>
          </label>

          <label class="campo" for="inst-direccion">
            <span class="campo-etiqueta">Dirección <span class="req">*</span></span>
            <input class="campo-input" id="inst-direccion" maxlength="160" required autocomplete="street-address" placeholder="Calle, número y localidad">
          </label>

          <label class="campo" for="inst-telefono">
            <span class="campo-etiqueta">Teléfono de contacto</span>
            <input class="campo-input" id="inst-telefono" type="tel" maxlength="30" autocomplete="tel" placeholder="Ej. 221 555-5555">
          </label>

          <label class="campo" for="inst-descripcion">
            <span class="campo-etiqueta">Sobre la institución</span>
            <textarea class="campo-input" id="inst-descripcion" rows="3" maxlength="600" placeholder="Quiénes son, a quiénes acompañan, en qué horarios…"></textarea>
          </label>
        </div>

        <div class="seccion-cabecera mt-2">
          <h2>Necesidades de voluntariado</h2>
          <span class="chip">${icon('users')} Al menos una</span>
        </div>
        <p class="campo-ayuda" style="margin-bottom:0.6rem">Contá qué ayuda necesitan y cuántas personas. Los voluntarios verán esta información para elegir cómo colaborar.</p>

        <div id="inst-necesidades"></div>

        <button type="button" class="btn btn-secundario btn-block" id="inst-agregar">${icon(
          'plus'
        )} Agregar otra necesidad</button>

        <p class="campo-error mt-1" id="inst-error" role="alert" hidden></p>

        <button type="submit" class="btn btn-primario btn-block btn-lg mt-2" id="inst-enviar">${icon(
          'send'
        )} Enviar registro</button>
        <button type="button" class="btn btn-fantasma btn-block mt-1" data-volver>Volver al voluntariado</button>
      </form>

      <div id="inst-resultado" hidden></div>
    </section>
  `;

  const form = contenedor.querySelector('#inst-form');
  const zona = contenedor.querySelector('#inst-necesidades');
  const errorEl = contenedor.querySelector('#inst-error');
  const resultado = contenedor.querySelector('#inst-resultado');

  contenedor.querySelector('[data-volver]').addEventListener('click', () => navegar('/voluntariado'));
  contenedor.querySelector('#inst-agregar').addEventListener('click', () => {
    if (necesidades.length >= 10) {
      toast('Podés cargar hasta 10 necesidades por institución.', 'aviso');
      return;
    }
    necesidades.push(nuevaNecesidad());
    pintarNecesidades();
    const editores = zona.querySelectorAll('.necesidad-editor');
    editores[editores.length - 1]?.querySelector('input')?.focus();
  });

  function actualizarCampoNecesidad(ev) {
    const campo = ev.target.dataset.campo;
    if (!campo) return;
    const editor = ev.target.closest('.necesidad-editor');
    const indice = Number(editor?.dataset.indice);
    if (!Number.isInteger(indice) || !necesidades[indice]) return;
    necesidades[indice][campo] = ev.target.value;
  }

  zona.addEventListener('input', actualizarCampoNecesidad);
  zona.addEventListener('change', actualizarCampoNecesidad);

  function nuevaNecesidad() {
    return { titulo: '', descripcion: '', cupoMaximo: 1, prioridad: 'GENERAL' };
  }

  function pintarNecesidades() {
    zona.innerHTML = necesidades
      .map(
        (n, i) => `
        <div class="necesidad-editor" data-indice="${i}">
          <div class="necesidad-editor-cab">
            <strong>Necesidad ${i + 1}</strong>
            <button type="button" class="icon-btn" data-quitar aria-label="Quitar necesidad ${i + 1}">${icon(
              'trash'
            )}</button>
          </div>
          <label class="campo" for="nec-titulo-${i}">
            <span class="campo-etiqueta">Qué necesitan <span class="req">*</span></span>
            <input class="campo-input" id="nec-titulo-${i}" data-campo="titulo" maxlength="120" value="${esc(
              n.titulo
            )}" placeholder="Ej. Cocineros para los sábados">
          </label>
          <label class="campo" for="nec-desc-${i}">
            <span class="campo-etiqueta">Detalles</span>
            <textarea class="campo-input" id="nec-desc-${i}" data-campo="descripcion" rows="2" maxlength="500" placeholder="Días, horarios, materiales…">${esc(
              n.descripcion
            )}</textarea>
          </label>
          <div class="fila-campos">
            <div class="campo" style="margin-bottom:0">
              <span class="campo-etiqueta">Voluntarios necesarios</span>
              <div class="fila" style="gap:0.5rem;align-items:center">
                <button type="button" class="icon-btn" data-menos aria-label="Restar voluntario">${icon(
                  'minus'
                )}</button>
                <strong data-cupo-valor style="min-width:2rem;text-align:center">${Number(
                  n.cupoMaximo
                )}</strong>
                <button type="button" class="icon-btn" data-mas aria-label="Sumar voluntario">${icon(
                  'plus'
                )}</button>
              </div>
            </div>
            <div class="campo" style="margin-bottom:0">
              <span class="campo-etiqueta">Prioridad</span>
              <select class="campo-input" data-campo="prioridad" aria-label="Prioridad de la necesidad ${i + 1}">
                ${PRIORIDADES.map(
                  (p) =>
                    `<option value="${p.valor}" ${n.prioridad === p.valor ? 'selected' : ''}>${p.etiqueta}</option>`
                ).join('')}
              </select>
            </div>
          </div>
        </div>`
      )
      .join('');

    zona.querySelectorAll('.necesidad-editor').forEach((editor) => {
      const indice = Number(editor.dataset.indice);
      editor.querySelector('[data-quitar]').addEventListener('click', () => {
        if (necesidades.length === 1) {
          toast('Tiene que quedar al menos una necesidad.', 'aviso');
          return;
        }
        necesidades.splice(indice, 1);
        pintarNecesidades();
      });

      editor.querySelector('[data-mas]').addEventListener('click', () => actualizarCupo(indice, 1, editor));
      editor.querySelector('[data-menos]').addEventListener('click', () => actualizarCupo(indice, -1, editor));
    });
  }

  function actualizarCupo(indice, paso, editor) {
    const necesidad = necesidades[indice];
    if (!necesidad) return;
    necesidad.cupoMaximo = Math.min(99, Math.max(1, Number(necesidad.cupoMaximo) + paso));
    editor.querySelector('[data-cupo-valor]').textContent = String(necesidad.cupoMaximo);
  }

  const mostrarError = (texto) => {
    errorEl.textContent = texto || '';
    errorEl.hidden = !texto;
    if (texto) errorEl.focus();
  };

  function mostrarResultado(datos, mensaje) {
    const codigo = datos?.qr_codigo_hash || '';
    form.hidden = true;
    resultado.hidden = false;
    resultado.innerHTML = `
      <div class="nexo-card">
        <h3>${icon('checkcircle')} ¡Institución registrada!</h3>
        <p>${esc(mensaje || 'Ya forma parte de Switch.')}</p>
      </div>
      ${
        codigo
          ? `<div class="panel mt-1">
              <p class="negrita" style="font-size:0.85rem">${icon(
                'qr'
              )} Código QR de ${esc(datos.nombre || 'la institución')}</p>
              <p class="campo-ayuda">Este es el texto que debe contener el QR impreso. Los voluntarios lo escanean al llegar para validar su presencia.</p>
              <div class="mod-texto" style="text-align:center;font-weight:900;letter-spacing:0.03em;word-break:break-all">${esc(
                codigo
              )}</div>
              <div class="fila" style="gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem">
                <button type="button" class="btn btn-secundario btn-sm" id="inst-copiar">${icon(
                  'clipboard'
                )} Copiar código</button>
                <button type="button" class="btn btn-secundario btn-sm" id="inst-descargar">${icon(
                  'upload'
                )} Descargar</button>
              </div>
            </div>`
          : ''
      }
      <button type="button" class="btn btn-primario btn-block mt-2" id="inst-ir-voluntariado">${icon(
        'users'
      )} Ver instituciones</button>
      <button type="button" class="btn btn-fantasma btn-block mt-1" id="inst-otra">Registrar otra institución</button>
    `;

    resultado.querySelector('#inst-copiar')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(codigo);
        toast('Código copiado.', 'exito');
      } catch (e) {
        toast('Mantené presionado el código para copiarlo.', 'aviso');
      }
    });

    resultado.querySelector('#inst-descargar')?.addEventListener('click', () => {
      const texto = `Switch - ${datos.nombre || 'Institución'}\nCódigo QR: ${codigo}\n\nEste código debe estar codificado en el QR que se escanea al validar la presencia.\n`;
      const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `switch-qr-${(datos.nombre || 'institucion')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    resultado.querySelector('#inst-ir-voluntariado').addEventListener('click', () =>
      navegar('/voluntariado')
    );
    resultado.querySelector('#inst-otra').addEventListener('click', () => {
      form.reset();
      necesidades = [nuevaNecesidad()];
      pintarNecesidades();
      enviando = false;
      const enviarOtraVez = contenedor.querySelector('#inst-enviar');
      if (enviarOtraVez) {
        enviarOtraVez.disabled = false;
        enviarOtraVez.innerHTML = `${icon('send')} Enviar registro`;
      }
      form.hidden = false;
      resultado.hidden = true;
      resultado.innerHTML = '';
      form.querySelector('#inst-nombre').focus();
    });

    anunciar('Institución registrada correctamente.');
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviando) return;

    const nombre = contenedor.querySelector('#inst-nombre').value.trim();
    const tipo = contenedor.querySelector('#inst-tipo').value;
    const direccion = contenedor.querySelector('#inst-direccion').value.trim();
    const telefono = contenedor.querySelector('#inst-telefono').value.trim();
    const descripcion = contenedor.querySelector('#inst-descripcion').value.trim();

    if (!nombre || !tipo || !direccion) {
      mostrarError('Completá el nombre, el tipo y la dirección de la institución.');
      return;
    }

    const cargadas = necesidades
      .map((n) => ({
        titulo: String(n.titulo || '').trim(),
        descripcion: String(n.descripcion || '').trim(),
        cupoMaximo: Math.min(99, Math.max(1, Number(n.cupoMaximo) || 1)),
        prioridad: n.prioridad,
      }))
      .filter((n) => n.titulo);

    if (!cargadas.length) {
      mostrarError('Cargá al menos una necesidad con su título.');
      zona.querySelector('input')?.focus();
      return;
    }

    mostrarError('');
    enviando = true;
    const enviar = contenedor.querySelector('#inst-enviar');
    const restaurar = cargarBoton(enviar, 'Enviando…');
    try {
      const res = await API.registrarInstitucion({
        nombre,
        tipo,
        direccion,
        telefono: telefono || undefined,
        descripcion: descripcion || undefined,
        necesidades: cargadas,
      });
      mostrarResultado(res?.datos || {}, res?.mensaje);
      toast('Institución registrada. ¡Gracias por sumarte!', 'exito', 5000);
    } catch (e) {
      mostrarError(e?.message || 'No pudimos registrar la institución. Revisá los datos.');
      enviando = false;
      restaurar();
    }
  });

  pintarNecesidades();
  return () => {};
}
