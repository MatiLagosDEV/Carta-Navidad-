let TODOS_LOS_REGALOS = [];
let regaloSeleccionado = null;

const $ = (id) => document.getElementById(id);
const ETIQUETAS = { disponible: 'Disponible', reservado: 'Reservado', entregado: 'Entregado' };

async function cargarRegalos() {
  try {
    TODOS_LOS_REGALOS = await Datos.regalos();
  } catch (e) {
    $('grid').innerHTML = '<p class="mensaje error">No se pudo cargar la lista. Recarga la página.</p>';
    return;
  }
  llenarFiltroInstituciones(TODOS_LOS_REGALOS);
  renderResumen(TODOS_LOS_REGALOS);
  aplicarFiltros();
}

function llenarFiltroInstituciones(data) {
  const select = $('filtroInstitucion');
  const actuales = new Set([...select.options].map(o => o.value));
  [...new Set(data.map(r => r.institucion))].sort().forEach(inst => {
    if (actuales.has(inst)) return;
    const opcion = document.createElement('option');
    opcion.value = inst;
    opcion.textContent = inst;
    select.appendChild(opcion);
  });
}

function renderResumen(data) {
  const cuenta = e => data.filter(r => r.estado === e).length;
  $('resumen').innerHTML = `
    <span class="pill"><b>${data.length}</b> niños en la lista</span>
    <span class="pill"><b>${cuenta('disponible')}</b> disponibles</span>
    <span class="pill"><b>${cuenta('reservado')}</b> reservados</span>
    <span class="pill"><b>${cuenta('entregado')}</b> entregados</span>`;
}

function renderGrid(data) {
  const grid = $('grid');
  if (!data.length) {
    grid.innerHTML = '<p>No hay regalos que coincidan con tu búsqueda.</p>';
    return;
  }
  // Las fotos se muestran solo si el panel las tiene activadas.
  const conFotos = window.CFG && window.CFG.fotos_regalos === 'si';

  grid.innerHTML = data.map(r => `
    <div class="card">
      ${conFotos && r.foto_url
        ? `<img class="card-foto" src="${esc(r.foto_url)}" alt="Regalo para ${esc(r.nombre_nino)}" loading="lazy">`
        : ''}
      <span class="institucion">${esc(r.institucion)}</span>
      <h3>${esc(r.nombre_nino)}</h3>
      <div class="opciones">
        <div><b>Opción 1:</b> ${esc(r.opcion1)}</div>
        ${r.opcion2 ? `<div><b>Opción 2:</b> ${esc(r.opcion2)}</div>` : ''}
      </div>
      <span class="estado-badge estado-${r.estado}">${ETIQUETAS[r.estado] || r.estado}</span>
      ${r.estado === 'disponible'
        ? `<button class="btn btn-primario" data-reservar="${r.id}">Reservar este regalo</button>`
        : `<button class="btn btn-primario" disabled>${r.estado === 'reservado' ? 'Ya reservado' : 'Ya entregado'}</button>`}
    </div>`).join('');
}

function aplicarFiltros() {
  const texto = $('buscador').value.trim().toLowerCase();
  const institucion = $('filtroInstitucion').value;
  const estado = $('filtroEstado').value;

  renderGrid(TODOS_LOS_REGALOS.filter(r => {
    const enTexto = !texto ||
      r.nombre_nino.toLowerCase().includes(texto) ||
      r.opcion1.toLowerCase().includes(texto) ||
      (r.opcion2 || '').toLowerCase().includes(texto);
    return enTexto &&
      (!institucion || r.institucion === institucion) &&
      (!estado || r.estado === estado);
  }));
}

['buscador', 'filtroInstitucion', 'filtroEstado'].forEach(id => {
  $(id).addEventListener('input', aplicarFiltros);
  $(id).addEventListener('change', aplicarFiltros);
});

// --- Modal de reserva ---
$('grid').addEventListener('click', (e) => {
  const id = e.target.dataset && e.target.dataset.reservar;
  if (id) abrirModalReserva(id);
});

function abrirModalReserva(id) {
  regaloSeleccionado = TODOS_LOS_REGALOS.find(r => r.id === id);
  if (!regaloSeleccionado) return;

  $('modalTitulo').textContent = `Reservar regalo para ${regaloSeleccionado.nombre_nino}`;
  $('modalDetalle').textContent = regaloSeleccionado.opcion1 +
    (regaloSeleccionado.opcion2 ? ' / ' + regaloSeleccionado.opcion2 : '');
  $('inputNombre').value = '';
  $('inputContacto').value = '';
  $('mensajeReserva').innerHTML = '';
  $('overlayReserva').classList.remove('oculto');
  $('inputNombre').focus();
}

function cerrarModalReserva() {
  $('overlayReserva').classList.add('oculto');
  regaloSeleccionado = null;
}

$('btnCancelar').addEventListener('click', cerrarModalReserva);
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModalReserva(); });

$('btnConfirmarReserva').addEventListener('click', async () => {
  const nombre = $('inputNombre').value.trim();
  const contacto = $('inputContacto').value.trim();
  const caja = $('mensajeReserva');

  if (!nombre || !contacto) {
    caja.innerHTML = '<div class="mensaje error">Completa tu nombre y contacto.</div>';
    return;
  }
  if (!regaloSeleccionado) return;

  const boton = $('btnConfirmarReserva');
  boton.disabled = true;
  boton.textContent = 'Reservando...';

  let resultado;
  try {
    resultado = await Datos.reservar(regaloSeleccionado.id, nombre, contacto);
  } catch (e) {
    resultado = { ok: false, motivo: 'error' };
  }

  boton.disabled = false;
  boton.textContent = 'Confirmar reserva';

  if (!resultado.ok) {
    caja.innerHTML = resultado.motivo === 'ya_reservado'
      ? '<div class="mensaje error">Justo se acaba de reservar por otra persona. Elige otro regalo 🙏</div>'
      : '<div class="mensaje error">Ocurrió un error. Intenta de nuevo.</div>';
    await cargarRegalos();
    return;
  }

  caja.innerHTML = `<div class="mensaje ok exito-animado"><span class="check-ok"></span>
    ¡Gracias! Tu reserva quedó registrada. Te contactaremos para coordinar la entrega.</div>`;
  await cargarRegalos();
  setTimeout(cerrarModalReserva, 2600);
});

document.addEventListener('layout-listo', cargarRegalos);
