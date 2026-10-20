// Envío al correo del equipo (FormSubmit). La primera vez que llegue un mensaje,
// FormSubmit manda un correo de activación a la casilla: hay que confirmarlo una vez.
async function enviarCorreo(nombre, email, texto) {
  const destino = (window.CFG && window.CFG.email_contacto) || 'navidadconcorazon@gmail.com';
  const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(destino), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      name: nombre,
      email: email,
      message: texto,
      _subject: 'Nuevo mensaje desde el sitio web — ' + nombre,
      _template: 'table',
      _captcha: 'false',
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || String(data.success) === 'false') throw new Error('No se pudo enviar el correo');
}

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

  const mensaje = texto.slice(0, 2000);
  const [guardado, correo] = await Promise.allSettled([
    Datos.crearMensaje(nombre, email, mensaje),
    enviarCorreo(nombre, email, mensaje),
  ]);
  // En modo demo "guardado" solo vive en el navegador: ahí cuenta solo el correo.
  const llego = correo.status === 'fulfilled' || (guardado.status === 'fulfilled' && !MODO_DEMO);

  try {
    if (!llego) throw new Error('sin envio');
    e.target.reset();
    caja.innerHTML = `<div class="mensaje ok exito-animado"><span class="check-ok"></span>
      ¡Gracias! Tu mensaje ya llegó al equipo.</div>`;
  } catch (err) {
    caja.innerHTML = '<div class="mensaje error">No se pudo enviar. Intenta de nuevo.</div>';
  }

  boton.disabled = false;
  boton.textContent = 'Enviar';
});
