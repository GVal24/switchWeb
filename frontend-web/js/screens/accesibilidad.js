/* Preferencias de accesibilidad: tamaño de texto, paletas, blanco y negro. */

import { Store } from '../store.js';
import { icon, toast, anunciar, dialogo } from '../ui.js';

const PALETAS = [
  {
    id: 'estandar',
    nombre: 'Estándar',
    desc: 'Azul noche y verde',
  },
  {
    id: 'menta',
    nombre: 'Clara',
    desc: 'Menta, turquesa y coral',
  },
  {
    id: 'accesible',
    nombre: 'Alta legibilidad',
    desc: 'Negro, blanco y bordes marcados',
  },
  {
    id: 'contraste',
    nombre: 'Máximo contraste',
    desc: 'Amarillo sobre negro',
  },
  {
    id: 'suave',
    nombre: 'Cálida y suave',
    desc: 'Menos brillo, tonos arena',
  },
];

export async function render(contenedor) {
  const acc = Store.cargarAccesibilidad();
  const paletaActual = () =>
    Store.acc.altoContraste
      ? 'contraste'
      : Store.acc.paletaSuave
        ? 'suave'
        : Store.acc.paletaMenta
          ? 'menta'
          : Store.acc.vistaAccesible
            ? 'accesible'
            : 'estandar';

  contenedor.innerHTML = `
    <section class="pantalla pantalla-accesibilidad">
      <header class="acc-hero">
        <h1>${icon('accessibility')} A tu manera</h1>
        <p>Ajustá cómo se ve Switch. Los cambios se guardan en este dispositivo y se aplican al instante.</p>
      </header>

      <section class="acc-grupo" aria-labelledby="acc-titulo-texto">
        <h2 class="acc-grupo-titulo" id="acc-titulo-texto">${icon('texto')} Tamaño del texto</h2>
        <div class="panel">
          <div class="fila" style="justify-content:space-between;align-items:center">
            <span class="negrita" id="acc-escala-valor">${Math.round(Store.acc.escala * 100)}%</span>
            <span class="texto-suave texto-chico">100% a 150%</span>
          </div>
          <input class="slider" type="range" id="acc-escala" min="100" max="150" step="5" value="${Math.round(
            Store.acc.escala * 100
          )}" aria-labelledby="acc-titulo-texto" aria-valuetext="${Math.round(
    Store.acc.escala * 100
  )}%">
          <p class="campo-ayuda">Aumenta el texto de toda la aplicación sin romper los botones ni las tarjetas.</p>
        </div>
      </section>

      <section class="acc-grupo" aria-labelledby="acc-titulo-paleta">
        <h2 class="acc-grupo-titulo" id="acc-titulo-paleta">${icon('palette')} Paleta de colores</h2>
        <div class="paletas" role="group" aria-labelledby="acc-titulo-paleta">
          ${PALETAS.map(
            (p) => `
            <button type="button" class="paleta-opcion" data-paleta="${p.id}" aria-pressed="${
              paletaActual() === p.id
            }">
              <span class="paleta-muestra ${p.id}" aria-hidden="true">Aa</span>
              <span class="paleta-texto"><strong>${p.nombre}</strong><span>${p.desc}</span></span>
            </button>`
          ).join('')}
        </div>
      </section>

      <section class="acc-grupo" aria-labelledby="acc-titulo-extra">
        <h2 class="acc-grupo-titulo" id="acc-titulo-extra">${icon('sliders')} Más ajustes</h2>
        <div class="pila">
          <label class="interruptor ${Store.acc.blancoNegro ? 'activo' : ''}" for="acc-bn">
            <span class="interruptor-texto">
              <span class="interruptor-titulo">Blanco y negro</span>
              <span class="interruptor-desc">Quita todo el color de la pantalla. Útil si te molesta el contraste cromático.</span>
            </span>
            <input type="checkbox" id="acc-bn" ${Store.acc.blancoNegro ? 'checked' : ''}>
            <span class="interruptor-pista" aria-hidden="true"></span>
          </label>
          <label class="interruptor ${Store.acc.vistaAccesible ? 'activo' : ''}" for="acc-vista">
            <span class="interruptor-texto">
              <span class="interruptor-titulo">Vista simplificada</span>
              <span class="interruptor-desc">Refuerza bordes y contrastes para leer mejor. Se combina con la paleta elegida.</span>
            </span>
            <input type="checkbox" id="acc-vista" ${Store.acc.vistaAccesible ? 'checked' : ''}>
            <span class="interruptor-pista" aria-hidden="true"></span>
          </label>
        </div>
      </section>

      <section class="acc-grupo" aria-labelledby="acc-titulo-preview">
        <h2 class="acc-grupo-titulo" id="acc-titulo-preview">${icon('eye')} Así se ve</h2>
        <div class="acc-preview">
          <div class="acc-preview-cab">
            <span class="avatar" aria-hidden="true">S</span>
            <div>
              <p class="acc-preview-titulo">Una plaza, dos vecinos</p>
              <p class="acc-preview-sub">Intercambio · hace un rato</p>
            </div>
          </div>
          <p class="acc-preview-texto">“Tengo una bicicleta rodado 26 para dar y busco una heladera chica que funcione.”</p>
          <div class="acc-preview-botones">
            <span class="btn btn-primario btn-sm">Proponer trueque</span>
            <span class="btn btn-secundario btn-sm">Ver detalle</span>
          </div>
        </div>
      </section>

      <button type="button" class="btn btn-fantasma btn-block acc-reset" id="acc-restablecer">${icon(
        'refresh'
      )} Restablecer todo</button>

      <p class="campo-ayuda" style="text-align:center;margin-top:0.8rem">Los ajustes son personales de este navegador. No cambian la experiencia de otras personas.</p>
    </section>
  `;

  const escala = contenedor.querySelector('#acc-escala');
  const valor = contenedor.querySelector('#acc-escala-valor');
  const bn = contenedor.querySelector('#acc-bn');
  const vista = contenedor.querySelector('#acc-vista');

  const refrescarUI = () => {
    valor.textContent = `${Math.round(Store.acc.escala * 100)}%`;
    escala.value = String(Math.round(Store.acc.escala * 100));
    escala.setAttribute('aria-valuetext', `${Math.round(Store.acc.escala * 100)}%`);
    bn.checked = Store.acc.blancoNegro;
    vista.checked = Store.acc.vistaAccesible;
    bn.closest('.interruptor').classList.toggle('activo', Store.acc.blancoNegro);
    vista.closest('.interruptor').classList.toggle('activo', Store.acc.vistaAccesible);
    const actual = paletaActual();
    contenedor.querySelectorAll('[data-paleta]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.paleta === actual))
    );
  };

  escala.addEventListener('input', () => {
    const porcentaje = Number(escala.value) || 100;
    Store.guardarAccesibilidad({ escala: porcentaje / 100 });
    valor.textContent = `${porcentaje}%`;
    escala.setAttribute('aria-valuetext', `${porcentaje}%`);
  });
  escala.addEventListener('change', () => {
    anunciar(`Tamaño de texto al ${Math.round(Store.acc.escala * 100)}%.`);
  });

  contenedor.querySelectorAll('[data-paleta]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.paleta;
      if (id === 'contraste') {
        Store.guardarAccesibilidad({ altoContraste: true, paletaSuave: false });
      } else if (id === 'suave') {
        Store.guardarAccesibilidad({ altoContraste: false, paletaSuave: true, paletaMenta: false });
      } else if (id === 'menta') {
        Store.guardarAccesibilidad({ altoContraste: false, paletaSuave: false, paletaMenta: true });
      } else if (id === 'accesible') {
        Store.guardarAccesibilidad({
          altoContraste: false,
          paletaSuave: false,
          paletaMenta: false,
          vistaAccesible: true,
        });
      } else {
        Store.guardarAccesibilidad({
          altoContraste: false,
          paletaSuave: false,
          paletaMenta: false,
          vistaAccesible: false,
        });
      }
      refrescarUI();
      const nombre = PALETAS.find((p) => p.id === id)?.nombre || 'paleta';
      anunciar(`Paleta ${nombre} aplicada.`);
    })
  );

  bn.addEventListener('change', () => {
    Store.guardarAccesibilidad({ blancoNegro: bn.checked });
    refrescarUI();
    anunciar(bn.checked ? 'Blanco y negro activado.' : 'Color restaurado.');
  });

  vista.addEventListener('change', () => {
    Store.guardarAccesibilidad({ vistaAccesible: vista.checked });
    refrescarUI();
    anunciar(vista.checked ? 'Vista simplificada activada.' : 'Vista simplificada desactivada.');
  });

  contenedor.querySelector('#acc-restablecer').addEventListener('click', async () => {
    const elegido = await dialogo({
      titulo: 'Restablecer accesibilidad',
      icono: 'refresh',
      html: '<p class="modal-texto">Volvemos al tamaño y los colores originales. Tus otros datos no cambian.</p>',
      acciones: [
        { texto: 'Cancelar', valor: 'cancelar', clase: 'btn-fantasma' },
        { texto: 'Restablecer', valor: 'ok', clase: 'btn-peligro', auto: true },
      ],
    });
    if (elegido !== 'ok') return;
    Store.restablecerAccesibilidad();
    refrescarUI();
    toast('Preferencias restablecidas.', 'exito');
    anunciar('Preferencias de accesibilidad restablecidas.');
  });

  refrescarUI();
  return () => {};
}
