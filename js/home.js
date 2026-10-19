// Portada: la carta del hero, la pared de notas y el slider de testimonios
// salen todos de los datos reales (Supabase o demo), no de texto fijo.

const ETIQUETA_ESTADO = { disponible: 'Disponible', reservado: 'Reservado', entregado: 'Entregado' };
const CLASE_ESTADO = { disponible: 'libre', reservado: 'tomado', entregado: 'entregado' };

function montarCarta(regalos) {
  const meta = document.getElementById('cartaMeta');
  const texto = document.getElementById('cartaTexto');
  const firma = document.getElementById('cartaFirma');
  if (!regalos.length) return;

  let actual = 0;
  const pintar = () => {
    const r = regalos[actual];
    const deseo = r.opcion2 ? `${r.opcion1}, o si no ${r.opcion2}` : r.opcion1;
    meta.textContent = r.nombre_nino;
    texto.textContent = `Querido Santa: este año me porté bien. Quiero ${deseo.toLowerCase()}. Gracias.`;
    firma.textContent = r.nombre_nino.split(' ')[0];
  };

  pintar();
  setInterval(() => {
    actual = (actual + 1) % regalos.length;
    texto.classList.add('cambiando');
    setTimeout(() => { pintar(); texto.classList.remove('cambiando'); }, 200);
  }, 5000);
}

function montarMuro(regalos, conFotos) {
  if (!regalos.length) return;
  document.getElementById('muro').innerHTML = regalos.slice(0, 6).map(r => `
    <article class="nota">
      ${conFotos && r.foto_url
        ? `<img class="nota-foto" src="${esc(r.foto_url)}" alt="" loading="lazy">`
        : ''}
      <p class="nota-deseo">"${esc(r.opcion1)}"</p>
      <div class="nota-pie">
        <span class="nota-nombre">${esc(r.nombre_nino.split(' ')[0])}</span>
        <span class="marca-estado ${CLASE_ESTADO[r.estado] || 'libre'}">${ETIQUETA_ESTADO[r.estado] || r.estado}</span>
      </div>
    </article>`).join('');
  document.getElementById('seccionMuro').classList.remove('oculto');
}

function montarComentarios(comentarios) {
  if (!comentarios.length) return;
  // Dos grupos idénticos para que el bucle infinito no muestre corte.
  const grupo = (oculto) => `
    <div class="ticker-grupo"${oculto ? ' aria-hidden="true"' : ''}>
      ${comentarios.map(c => `
        <figure class="comentario-card">
          <blockquote>${esc(c.texto)}</blockquote>
          <figcaption>${esc(c.autor)}</figcaption>
        </figure>`).join('')}
    </div>`;

  document.getElementById('pistaComentarios').innerHTML = grupo(false) + grupo(true);
  document.getElementById('seccionComentarios').classList.remove('oculto');
}

document.addEventListener('layout-listo', async (e) => {
  const [regalos, comentarios] = await Promise.all([
    Datos.regalos().catch(() => []),
    Datos.comentarios().catch(() => []),
  ]);

  montarCarta(regalos.filter(r => r.estado === 'disponible'));
  montarMuro(regalos, e.detail.fotos_regalos === 'si');
  montarComentarios(comentarios);
});
