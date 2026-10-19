// =====================================================================
//  Convierte las filas de una planilla (.xlsx / .csv) en regalos listos
//  para guardar. Sin DOM ni red: es una función pura, y por eso se puede
//  probar con `node test-demo.js`.
// =====================================================================

// Cada campo acepta varios nombres de columna. Se comparan normalizados
// (sin tildes, sin mayúsculas, sin signos), así que "Regalo (Opción 1)",
// "REGALO OPCION 1" y "regalo opción 1" son la misma columna.
const COLUMNAS = {
  nombre_nino:    ['nombre', 'nombre del nino', 'nino', 'nina', 'nombre nino'],
  institucion:    ['institucion', 'colegio', 'jardin', 'establecimiento'],
  opcion1:        ['regalo opcion 1', 'opcion 1', 'regalo 1', 'regalo', 'opcion de regalo 1'],
  opcion2:        ['regalo opcion 2', 'opcion 2', 'regalo 2', 'opcion de regalo 2'],
  estado:         ['estado'],
  nombre_donador: ['nombre donador a', 'nombre donador', 'donador', 'donadora', 'donante'],
  contacto_donador: ['contacto', 'contacto donador', 'telefono', 'email donador'],
  encargado:      ['encargado', 'encargado a', 'encargada', 'responsable'],
};

const ESTADOS = {
  disponible: 'disponible', libre: 'disponible', pendiente: 'disponible', 'sin asignar': 'disponible',
  reservado: 'reservado', reservada: 'reservado', tomado: 'reservado', comprometido: 'reservado',
  entregado: 'entregado', entregada: 'entregado', entregados: 'entregado',
};

// Texto que en una planilla significa "aquí no hay nada".
const VACIOS = ['', 'na', 'n a', 'no aplica', 'ninguno', 'ninguna', 'sin', 'sin datos', 'null', 'x'];

const MAX_FILAS = 2000;
const MAX_LARGO = 500;

function normalizar(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // fuera las tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function limpiar(valor) {
  const texto = String(valor === null || valor === undefined ? '' : valor).trim().replace(/\s+/g, ' ');
  if (VACIOS.includes(normalizar(texto))) return '';
  return texto.slice(0, MAX_LARGO);
}

// Devuelve { campo: nombreRealDeLaColumna } mirando los encabezados del archivo.
function mapearColumnas(encabezados) {
  const mapa = {};
  encabezados.forEach(encabezado => {
    const normal = normalizar(encabezado);
    Object.keys(COLUMNAS).forEach(campo => {
      if (!mapa[campo] && COLUMNAS[campo].includes(normal)) mapa[campo] = encabezado;
    });
  });
  return mapa;
}

/**
 * filas:      array de objetos {encabezado: valor}, tal como los entrega la planilla.
 * existentes: regalos ya cargados, para no volver a subir los mismos.
 * Devuelve { regalos, errores, duplicados, columnasFaltantes }.
 */
function prepararImportacion(filas, existentes) {
  const errores = [];
  const regalos = [];
  let duplicados = 0;

  if (!filas.length) return { regalos, errores: [{ fila: 0, motivo: 'El archivo no tiene filas.' }], duplicados: 0, columnasFaltantes: [] };

  const mapa = mapearColumnas(Object.keys(filas[0]));
  const columnasFaltantes = ['nombre_nino', 'institucion', 'opcion1'].filter(c => !mapa[c]);
  if (columnasFaltantes.length) return { regalos, errores, duplicados, columnasFaltantes };

  // Clave para detectar repetidos: mismo niño en la misma institución.
  const clave = (nombre, institucion) => `${normalizar(nombre)}|${normalizar(institucion)}`;
  const vistos = new Set((existentes || []).map(r => clave(r.nombre_nino, r.institucion)));

  filas.slice(0, MAX_FILAS).forEach((fila, i) => {
    const numero = i + 2;   // +2: la fila 1 son los encabezados
    const dato = (campo) => (mapa[campo] ? limpiar(fila[mapa[campo]]) : '');

    const nombre_nino = dato('nombre_nino');
    const institucion = dato('institucion');
    const opcion1 = dato('opcion1');

    // Fila totalmente vacía: es el relleno del final de la planilla, no un error.
    if (!nombre_nino && !institucion && !opcion1) return;

    if (!nombre_nino || !institucion || !opcion1) {
      errores.push({ fila: numero, motivo: 'Falta nombre, institución u opción 1.' });
      return;
    }

    const estadoTexto = dato('estado');
    const estado = estadoTexto ? ESTADOS[normalizar(estadoTexto)] : 'disponible';
    if (!estado) {
      errores.push({ fila: numero, motivo: `Estado no reconocido: "${estadoTexto}".` });
      return;
    }

    const k = clave(nombre_nino, institucion);
    if (vistos.has(k)) { duplicados++; return; }
    vistos.add(k);

    regalos.push({
      nombre_nino,
      institucion,
      opcion1,
      opcion2: dato('opcion2') || null,
      estado,
      nombre_donador: dato('nombre_donador') || null,
      contacto_donador: dato('contacto_donador') || null,
      encargado: dato('encargado') || null,
    });
  });

  if (filas.length > MAX_FILAS) {
    errores.push({ fila: MAX_FILAS, motivo: `El archivo trae ${filas.length} filas; solo se leyeron las primeras ${MAX_FILAS}.` });
  }

  return { regalos, errores, duplicados, columnasFaltantes: [] };
}

// Para poder probarlo con node sin tocar el navegador.
if (typeof module !== 'undefined') module.exports = { prepararImportacion, normalizar };
