(function () {
  var mensajes = [
    { texto: "Muchas gracias a ustedes por considerarnos y querer dar un momento de alegría a los chicos", hora: "20:03", corazon: true },
    { texto: "Felicitaciones para todos por esa sonrisa que le dan a todos esos niños", hora: "", corazon: true },
    { texto: "Muchas gracias..!! ✨👌 De verdad que se divirtieron demasiado los niños y niñas 😍", hora: "20:55", corazon: false },
    { texto: "Gracias por su tremendo apoyo 🙏🏻", hora: "", corazon: false },
    { texto: "Hermosa actividad. Una variedad de actividades muy novedosas.", hora: "", corazon: false },
    { texto: "Mi hija y sus compañeros la pasaron súper bien. Muchísimas gracias ❤️🙌", hora: "", corazon: false },
    { texto: "Quiero agradecer enormemente, junto a mi esposo, lo bello que realizan.", hora: "", corazon: false },
    { texto: "Agradezco mucho su amabilidad y lo bello que realizan al hacerles realidad el sueño de cada niño y niña", hora: "", corazon: false },
    { texto: "Gracias por su labor, mi niño fue seleccionado del colegio. Que Dios les multiplique", hora: "", corazon: false },
    // EJEMPLOS: reemplazar por mensajes reales antes de publicar
    { texto: "Mi hijo no paraba de sonreír cuando abrió su regalo. Gracias por tanto cariño 🎁", hora: "", corazon: true },
    { texto: "Fue emocionante ver a tantos voluntarios juntos por los niños. Volveremos el próximo año 🎄", hora: "", corazon: false },
    { texto: "Gracias por acordarse de los niños de nuestro jardín. Se llevaron un recuerdo inolvidable", hora: "", corazon: true },
    { texto: "Cada carta era un sueño. Gracias por darnos la oportunidad de cumplir uno ❤️", hora: "", corazon: false },
    { texto: "Una tarde llena de risas y juegos. Los niños se fueron felices 🎅", hora: "", corazon: false }
  ];

  var corazonSVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="#e86b83" stroke="#e86b83" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/></svg>';

  function esc(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function crearGrupo(oculto) {
    var grupo = document.createElement("div");
    grupo.className = "nc-grupo";
    if (oculto) grupo.setAttribute("aria-hidden", "true");
    grupo.innerHTML = mensajes.map(function (mensaje, i) {
      return '<div class="nc-burbuja" style="--d:' + (i * 1.1) + 's">' +
        '<span class="nc-destello"></span>' +
        '<svg class="nc-chispa" aria-hidden="true"><use href="#nc-estrella"/></svg>' +
        '<svg class="nc-gorro" aria-hidden="true"><use href="#nc-gorro"/></svg>' +
        '<p>' + esc(mensaje.texto) + '</p>' +
        '<span class="nc-hora">' + mensaje.hora + '</span>' +
        (mensaje.corazon ? '<span class="nc-reaccion">' + corazonSVG + '</span>' : '') +
        '</div>';
    }).join("");
    return grupo;
  }

  var pista = document.getElementById("nc-pista");
  pista.appendChild(crearGrupo(false));
  pista.appendChild(crearGrupo(true));

  var seccion = document.getElementById("nc-seccion");
  var svg = document.getElementById("nc-luces");
  var NS = "http://www.w3.org/2000/svg";
  var colores = ["#e5484d", "#f5c542", "#46c37b", "#4aa8e8"];
  var contador = 0;

  function elemento(tag, atributos) {
    var elementoSVG = document.createElementNS(NS, tag);
    for (var atributo in atributos) elementoSVG.setAttribute(atributo, atributos[atributo]);
    svg.appendChild(elementoSVG);
    return elementoSVG;
  }

  function bombilla(x, y) {
    var color = colores[contador % 4];
    var retraso = (contador % 5) * 0.35 + "s";
    contador++;
    elemento("circle", { cx: x, cy: y + 5, r: 9, fill: color, "class": "nc-brillo", style: "animation-delay:" + retraso });
    elemento("rect", { x: x - 2, y: y - 2, width: 4, height: 4, rx: 1, fill: "#0b0f0e" });
    elemento("ellipse", { cx: x, cy: y + 5, rx: 3.6, ry: 5, fill: color, "class": "nc-bombilla", style: "animation-delay:" + retraso });
  }

  function dibujarLuces() {
    var ancho = seccion.clientWidth;
    svg.innerHTML = "";
    contador = 0;
    svg.setAttribute("viewBox", "0 0 " + ancho + " 150");

    var anchoCurva = 95;
    var cantidad = Math.ceil(ancho / anchoCurva);
    var camino = "M0 4";
    for (var i = 0; i < cantidad; i++) {
      camino += " Q" + (i * anchoCurva + anchoCurva / 2) + " 30 " + ((i + 1) * anchoCurva) + " 4";
    }
    elemento("path", { d: camino, fill: "none", stroke: "#0b0f0e", "stroke-width": 1.4 });

    for (var k = 0; k < cantidad; k++) {
      [0.2, 0.5, 0.8].forEach(function (t) {
        var x0 = k * anchoCurva;
        var x1 = x0 + anchoCurva / 2;
        var x2 = x0 + anchoCurva;
        var x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
        var y = (1 - t) * (1 - t) * 4 + 2 * (1 - t) * t * 30 + t * t * 4;
        if (x < ancho - 4) bombilla(x, y);
      });
    }

    [10, ancho - 10].forEach(function (x) {
      elemento("line", { x1: x, y1: 4, x2: x, y2: 128, stroke: "#0b0f0e", "stroke-width": 1.2 });
      for (var y = 24; y <= 120; y += 24) bombilla(x, y);
    });
  }

  dibujarLuces();
  window.addEventListener("resize", dibujarLuces);
})();
