// Chequeo del modo demo:  node test-demo.js
// Falla si la reserva deja de ser "el primero se lo lleva" o si se rompe
// la configuración editable.
const fs = require('fs');
const assert = require('assert');

const almacen = {};
global.localStorage = {
  getItem: k => (k in almacen ? almacen[k] : null),
  setItem: (k, v) => { almacen[k] = String(v); },
  removeItem: k => { delete almacen[k]; },
};
global.window = {};

// El test corre SIEMPRE en modo demo, tenga o no credenciales `js/config.js`:
// prueba la lógica, no la conexión del cliente. Por eso define las constantes
// aquí en vez de leer config.js.
const CONFIG_DE_PRUEBA = `
  const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
  const SUPABASE_ANON = 'TU_ANON_PUBLIC_KEY';
  const MODO_DEMO = true;
`;

// Un solo eval: las declaraciones `const` no se comparten entre evals distintos.
const fuente = CONFIG_DE_PRUEBA + fs.readFileSync(__dirname + '/js/datos.js', 'utf8');
eval(fuente + '\nglobal.MODO_DEMO = MODO_DEMO; global.Datos = Datos;');

// importar.js es puro: se carga como módulo normal.
const { prepararImportacion } = require('./js/importar.js');

(async () => {
  assert.strictEqual(Datos.modo, 'demo');

  // El interruptor de modo demo sigue siendo el mismo: la URL con TU-PROYECTO.
  const config = fs.readFileSync(__dirname + '/js/config.js', 'utf8');
  assert.match(config, /MODO_DEMO\s*=\s*SUPABASE_URL\.includes\('TU-PROYECTO'\)/,
    'js/config.js debe seguir decidiendo el modo por la URL');

  const regalos = await Datos.regalos();
  assert.ok(regalos.length >= 6, 'faltan regalos semilla');

  const id = regalos[0].id;
  assert.deepStrictEqual(await Datos.reservar(id, 'Ana', 'ana@test.cl'), { ok: true });
  assert.deepStrictEqual(await Datos.reservar(id, 'Beto', 'beto@test.cl'),
    { ok: false, motivo: 'ya_reservado' });

  const reservado = (await Datos.regalos()).find(r => r.id === id);
  assert.strictEqual(reservado.estado, 'reservado');
  assert.strictEqual(reservado.nombre_donador, 'Ana');

  await Datos.crearRegalo({ nombre_nino: 'Test', institucion: 'Colegio Test', opcion1: 'Pelota' });
  assert.strictEqual((await Datos.regalos()).length, regalos.length + 1);

  await Datos.crearMensaje('Ana', 'ana@test.cl', 'Hola');
  assert.strictEqual((await Datos.mensajes()).length, 1);

  await Datos.guardarConfig({ instagram_usuario: 'cuenta_nueva' });
  assert.strictEqual((await Datos.config()).instagram_usuario, 'cuenta_nueva');

  // La foto del regalo viaja como un campo más.
  await Datos.crearRegalo({
    nombre_nino: 'Con foto', institucion: 'Colegio Test',
    opcion1: 'Auto', foto_url: 'https://ejemplo.cl/auto.jpg',
  });
  const conFoto = (await Datos.regalos()).find(r => r.nombre_nino === 'Con foto');
  assert.strictEqual(conFoto.foto_url, 'https://ejemplo.cl/auto.jpg');

  // Interruptor de fotos y colores: son configuración como cualquier otra.
  assert.strictEqual((await Datos.config()).fotos_regalos, 'no', 'las fotos vienen apagadas');
  await Datos.guardarConfig({ fotos_regalos: 'si', color_acento: '#123456' });
  assert.strictEqual((await Datos.config()).fotos_regalos, 'si');
  assert.strictEqual((await Datos.config()).color_acento, '#123456');

  // La subida rechaza lo que no es una imagen o pesa de más, ANTES de tocar
  // el almacén (por eso corre sin FileReader).
  await assert.rejects(() => Datos.subirImagen({ type: 'application/pdf', size: 1000 }),
    /Formato no permitido/);
  await assert.rejects(() => Datos.subirImagen({ type: 'image/png', size: 5 * 1024 * 1024 }),
    /3 MB/);
  await assert.rejects(() => Datos.subirImagen(null), /No se eligió/);

  // --- Importación de planillas ---
  // Encabezados exactamente como vienen del Excel del equipo.
  const filaBase = {
    'Nombre': 'Alma Heredia González',
    'Institución': 'Colegio Olimpia Guzman',
    'Regalo (Opción 1)': 'Lápices de plumón',
    'Regalo (Opción 2)': 'No aplica',
    'Estado': 'Entregado',
    'Nombre Donador/a': 'Felipe Moncada',
    'Encargado': 'Fran',
  };

  let r = prepararImportacion([filaBase], []);
  assert.strictEqual(r.regalos.length, 1, 'debe reconocer los encabezados con tildes y paréntesis');
  assert.deepStrictEqual(r.regalos[0], {
    nombre_nino: 'Alma Heredia González',
    institucion: 'Colegio Olimpia Guzman',
    opcion1: 'Lápices de plumón',
    opcion2: null,                       // "No aplica" no es un regalo
    estado: 'entregado',                 // "Entregado" -> minúscula, valor válido para la BD
    nombre_donador: 'Felipe Moncada',
    contacto_donador: null,
    encargado: 'Fran',
  });

  // Sin estado -> disponible. Estado inventado -> error, no se importa.
  r = prepararImportacion([Object.assign({}, filaBase, { Estado: '' })], []);
  assert.strictEqual(r.regalos[0].estado, 'disponible');
  r = prepararImportacion([Object.assign({}, filaBase, { Estado: 'regalado' })], []);
  assert.strictEqual(r.regalos.length, 0);
  assert.match(r.errores[0].motivo, /Estado no reconocido/);

  // Faltan datos obligatorios -> error con el número de fila real de la planilla.
  r = prepararImportacion([Object.assign({}, filaBase, { 'Regalo (Opción 1)': '' })], []);
  assert.strictEqual(r.errores[0].fila, 2);

  // Filas vacías de relleno: se ignoran en silencio.
  r = prepararImportacion([filaBase, { 'Nombre': '', 'Institución': '', 'Regalo (Opción 1)': '' }], []);
  assert.strictEqual(r.regalos.length, 1);
  assert.strictEqual(r.errores.length, 0);

  // No duplica: ni contra lo ya cargado ni dentro del mismo archivo.
  r = prepararImportacion([filaBase], [{ nombre_nino: 'ALMA HEREDIA GONZALEZ', institucion: 'colegio olimpia guzman' }]);
  assert.strictEqual(r.regalos.length, 0);
  assert.strictEqual(r.duplicados, 1);
  r = prepararImportacion([filaBase, filaBase], []);
  assert.strictEqual(r.regalos.length, 1);
  assert.strictEqual(r.duplicados, 1);

  // Sin las columnas obligatorias no se importa nada y se dice cuáles faltan.
  r = prepararImportacion([{ 'Cosa': 'x', 'Otra': 'y' }], []);
  assert.deepStrictEqual(r.columnasFaltantes, ['nombre_nino', 'institucion', 'opcion1']);

  // Y la carga masiva llega a la base.
  const antes = (await Datos.regalos()).length;
  await Datos.crearRegalos(prepararImportacion([filaBase], []).regalos);
  assert.strictEqual((await Datos.regalos()).length, antes + 1);

  assert.strictEqual((await Datos.login('mal@mail.com', 'x')).ok, false);
  assert.strictEqual((await Datos.login('demo@demo.com', 'demo123')).ok, true);
  assert.strictEqual(await Datos.haySesion(), true);
  await Datos.logout();
  assert.strictEqual(await Datos.haySesion(), false);

  console.log('test-demo: todo OK');
})();
