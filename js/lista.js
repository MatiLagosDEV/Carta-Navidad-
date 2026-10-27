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
  const regaloSVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef5151" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';

  grid.innerHTML = `
    <div class="lr-tabla-wrap">
      <table class="lr-tabla">
        <thead><tr><th>Niño o niña</th><th>Edad</th><th>Regalo</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td data-label="Niño o niña">${esc(r.nombre_nino)}</td>
              <td data-label="Edad">${r.edad ? `${esc(r.edad)} años` : '—'}</td>
              <td data-label="Regalo"><div class="lr-regalo"><span class="lr-icono">${regaloSVG}</span><div><div class="lr-nombre">${esc(r.opcion1)}</div>${r.opcion2 ? `<div class="lr-detalle">Alternativa: ${esc(r.opcion2)}</div>` : ''}</div></div></td>
              <td data-label="Estado"><span class="estado-badge estado-${r.estado}">${ETIQUETAS[r.estado] || r.estado}</span></td>
              <td data-label="Acción"><button class="btn btn-coral btn-pequeno" data-reservar="${r.id}"${r.estado === 'disponible' ? '' : ' disabled'}>${r.estado === 'disponible' ? 'Cumplir deseo' : 'No disponible'}</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  dibujarLucesLista();
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

function dibujarLucesLista() {
  const wrap = $('lr-wrap');
  const svg = $('lr-luces');
  if (!wrap || !svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const colores = ['#ef4b4b', '#f6c84c', '#3fcf84', '#4db3f0'];
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  const crear = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
    svg.appendChild(el);
    return el;
  };
  const margen = 12;
  const radio = 20;
  const x0 = margen, y0 = margen, x1 = W - margen, y1 = H - margen;
  crear('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: radio, fill: 'none', stroke: '#0b0f0e', 'stroke-width': 1.6 });
  const segmentos = [
    { len: x1 - x0 - radio * 2, en: t => [x0 + radio + t * (x1 - x0 - radio * 2), y0] },
    { len: Math.PI * radio / 2, en: t => { const a = -Math.PI / 2 + t * Math.PI / 2; return [x1 - radio + radio * Math.cos(a), y0 + radio + radio * Math.sin(a)]; } },
    { len: y1 - y0 - radio * 2, en: t => [x1, y0 + radio + t * (y1 - y0 - radio * 2)] },
    { len: Math.PI * radio / 2, en: t => { const a = t * Math.PI / 2; return [x1 - radio + radio * Math.cos(a), y1 - radio + radio * Math.sin(a)]; } },
    { len: x1 - x0 - radio * 2, en: t => [x1 - radio - t * (x1 - x0 - radio * 2), y1] },
    { len: Math.PI * radio / 2, en: t => { const a = Math.PI / 2 + t * Math.PI / 2; return [x0 + radio + radio * Math.cos(a), y1 - radio + radio * Math.sin(a)]; } },
    { len: y1 - y0 - radio * 2, en: t => [x0, y1 - radio - t * (y1 - y0 - radio * 2)] },
    { len: Math.PI * radio / 2, en: t => { const a = Math.PI + t * Math.PI / 2; return [x0 + radio + radio * Math.cos(a), y0 + radio + radio * Math.sin(a)]; } },
  ];
  const total = segmentos.reduce((s, seg) => s + seg.len, 0);
  const n = Math.max(12, Math.round(total / 30));
  for (let i = 0; i < n; i++) {
    let distancia = i * total / n;
    let segmento = segmentos[0];
    for (const actual of segmentos) {
      if (distancia <= actual.len) { segmento = actual; break; }
      distancia -= actual.len;
    }
    const [x, y] = segmento.en(distancia / segmento.len);
    const color = colores[i % colores.length];
    const delay = `${((i % 16) * 0.16).toFixed(2)}s`;
    const duration = `${(1.05 + (i % 4) * 0.16).toFixed(2)}s`;
    const estilo = `--lr-delay:${delay};--lr-duration:${duration}`;
    crear('circle', { cx: x, cy: y, r: 10, fill: color, class: 'lr-halo', style: estilo });
    crear('circle', { cx: x, cy: y, r: 4.6, fill: color, class: 'lr-foco', style: estilo });
    crear('circle', { cx: x - 1.4, cy: y - 1.4, r: 1.3, fill: '#fff', opacity: '.85' });
  }
}

if (window.ResizeObserver) {
  new ResizeObserver(() => requestAnimationFrame(dibujarLucesLista)).observe($('lr-wrap'));
} else {
  window.addEventListener('resize', dibujarLucesLista);
}
