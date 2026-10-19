document.getElementById('formContacto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const caja = document.getElementById('mensajeContacto');
  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const texto = document.getElementById('mensaje').value.trim();

  if (!nombre || !email.includes('@') || !texto) {
    caja.innerHTML = '<div class="mensaje error">Revisa los campos: nombre, un email válido y tu mensaje son obligatorios.</div>';
    return;
  }

  const boton = e.target.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = 'Enviando...';

  try {
    await Datos.crearMensaje(nombre, email, texto.slice(0, 2000));
    e.target.reset();
    caja.innerHTML = `<div class="mensaje ok exito-animado"><span class="check-ok"></span>
      ¡Gracias! Tu mensaje ya llegó al equipo.</div>`;
  } catch (err) {
    caja.innerHTML = '<div class="mensaje error">No se pudo enviar. Intenta de nuevo.</div>';
  }

  boton.disabled = false;
  boton.textContent = 'Enviar';
});
