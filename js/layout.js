// Inyecta el header y el footer en todas las páginas y rellena los textos
// que vienen de la configuración editable ([data-cfg="clave"]).

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Un solo listado de enlaces para el nav de escritorio y el menú móvil.
const ENLACES = [
  ['sobre-nosotros.html', 'Sobre nosotros'],
  ['medios.html', 'Medios'],
  ['voluntarios.html', 'Voluntarios'],
  ['contacto.html', 'Contacto'],
];

// El CDN de Framer acepta ?scale-down-to=N y devuelve la imagen ya reducida
// (la foto de "Sobre nosotros" pasa de 5,4 MB a 262 KB). La configuración
// guardada en la base trae la URL original, así que se normaliza al pintarla:
// así no hay que tocar la base ni pedirle nada al cliente.
function fotoLigera(url, lado = 1024) {
  if (!url || url.indexOf('framerusercontent.com') === -1) return url;
  if (url.indexOf('scale-down-to=') !== -1) return url;
  return url + (url.indexOf('?') === -1 ? '?' : '&') + 'scale-down-to=' + lado;
}

function headerHTML(cfg) {
  const enlaces = ENLACES.map(([url, texto]) => `<a href="${url}">${texto}</a>`).join('');
  const cta = '<a class="btn btn-coral btn-pequeno" href="lista-de-regalos.html">Lista de regalos</a>';

  return `
  <header class="nav">
    <div class="envoltorio nav-fila">
      <a class="nav-marca" href="index.html">
        <img src="https://framerusercontent.com/images/wgq0ZJTJ4zpEJMb5hpRiQnQYs04.png?scale-down-to=128" alt="" width="34" height="34">
        <span>${esc(cfg.nombre_campana)}</span>
      </a>

      <nav class="nav-links">${enlaces}${cta}</nav>

      <!-- El menú móvil es un <details>: se abre y cierra sin JavaScript. -->
      <details class="menu-movil">
        <summary aria-label="Abrir menú">Menú</summary>
        <nav class="menu-panel">${enlaces}${cta}</nav>
      </details>
    </div>
  </header>`;
}

function footerHTML(cfg) {
  const textoAnterior = 'Por ahora, estamos hibernando como los elfos, pero pronto volveremos a armar la fiesta más linda del año. ¡Nos vemos en Noviembre!';
  const legalAnterior = 'Corporación Corazón Solidario. Todos los derechos reservados.';
  const textoFooter = cfg.texto_footer === textoAnterior
    ? '¡Los elfos ya están trabajando! Estamos preparando una nueva Navidad llena de regalos, juegos y momentos inolvidables para los niños.'
    : cfg.texto_footer;
  const legal = cfg.legal === legalAnterior
    ? 'Navidad con Corazón. Todos los derechos reservados.'
    : cfg.legal;

  return `
  <footer class="pie">
    <div class="envoltorio">
      <div class="pie-cols">
        <div>
          <h4>${esc(cfg.nombre_campana)} ${esc(cfg.anio)}</h4>
          <p>${esc(textoFooter)}</p>
        </div>
        <div>
          <h4>Colabora</h4>
          <a href="lista-de-regalos.html">Dona un regalo</a>
          <a href="voluntarios.html">Sé voluntario</a>
          <a href="contacto.html">Contáctanos</a>
        </div>
        <div>
          <h4>Redes</h4>
          <a href="${esc(cfg.instagram)}" target="_blank" rel="noopener">Instagram</a>
          <a href="${esc(cfg.tiktok)}" target="_blank" rel="noopener">TikTok</a>
          <a href="${esc(cfg.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>
        </div>
      </div>
      <p class="pie-legal">
        © ${esc(cfg.anio)} ${esc(legal)}
        <a class="pie-admin" href="login.html" rel="nofollow">Acceso equipo</a>
      </p>
      <p class="pie-credit">Diseño y desarrollo web por Jonathan Friz y Matías Lagos</p>
    </div>
  </footer>`;
}

// Los colores del panel entran como variables CSS. Solo se aceptan hex de 6
// dígitos: cualquier otra cosa se ignora en vez de inyectarse en el estilo.
const COLORES = { color_fondo: '--tinta', color_acento: '--coral', color_claro: '--crema' };

function aplicarColores(cfg) {
  Object.keys(COLORES).forEach(clave => {
    const valor = (cfg[clave] || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(valor)) {
      document.documentElement.style.setProperty(COLORES[clave], valor);
    }
  });

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && /^#[0-9a-f]{6}$/i.test(cfg.color_fondo || '')) meta.content = cfg.color_fondo;
}

async function montarLayout() {
  const cfg = await Datos.config();
  window.CFG = cfg;
  aplicarColores(cfg);

  document.body.insertAdjacentHTML('afterbegin',
    (MODO_DEMO ? '<div class="cinta-demo">Modo demostración — los datos se guardan solo en este navegador</div>' : '') +
    headerHTML(cfg));

  document.body.insertAdjacentHTML('beforeend', footerHTML(cfg));

  document.querySelectorAll('[data-cfg]').forEach(nodo => {
    nodo.textContent = cfg[nodo.dataset.cfg] || '';
  });
  document.querySelectorAll('[data-cfg-href]').forEach(nodo => {
    nodo.setAttribute('href', cfg[nodo.dataset.cfgHref] || '#');
  });
  // Fotos reemplazables desde el panel. Si la clave está vacía se deja la
  // imagen que ya trae el HTML.
  document.querySelectorAll('[data-cfg-src]').forEach(nodo => {
    const url = fotoLigera(cfg[nodo.dataset.cfgSrc]);
    if (url) nodo.setAttribute('src', url);
  });

  document.dispatchEvent(new CustomEvent('layout-listo', { detail: cfg }));
}

document.addEventListener('DOMContentLoaded', montarLayout);
