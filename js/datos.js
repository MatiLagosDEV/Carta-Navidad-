// =====================================================================
//  Capa de datos única. Todo el sitio habla SOLO con `Datos`.
//  Si MODO_DEMO -> localStorage. Si no -> Supabase real.
//  Ambas implementaciones exponen exactamente los mismos métodos.
// =====================================================================

const CONFIG_POR_DEFECTO = {
  nombre_campana: 'Navidad con Corazón',
  anio: '2026',
  email_contacto: 'navidadconcorazon@gmail.com',
  instagram: 'https://instagram.com/navidadconcorazon',
  instagram_usuario: 'navidadconcorazon',
  tiktok: '#',
  linkedin: '#',
  linkedin_usuario: 'Navidad con Corazón',
  texto_footer: '¡Los elfos ya están trabajando! Estamos preparando una nueva Navidad llena de regalos, juegos y momentos inolvidables para los niños.',
  aviso_home: '¡Ups! Aún estamos construyendo este sitio. ¡Regresa en Noviembre!',
  legal: 'Navidad con Corazón. Todos los derechos reservados.',

  // Apariencia editable desde el panel
  fotos_regalos: 'no',
  color_fondo: '#012e29',
  color_acento: '#ef5151',
  color_claro: '#fff7db',
  foto_sobre_1: 'https://framerusercontent.com/images/TTN63G7WlH0iqjgRXYVUKT2STHQ.jpg?scale-down-to=1024',
  foto_sobre_2: 'https://framerusercontent.com/images/bH45L3qlZ8wn8kb2BhdeoESz9Sg.jpg?scale-down-to=1024',
  foto_voluntarios_1: 'https://framerusercontent.com/images/X68KA1rl3ypROVGLocg9kbhyLY.jpg?scale-down-to=1024',
  foto_voluntarios_2: 'https://framerusercontent.com/images/7IDzjlNviUsuxy0H1vhrnIpGUw.jpg?scale-down-to=1024',
};

// Límites de las imágenes que se suben. Los repite el bucket de Supabase:
// esto es comodidad para el usuario, la regla de verdad está en el servidor.
const IMAGEN_MAX_BYTES = 3 * 1024 * 1024;
const IMAGEN_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Columnas de `regalos` que puede ver cualquiera. Las del donante quedan
// fuera a propósito; la lista blanca de verdad está en el GRANT del SQL.
const COLUMNAS_PUBLICAS = 'id, nombre_nino, edad, opcion1, opcion2, estado, foto_url, created_at';
const CACHE_CONFIG = 'ncc_cfg_v1';

// Las fotos de un teléfono pesan 3-5 MB y en pantalla se ven a 400 px de
// ancho. Subirlas tal cual es lo que decide si los 5 GB/mes de tráfico que
// regala Supabase duran toda la campaña o dos semanas: pase lo que pase,
// esto deja cualquier foto en ~100 KB (1000 px de lado mayor, JPEG 78).
// Medido: 3024x4032 (12 MP, lo que saca un iPhone) -> 85 KB.
async function reducirImagen(file, lado = 1000) {
  if (file.type === 'image/gif') return file;   // un GIF animado se rompe al pasarlo por canvas
  let url;
  try {
    url = URL.createObjectURL(file);
    // <img> y no createImageBitmap: con una foto de 12 MP (3024x4032, lo que
    // saca cualquier teléfono) createImageBitmap se quedó colgado en la prueba,
    // y además <img> existe en Safari e iOS viejos.
    const imagen = new Image();
    await new Promise((listo, falla) => {
      imagen.onload = listo;
      imagen.onerror = () => falla(new Error('El archivo no es una imagen válida.'));
      imagen.src = url;
    });

    const escala = Math.min(1, lado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    if (escala === 1 && file.size <= 300 * 1024) return file;

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(imagen.naturalWidth * escala);
    lienzo.height = Math.round(imagen.naturalHeight * escala);
    lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

    const blob = await new Promise(r => lienzo.toBlob(r, 'image/jpeg', 0.78));
    return blob && blob.size < file.size ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) {
    return file;   // si el navegador no puede, se sube la original: el bucket igual pone el techo
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

// Puerta única de las imágenes: valida el tipo, reduce, y recién ahí mide.
// Así una foto de 5 MB del teléfono entra (reducida) en vez de rebotar.
async function prepararImagen(file) {
  if (!file) throw new Error('No se eligió ningún archivo.');
  if (!IMAGEN_TIPOS.includes(file.type)) throw new Error('Formato no permitido: usa JPG, PNG, WEBP o GIF.');
  const reducida = await reducirImagen(file);
  if (reducida.size > IMAGEN_MAX_BYTES) throw new Error('La imagen pesa más de 3 MB incluso reducida. Achícala e inténtalo de nuevo.');
  return reducida;
}

const REGALOS_SEMILLA = [
  ['Alma Heredia González', 'Colegio Olimpo', 7, 'Lápices de plumón (100 colores)', null, 'Fran'],
  ['Joaquín Hermosilla', 'Colegio Olimpo', 8, 'Peluche de Pou triste', null, 'Fran'],
  ['Amanda Inostroza', 'Jardines Chile', 6, 'Pop it', 'Piscina de pelotas', 'Fran'],
  ['Bastian Contreras Fernández', 'Jardines Chile', 9, 'Juguete de Spiderman o Venom', 'Robot de juguete', 'Fran'],
  ['Lucas Osses Gutiérrez', 'Colegio Olimpo', 5, 'Un Godzilla y un King Kong', null, 'Javi'],
  ['Trinidad Toro', 'Colegio Olimpo', 10, 'Lápices acuarelables (100 colores)', null, 'Javi'],
];

const COMENTARIOS_SEMILLA = [
  ['Ver la cara del niño cuando abrió su regalo vale todo el año de trabajo.', 'Voluntaria, versión 2024'],
  ['Llegué sin conocer a nadie y me fui con una familia entera.', 'Voluntario, versión 2023'],
  ['Doné un regalo en cinco minutos y recibí la foto de la entrega. Impecable.', 'Donante, versión 2024'],
  ['Los talleres son el mejor momento del año para los cabros del colegio.', 'Profesora, Colegio Olimpo'],
];

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ---------------------------------------------------------------- DEMO
function crearDatosDemo() {
  const CLAVE = 'ncc_demo_v1';

  // Abierto con doble clic (file://) algunos navegadores bloquean localStorage.
  // En ese caso guardamos en memoria: el demo igual funciona, pero se reinicia
  // al recargar la página.
  const memoria = {};
  const almacen = (() => {
    try {
      localStorage.setItem('__prueba__', '1');
      localStorage.removeItem('__prueba__');
      return localStorage;
    } catch (e) {
      return {
        getItem: k => (k in memoria ? memoria[k] : null),
        setItem: (k, v) => { memoria[k] = String(v); },
      };
    }
  })();

  function leer() {
    const guardado = almacen.getItem(CLAVE);
    if (guardado) {
      const datos = JSON.parse(guardado);
      let actualizoEdades = false;
      datos.regalos.forEach(regalo => {
        const ejemplo = REGALOS_SEMILLA.find(item => item[0] === regalo.nombre_nino);
        if (ejemplo && regalo.edad == null) {
          regalo.edad = ejemplo[2];
          actualizoEdades = true;
        }
      });
      if (actualizoEdades) almacen.setItem(CLAVE, JSON.stringify(datos));
      return datos;
    }
    const inicial = {
      config: Object.assign({}, CONFIG_POR_DEFECTO),
      regalos: REGALOS_SEMILLA.map(([nombre, inst, edad, o1, o2, enc]) => ({
        id: uuid(), nombre_nino: nombre, institucion: inst, edad, opcion1: o1, opcion2: o2,
        encargado: enc, estado: 'disponible', nombre_donador: null, contacto_donador: null,
        reservado_at: null, entregado_at: null, created_at: new Date().toISOString(),
      })),
      comentarios: COMENTARIOS_SEMILLA.map(([texto, autor]) => ({ id: uuid(), texto, autor })),
      mensajes: [],
      sesion: false,
    };
    almacen.setItem(CLAVE, JSON.stringify(inicial));
    return inicial;
  }

  const guardar = (d) => almacen.setItem(CLAVE, JSON.stringify(d));

  return {
    modo: 'demo',

    async config() { return leer().config; },
    async guardarConfig(campos) {
      const d = leer();
      Object.assign(d.config, campos);
      guardar(d);
    },

    async regalos() { return leer().regalos; },
    async crearRegalo(regalo) {
      const d = leer();
      d.regalos.push(Object.assign({
        id: uuid(), estado: 'disponible', nombre_donador: null, contacto_donador: null,
        reservado_at: null, entregado_at: null, created_at: new Date().toISOString(),
      }, regalo));
      guardar(d);
    },
    async crearRegalos(lista) {
      const d = leer();
      lista.forEach(regalo => d.regalos.push(Object.assign({
        id: uuid(), estado: 'disponible', nombre_donador: null, contacto_donador: null,
        reservado_at: null, entregado_at: null, created_at: new Date().toISOString(),
      }, regalo)));
      guardar(d);
      return lista.length;
    },
    async editarRegalo(id, campos) {
      const d = leer();
      d.regalos = d.regalos.map(r => r.id === id ? Object.assign({}, r, campos) : r);
      guardar(d);
    },
    async borrarRegalo(id) {
      const d = leer();
      d.regalos = d.regalos.filter(r => r.id !== id);
      guardar(d);
    },
    async reservar(id, donador, contacto) {
      const d = leer();
      const regalo = d.regalos.find(r => r.id === id);
      // Misma regla que la función SQL: solo se reserva si sigue disponible.
      if (!regalo || regalo.estado !== 'disponible') return { ok: false, motivo: 'ya_reservado' };
      Object.assign(regalo, {
        estado: 'reservado', nombre_donador: donador,
        contacto_donador: contacto, reservado_at: new Date().toISOString(),
      });
      guardar(d);
      return { ok: true };
    },

    async comentarios() { return leer().comentarios; },
    async crearComentario(texto, autor) {
      const d = leer();
      d.comentarios.push({ id: uuid(), texto, autor });
      guardar(d);
    },
    async borrarComentario(id) {
      const d = leer();
      d.comentarios = d.comentarios.filter(c => c.id !== id);
      guardar(d);
    },

    async mensajes() { return leer().mensajes; },
    async crearMensaje(nombre, email, texto) {
      const d = leer();
      d.mensajes.unshift({ id: uuid(), nombre, email, texto, created_at: new Date().toISOString() });
      guardar(d);
    },
    async borrarMensaje(id) {
      const d = leer();
      d.mensajes = d.mensajes.filter(m => m.id !== id);
      guardar(d);
    },

    // En demo no hay servidor: la imagen se guarda como data URL. Se limita a
    // 600 KB porque localStorage son ~5 MB en total y aquí también viven los
    // regalos y los mensajes.
    async subirImagen(file) {
      const imagen = await prepararImagen(file);
      if (imagen.size > 600 * 1024) {
        throw new Error('En modo demo las imágenes deben pesar menos de 600 KB.');
      }
      return new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        lector.readAsDataURL(imagen);
      });
    },

    async haySesion() { return leer().sesion === true; },
    async login(email, password) {
      if (email !== 'demo@demo.com' || password !== 'demo123') {
        return { ok: false, error: 'En modo demo usa demo@demo.com / demo123' };
      }
      const d = leer();
      d.sesion = true;
      guardar(d);
      return { ok: true };
    },
    async logout() {
      const d = leer();
      d.sesion = false;
      guardar(d);
    },
  };
}

// ------------------------------------------------------------ SUPABASE
function crearDatosSupabase() {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // PostgREST no lanza excepciones: devuelve { error }. Si no lo revisamos, un
  // rechazo por permisos (RLS) se vería en pantalla como "guardado con éxito".
  const ok = (res) => { if (res.error) throw new Error(res.error.message); return res; };

  return {
    modo: 'supabase',

    // La configuración la pide CADA página para armar header y pie. Guardarla
    // en sessionStorage la convierte en una petición por visita en vez de una
    // por página: menos tráfico y, sobre todo, menos conexiones simultáneas
    // contra la instancia gratis cuando entra mucha gente a la vez.
    async config() {
      try {
        const guardada = sessionStorage.getItem(CACHE_CONFIG);
        if (guardada) return JSON.parse(guardada);
      } catch (e) { /* navegador sin sessionStorage: se pide siempre */ }

      const { data } = await sb.from('configuracion').select('clave, valor');
      const cfg = Object.assign({}, CONFIG_POR_DEFECTO);
      (data || []).forEach(fila => { cfg[fila.clave] = fila.valor; });
      try { sessionStorage.setItem(CACHE_CONFIG, JSON.stringify(cfg)); } catch (e) { /* cuota llena */ }
      return cfg;
    },
    async guardarConfig(campos) {
      const filas = Object.keys(campos).map(clave => ({ clave, valor: campos[clave] }));
      ok(await sb.from('configuracion').upsert(filas, { onConflict: 'clave' }));
      try { sessionStorage.removeItem(CACHE_CONFIG); } catch (e) { /* nada que limpiar */ }
    },

    // El sitio público NO pide nombre_donador ni contacto_donador: esos datos
    // personales solo los ve el panel (regalos(true)). La base lo impone
    // igual con GRANT por columna, esto evita el viaje de vuelta inútil.
    async regalos(comoAdmin) {
      const { data } = await sb.from('regalos')
        .select(comoAdmin ? '*' : COLUMNAS_PUBLICAS)
        .order('created_at', { ascending: true });
      return data || [];
    },
    async crearRegalo(regalo) { ok(await sb.from('regalos').insert(regalo)); },
    async crearRegalos(lista) {
      // De a 500: un INSERT gigante puede pasarse del límite de la petición.
      for (let i = 0; i < lista.length; i += 500) {
        ok(await sb.from('regalos').insert(lista.slice(i, i + 500)));
      }
      return lista.length;
    },
    async editarRegalo(id, campos) { ok(await sb.from('regalos').update(campos).eq('id', id)); },
    async borrarRegalo(id) { ok(await sb.from('regalos').delete().eq('id', id)); },
    async reservar(id, donador, contacto) {
      // reservar_regalo() es SECURITY DEFINER y solo actualiza si sigue disponible.
      const { data, error } = await sb.rpc('reservar_regalo', {
        regalo_id: id, donador, contacto,
      });
      if (error) return { ok: false, motivo: 'error' };
      return data === true ? { ok: true } : { ok: false, motivo: 'ya_reservado' };
    },

    async comentarios() {
      const { data } = await sb.from('comentarios').select('*').order('created_at', { ascending: true });
      return data || [];
    },
    async crearComentario(texto, autor) { ok(await sb.from('comentarios').insert({ texto, autor })); },
    async borrarComentario(id) { ok(await sb.from('comentarios').delete().eq('id', id)); },

    async mensajes() {
      const { data } = await sb.from('mensajes').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    async crearMensaje(nombre, email, texto) {
      ok(await sb.from('mensajes').insert({ nombre, email, texto }));
    },
    async borrarMensaje(id) { ok(await sb.from('mensajes').delete().eq('id', id)); },

    async subirImagen(file) {
      const imagen = await prepararImagen(file);
      // Nombre propio: no se confía en el del archivo (evita rutas y caracteres raros).
      const extension = (imagen.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      ok(await sb.storage.from('imagenes').upload(nombre, imagen, { cacheControl: '31536000' }));
      return sb.storage.from('imagenes').getPublicUrl(nombre).data.publicUrl;
    },

    async haySesion() {
      const { data } = await sb.auth.getSession();
      return !!data.session;
    },
    async login(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? { ok: false, error: 'Email o contraseña incorrectos.' } : { ok: true };
    },
    async logout() { await sb.auth.signOut(); },
  };
}

function crearDatosHoja() {
  async function pedir(opciones) {
    const respuesta = await fetch(GOOGLE_SHEETS_API_URL, opciones);
    if (!respuesta.ok) throw new Error(`Google Sheets respondió HTTP ${respuesta.status}.`);
    const datos = await respuesta.json();
    if (!datos.ok) throw new Error(datos.error || 'Google Sheets rechazó la solicitud.');
    return datos;
  }

  return {
    modo: 'hoja',
    async config() { return Object.assign({}, CONFIG_POR_DEFECTO); },
    async regalos() {
      const datos = await pedir({ method: 'GET' });
      return datos.regalos || [];
    },
    async comentarios() { return []; },
    async reservar(id, donador, contacto) {
      const cuerpo = new URLSearchParams({
        payload: JSON.stringify({ accion: 'reservar', id, nombre: donador, contacto }),
      });
      const datos = await pedir({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: cuerpo,
      });
      return datos.motivo === 'ya_reservado'
        ? { ok: false, motivo: 'ya_reservado' }
        : { ok: true };
    },
  };
}

const Datos = MODO_HOJA
  ? crearDatosHoja()
  : (MODO_DEMO ? crearDatosDemo() : crearDatosSupabase());

if (MODO_DEMO) {
  console.info('MODO DEMO activo. Edita js/config.js con las credenciales de Supabase para usar la base de datos real.');
}
