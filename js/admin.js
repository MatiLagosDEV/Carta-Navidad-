const $ = (id) => document.getElementById(id);
const ETIQUETAS = { disponible: 'Disponible', reservado: 'Reservado', entregado: 'Entregado' };
let REGALOS = [];

function aviso(texto, tipo) {
  $('mensajeAdmin').innerHTML = `<div class="mensaje ${tipo || 'ok'}">${esc(texto)}</div>`;
  setTimeout(() => { $('mensajeAdmin').innerHTML = ''; }, 3500);
}

// Toda escritura rechazada por la base termina aquí. El caso típico: el usuario
// inició sesión pero no está en la tabla `admins`, así que la RLS lo bloquea.
window.addEventListener('unhandledrejection', (e) => {
  const detalle = (e.reason && e.reason.message) || 'error desconocido';
  aviso(/row-level security|policy|permission/i.test(detalle)
    ? 'La base rechazó el cambio: esta cuenta no tiene permisos de admin. Falta agregarla a la tabla `admins` (ver Paso 3.3 del README).'
    : 'No se pudo guardar: ' + detalle, 'error');
});

// --- Tabs ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('activa'));
    document.querySelectorAll('.panel').forEach(p => p.classList.add('oculto'));
    tab.classList.add('activa');
    $('panel-' + tab.dataset.tab).classList.remove('oculto');
  });
});

$('btnLogout').addEventListener('click', async () => {
  await Datos.logout();
  window.location.href = 'index.html';
});

// --- Regalos ---
async function cargarRegalos() {
  REGALOS = await Datos.regalos(true);
  renderTabla();
}

function regalosFiltrados() {
  const texto = $('buscadorAdmin').value.trim().toLowerCase();
  const estado = $('filtroEstadoAdmin').value;
  return REGALOS.filter(r =>
    (!texto || r.nombre_nino.toLowerCase().includes(texto)) &&
    (!estado || r.estado === estado));
}

function renderTabla() {
  const filas = regalosFiltrados();
  $('tablaBody').innerHTML = filas.length ? filas.map(r => `
    <tr>
      <td>${esc(r.nombre_nino)}</td>
      <td>${esc(r.institucion)}</td>
      <td>${esc(r.opcion1)}</td>
      <td>${esc(r.opcion2)}</td>
      <td><span class="estado-badge estado-${r.estado}">${ETIQUETAS[r.estado]}</span></td>
      <td>${esc(r.nombre_donador)}</td>
      <td>${esc(r.contacto_donador)}</td>
      <td>${esc(r.encargado)}</td>
      <td><div class="acciones-fila">
        <button data-editar="${r.id}">Editar</button>
        ${r.estado === 'reservado' ? `<button data-entregar="${r.id}">Marcar entregado</button>` : ''}
        <button data-borrar="${r.id}">Borrar</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="9">No hay regalos que coincidan.</td></tr>';
}

$('buscadorAdmin').addEventListener('input', renderTabla);
$('filtroEstadoAdmin').addEventListener('change', renderTabla);

$('tablaBody').addEventListener('click', async (e) => {
  const d = e.target.dataset || {};
  if (d.editar) return abrirForm(REGALOS.find(r => r.id === d.editar));
  if (d.entregar) {
    await Datos.editarRegalo(d.entregar, { estado: 'entregado', entregado_at: new Date().toISOString() });
    aviso('Regalo marcado como entregado.');
    return cargarRegalos();
  }
  if (d.borrar) {
    if (!confirm('¿Borrar este regalo de la lista?')) return;
    await Datos.borrarRegalo(d.borrar);
    aviso('Regalo borrado.');
    return cargarRegalos();
  }
});

// --- Foto del regalo ---
// Se guarda al confirmar el formulario, no al elegir el archivo: si el usuario
// cancela, no queda una imagen huérfana en el almacén.
let fotoRegalo = null;   // url ya guardada
let fotoNueva = null;    // File pendiente de subir

function pintarFotoPrevia(url) {
  $('fotoPrevia').classList.toggle('oculto', !url);
  if (url) $('fotoPreviaImg').src = url;
}

$('formFoto').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  fotoNueva = file;
  pintarFotoPrevia(URL.createObjectURL(file));
});

$('btnQuitarFoto').addEventListener('click', () => {
  fotoRegalo = null;
  fotoNueva = null;
  $('formFoto').value = '';
  pintarFotoPrevia(null);
});

function abrirForm(regalo) {
  $('formTitulo').textContent = regalo ? 'Editar regalo' : 'Registrar regalo';
  $('formId').value = regalo ? regalo.id : '';
  fotoRegalo = (regalo && regalo.foto_url) || null;
  fotoNueva = null;
  $('formFoto').value = '';
  pintarFotoPrevia(fotoRegalo);
  $('formNombre').value = regalo ? regalo.nombre_nino : '';
  $('formInstitucion').value = regalo ? regalo.institucion : '';
  $('formOpcion1').value = regalo ? regalo.opcion1 : '';
  $('formOpcion2').value = (regalo && regalo.opcion2) || '';
  $('formEncargado').value = (regalo && regalo.encargado) || '';
  $('formEstado').value = regalo ? regalo.estado : 'disponible';
  $('mensajeForm').innerHTML = '';
  $('overlayForm').classList.remove('oculto');
  $('formNombre').focus();
}

$('btnNuevo').addEventListener('click', () => abrirForm(null));
$('btnCancelarForm').addEventListener('click', () => $('overlayForm').classList.add('oculto'));

$('btnGuardarForm').addEventListener('click', async () => {
  const datos = {
    nombre_nino: $('formNombre').value.trim(),
    institucion: $('formInstitucion').value.trim(),
    opcion1: $('formOpcion1').value.trim(),
    opcion2: $('formOpcion2').value.trim() || null,
    encargado: $('formEncargado').value.trim() || null,
    estado: $('formEstado').value,
  };
  if (!datos.nombre_nino || !datos.institucion || !datos.opcion1) {
    $('mensajeForm').innerHTML = '<div class="mensaje error">Nombre, institución y opción 1 son obligatorios.</div>';
    return;
  }

  const id = $('formId').value;
  const boton = $('btnGuardarForm');
  boton.disabled = true;

  try {
    if (fotoNueva) {
      boton.textContent = 'Subiendo foto...';
      fotoRegalo = await Datos.subirImagen(fotoNueva);
      fotoNueva = null;
    }
    datos.foto_url = fotoRegalo;

    boton.textContent = 'Guardando...';
    if (id) await Datos.editarRegalo(id, datos);
    else await Datos.crearRegalo(datos);
  } catch (e) {
    $('mensajeForm').innerHTML = `<div class="mensaje error">${esc(e.message || 'No se pudo guardar.')}</div>`;
    return;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar';
  }

  $('overlayForm').classList.add('oculto');
  aviso(id ? 'Regalo actualizado.' : 'Regalo registrado.');
  cargarRegalos();
});

// --- Importar planilla (.xlsx / .csv) ---
let regalosAImportar = [];

$('btnImportar').addEventListener('click', () => {
  regalosAImportar = [];
  $('archivoImportar').value = '';
  $('resumenImportar').innerHTML = '';
  $('btnConfirmarImportar').classList.add('oculto');
  $('overlayImportar').classList.remove('oculto');
});

$('btnCancelarImportar').addEventListener('click', () => $('overlayImportar').classList.add('oculto'));

function resumenHTML({ regalos, errores, duplicados, columnasFaltantes }) {
  const NOMBRES = { nombre_nino: 'Nombre', institucion: 'Institución', opcion1: 'Regalo (Opción 1)' };
  if (columnasFaltantes.length) {
    return `<div class="mensaje error">No encontré estas columnas obligatorias:
      <b>${columnasFaltantes.map(c => esc(NOMBRES[c])).join(', ')}</b>.
      Revisa que estén en la primera fila del archivo.</div>`;
  }

  const lineas = [];
  if (regalos.length) lineas.push(`<div class="mensaje ok"><b>${regalos.length}</b> regalos listos para importar.</div>`);
  if (duplicados) lineas.push(`<div class="mensaje">Se omitieron <b>${duplicados}</b> que ya estaban en la lista (mismo niño y misma institución).</div>`);
  if (errores.length) {
    lineas.push(`<div class="mensaje error"><b>${errores.length}</b> filas con problemas, no se van a importar:<ul>
      ${errores.slice(0, 8).map(e => `<li>Fila ${e.fila}: ${esc(e.motivo)}</li>`).join('')}
      ${errores.length > 8 ? `<li>… y ${errores.length - 8} más.</li>` : ''}
    </ul></div>`);
  }
  if (!regalos.length && !errores.length && !duplicados) lineas.push('<div class="mensaje error">El archivo no trae filas con datos.</div>');

  if (regalos.length) {
    lineas.push(`<p class="nota-campo">Vista previa de los primeros:</p>
      <div class="tabla-wrap"><table class="admin-tabla tabla-previa">
        <thead><tr><th>Niño</th><th>Institución</th><th>Opción 1</th><th>Estado</th><th>Donador</th></tr></thead>
        <tbody>${regalos.slice(0, 5).map(r => `<tr>
          <td>${esc(r.nombre_nino)}</td><td>${esc(r.institucion)}</td>
          <td>${esc(r.opcion1)}</td><td>${esc(r.estado)}</td><td>${esc(r.nombre_donador)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`);
  }
  return lineas.join('');
}

$('archivoImportar').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  regalosAImportar = [];
  $('btnConfirmarImportar').classList.add('oculto');
  $('resumenImportar').innerHTML = '<div class="mensaje">Leyendo el archivo…</div>';

  try {
    const libro = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    // defval: '' para que las celdas vacías lleguen como texto vacío y no falten.
    const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

    const resultado = prepararImportacion(filas, REGALOS);
    regalosAImportar = resultado.regalos;
    $('resumenImportar').innerHTML = resumenHTML(resultado);
    $('btnConfirmarImportar').textContent = `Importar ${resultado.regalos.length} regalos`;
    $('btnConfirmarImportar').classList.toggle('oculto', !resultado.regalos.length);
  } catch (err) {
    $('resumenImportar').innerHTML =
      `<div class="mensaje error">No se pudo leer el archivo: ${esc(err.message || 'formato no reconocido')}</div>`;
  }
});

$('btnConfirmarImportar').addEventListener('click', async () => {
  if (!regalosAImportar.length) return;
  const boton = $('btnConfirmarImportar');
  boton.disabled = true;
  boton.textContent = 'Importando…';

  try {
    await Datos.crearRegalos(regalosAImportar);
  } catch (err) {
    $('resumenImportar').innerHTML = `<div class="mensaje error">${esc(err.message || 'No se pudo importar.')}</div>`;
    return;
  } finally {
    boton.disabled = false;
  }

  $('overlayImportar').classList.add('oculto');
  aviso(`${regalosAImportar.length} regalos importados.`);
  regalosAImportar = [];
  cargarRegalos();
});

$('btnExportar').addEventListener('click', () => {
  const cols = ['nombre_nino','institucion','opcion1','opcion2','estado','nombre_donador','contacto_donador','encargado'];
  const csv = [cols.join(',')].concat(regalosFiltrados().map(r =>
    cols.map(c => `"${String(r[c] == null ? '' : r[c]).replace(/"/g, '""')}"`).join(','))).join('\n');
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  enlace.download = 'regalos.csv';
  enlace.click();
});

// --- Comentarios del slider ---
async function cargarComentarios() {
  const lista = await Datos.comentarios();
  $('listaComentarios').innerHTML = lista.map(c => `
    <div class="item-lista">
      <div><p>${esc(c.texto)}</p><small>${esc(c.autor)}</small></div>
      <button data-borrar-com="${c.id}">Borrar</button>
    </div>`).join('') || '<p>Sin comentarios todavía.</p>';
}

$('listaComentarios').addEventListener('click', async (e) => {
  const id = e.target.dataset && e.target.dataset.borrarCom;
  if (!id) return;
  await Datos.borrarComentario(id);
  aviso('Comentario borrado.');
  cargarComentarios();
});

$('formComentario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = $('comTexto').value.trim();
  const autor = $('comAutor').value.trim();
  if (!texto || !autor) return aviso('Faltan datos del comentario.', 'error');

  await Datos.crearComentario(texto, autor);
  $('comTexto').value = '';
  $('comAutor').value = '';
  aviso('Comentario agregado al slider.');
  cargarComentarios();
});

// --- Configuración del sitio ---
// [etiqueta, tipo]. El tipo decide qué control se dibuja: todos son controles
// nativos del navegador, no hay librerías de color ni de subida de archivos.
const CAMPOS_CONFIG = {
  nombre_campana:     ['Nombre de la campaña', 'texto'],
  anio:               ['Año', 'texto'],
  email_contacto:     ['Email de contacto', 'texto'],
  instagram:          ['URL de Instagram', 'texto'],
  instagram_usuario:  ['Usuario de Instagram', 'texto'],
  tiktok:             ['URL de TikTok', 'texto'],
  linkedin:           ['URL de LinkedIn', 'texto'],
  linkedin_usuario:   ['Nombre en LinkedIn', 'texto'],
  texto_footer:       ['Texto del footer', 'largo'],
  aviso_home:         ['Aviso de la portada', 'largo'],
  legal:              ['Línea legal', 'texto'],
  fotos_regalos:      ['Mostrar la foto de cada regalo en el sitio', 'switch'],
  color_fondo:        ['Color de fondo del sitio', 'color'],
  color_acento:       ['Color de los botones y acentos', 'color'],
  color_claro:        ['Color de los bloques claros y del texto', 'color'],
  foto_sobre_1:       ['Sobre nosotros — foto de arriba', 'imagen'],
  foto_sobre_2:       ['Sobre nosotros — foto de abajo', 'imagen'],
  foto_voluntarios_1: ['Voluntarios — foto de arriba', 'imagen'],
  foto_voluntarios_2: ['Voluntarios — foto de abajo', 'imagen'],
};

function controlConfig(clave, tipo, valor) {
  const id = `cfg_${clave}`;
  if (tipo === 'largo') return `<textarea id="${id}" data-clave="${clave}">${esc(valor)}</textarea>`;

  if (tipo === 'switch') return `
    <select id="${id}" data-clave="${clave}">
      <option value="si"${valor === 'si' ? ' selected' : ''}>Sí, mostrarlas</option>
      <option value="no"${valor !== 'si' ? ' selected' : ''}>No mostrarlas</option>
    </select>`;

  if (tipo === 'color') return `
    <div class="campo-color">
      <input type="color" id="${id}" data-clave="${clave}" value="${esc(valor)}">
      <output for="${id}">${esc(valor)}</output>
    </div>`;

  if (tipo === 'imagen') return `
    <div class="campo-imagen">
      <img src="${esc(valor)}" alt="">
      <div>
        <input type="hidden" id="${id}" data-clave="${clave}" value="${esc(valor)}">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-sube-a="${id}">
      </div>
    </div>`;

  return `<input type="text" id="${id}" data-clave="${clave}" value="${esc(valor)}">`;
}

async function cargarConfig() {
  const cfg = await Datos.config();
  $('formConfig').innerHTML = Object.keys(CAMPOS_CONFIG).map(clave => {
    const [etiqueta, tipo] = CAMPOS_CONFIG[clave];
    return `<label for="cfg_${clave}">${etiqueta}</label>${controlConfig(clave, tipo, cfg[clave] || '')}`;
  }).join('') + '<button class="btn btn-primario" type="submit">Guardar configuración</button>';
}

// El color elegido se ve al lado del selector mientras se arrastra.
$('formConfig').addEventListener('input', (e) => {
  if (e.target.type !== 'color') return;
  const salida = e.target.parentElement.querySelector('output');
  if (salida) salida.textContent = e.target.value;
});

// Subir una foto de página: se guarda de inmediato en el almacén y su URL
// queda en el campo oculto, que es lo que se envía al guardar.
$('formConfig').addEventListener('change', async (e) => {
  const destino = e.target.dataset && e.target.dataset.subeA;
  if (!destino || !e.target.files[0]) return;

  const contenedor = e.target.closest('.campo-imagen');
  contenedor.classList.add('subiendo');
  try {
    const url = await Datos.subirImagen(e.target.files[0]);
    $(destino).value = url;
    contenedor.querySelector('img').src = url;
    aviso('Foto subida. Recuerda guardar la configuración.');
  } catch (err) {
    aviso(err.message || 'No se pudo subir la foto.', 'error');
  } finally {
    contenedor.classList.remove('subiendo');
    e.target.value = '';
  }
});

$('formConfig').addEventListener('submit', async (e) => {
  e.preventDefault();
  const campos = {};
  $('formConfig').querySelectorAll('[data-clave]').forEach(campo => { campos[campo.dataset.clave] = campo.value; });
  try {
    await Datos.guardarConfig(campos);
    aviso('Configuración guardada. Recarga el sitio para verla.');
  } catch (err) {
    aviso('No se pudo guardar la configuración.', 'error');
  }
});

// --- Mensajes de contacto ---
async function cargarMensajes() {
  const lista = await Datos.mensajes();
  $('listaMensajes').innerHTML = lista.map(m => `
    <div class="item-lista">
      <div>
        <b>${esc(m.nombre)}</b> — <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>
        <p>${esc(m.texto)}</p>
        <small>${esc(String(m.created_at).replace('T', ' ').slice(0, 16))}</small>
      </div>
      <button data-borrar-msj="${m.id}">Borrar</button>
    </div>`).join('') || '<p>Todavía no llegan mensajes.</p>';
}

$('listaMensajes').addEventListener('click', async (e) => {
  const id = e.target.dataset && e.target.dataset.borrarMsj;
  if (!id) return;
  await Datos.borrarMensaje(id);
  cargarMensajes();
});

document.addEventListener('layout-listo', async () => {
  if (!(await Datos.haySesion())) {
    window.location.href = 'login.html';
    return;
  }
  cargarRegalos();
  cargarComentarios();
  cargarConfig();
  cargarMensajes();
});
