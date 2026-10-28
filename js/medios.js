function pintarMedios(lista) {
  const grid = document.getElementById('mediosGrid');
  grid.innerHTML = lista.map(medio => {
    const tipo = [medio.tipo, medio.anio].filter(Boolean).join(' · ');
    return `
      <article class="medio-card">
        <img class="medio-foto" src="${esc(medio.imagen)}" alt="${esc(medio.alt)}" loading="lazy">
        <span class="medio-tipo">${esc(tipo)}</span>
        <h3>${esc(medio.titulo)}</h3>
        <p>${esc(medio.descripcion)}</p>
        <a class="btn btn-coral btn-pequeno" href="${esc(medio.url)}" target="_blank" rel="noopener">${esc(medio.boton)}</a>
      </article>`;
  }).join('');
}

document.addEventListener('layout-listo', async () => {
  try {
    pintarMedios(await Datos.medios());
  } catch (e) {
    document.getElementById('mediosGrid').innerHTML =
      '<p class="mensaje error">No se pudieron cargar los medios.</p>';
  }
});
