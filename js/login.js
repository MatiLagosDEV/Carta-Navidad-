document.addEventListener('layout-listo', async () => {
  if (MODO_DEMO) document.getElementById('pistaDemo').classList.remove('oculto');
  if (await Datos.haySesion()) window.location.href = 'admin.html';
});

document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const caja = document.getElementById('mensajeLogin');
  const resultado = await Datos.login(
    document.getElementById('email').value.trim(),
    document.getElementById('password').value
  );

  if (!resultado.ok) {
    caja.innerHTML = `<div class="mensaje error">${esc(resultado.error)}</div>`;
    return;
  }
  window.location.href = 'admin.html';
});
