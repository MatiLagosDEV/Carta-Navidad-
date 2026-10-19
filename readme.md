# Navidad con Corazón — sitio web

Sitio estático (HTML + CSS + JavaScript) que funciona de dos maneras **con el mismo código**:

| Modo | Cuándo | Dónde se guardan los datos |
|---|---|---|
| **Demo** | Por defecto, sin tocar nada | En el navegador (localStorage). Ideal para mostrar el sitio |
| **Real** | Al pegar las credenciales de Supabase | En la base de datos del cliente |

El modo se decide solo, mirando `js/config.js`. No hay dos versiones del sitio.

---

## PARTE 1 — Ver el demo en tu computador

No necesita cuentas, ni base de datos, ni internet (salvo para las fuentes e imágenes).

1. Abre una terminal en la carpeta `sitio/`.
2. Levanta un servidor local:

   ```bash
   python3 -m http.server 8000
   ```

3. Abre en el navegador: **http://localhost:8000**

Para entrar al panel de administración: **http://localhost:8000/login.html**
Usuario `demo@demo.com` — contraseña `demo123`.

> Verás una cinta celeste arriba que dice "Modo demostración". Desaparece sola
> cuando se conecta Supabase.

**Importante:** ábrelo con `http://localhost`, no haciendo doble clic en el archivo
(`file://`), porque algunos navegadores bloquean el guardado de datos en ese caso.

Para borrar los datos de prueba y empezar de cero: en el navegador,
F12 → Application → Local Storage → borrar la clave `ncc_demo_v1`. O simplemente
abre el sitio en una ventana de incógnito.

### Comprobar que la lógica sigue sana

```bash
node test-demo.js
```

Verifica lo importante: que dos personas no puedan reservar el mismo regalo,
que se guarden mensajes y configuración, y que el login rechace credenciales malas.

---

## PARTE 2 — Instrucciones para el cliente: conectar su Supabase

Estos pasos los hace **el dueño del sitio con su propia cuenta**. Toma unos 15 minutos.
No hay que instalar nada.

### Paso 1 — Crear la cuenta y el proyecto

1. Entrar a **https://supabase.com** → *Start your project* → crear cuenta
   (se puede con GitHub o con un email).
2. *New project*:
   - **Name:** `navidad-con-corazon` (o el nombre que quieras).
   - **Database Password:** genera una y **guárdala** en un lugar seguro.
     No se usa en el sitio, pero sirve para recuperar acceso a la base de datos.
   - **Region:** elige la más cercana (por ejemplo *South America (São Paulo)*).
3. Esperar 1–2 minutos a que el proyecto termine de crearse.

El plan gratuito de Supabase alcanza y sobra para este sitio.

### Paso 2 — Crear las tablas

1. En el menú lateral: **SQL Editor** → *New query*.
2. Abrir el archivo `sql/supabase-setup.sql` de esta carpeta, copiar **todo** su
   contenido y pegarlo en el editor.
3. Presionar **Run**.

Debe terminar con "Success". Eso crea:

- `regalos` — la lista de niños y sus regalos.
- `comentarios` — los testimonios que rotan en la portada.
- `mensajes` — lo que llega por el formulario de contacto.
- `configuracion` — redes sociales, correo, año y textos del sitio.
- `admins` — la lista blanca de quién puede administrar (ver Paso 3).
- El bucket `imagenes` — donde se guardan las fotos que se suban desde el panel
  (públicas para verlas, pero solo un admin puede subir o borrar).
- La función `reservar_regalo()` que impide que dos personas reserven el mismo regalo.
- Las reglas de seguridad (RLS): el público puede *ver* regalos y *escribir* mensajes,
  pero **solo quien está en la tabla `admins` puede modificar o borrar cosas**.

### Paso 3 — Crear el usuario administrador

Son tres cosas, y las tres son necesarias. Estar logueado y tener permisos son
cosas distintas: el permiso lo da la tabla `admins`, no el login.

**3.1 — Crear el usuario**

1. Menú lateral: **Authentication** → **Users** → *Add user* → *Create new user*.
2. Escribir el **email** y la **contraseña** para entrar al panel.
3. Marcar **Auto Confirm User** (para no tener que confirmar por correo).
4. *Create user*.

**3.2 — Cerrar el registro público** ⚠️ *no te saltes este paso*

**Authentication** → **Providers** → **Email** → apagar **"Enable sign ups"** → *Save*.

La clave `anon` va publicada en el sitio (es normal, ver Paso 4). Si el registro
queda abierto, cualquiera que la copie puede crearse una cuenta. Con el registro
cerrado, los usuarios los creas solo tú desde este panel.

**3.3 — Darle permisos de admin**

1. En la lista de **Users**, copiar el **UID** del usuario recién creado
   (una cadena tipo `8f3c1e2a-...`).
2. **SQL Editor** → *New query* → pegar esto, cambiando las dos cosas entre comillas:

   ```sql
   INSERT INTO admins (id, email)
   VALUES ('PEGA-AQUI-EL-UID', 'correo@del-admin.cl')
   ON CONFLICT (id) DO NOTHING;
   ```

3. *Run*.

Listo: ese email y contraseña son los del login de `/login.html`.

Si te saltas el 3.3, el usuario entra al panel pero no puede guardar nada
(la base rechaza los cambios). Es la señal de que falta este INSERT.

**Agregar otro admin más adelante:** repetir 3.1 y 3.3.
**Quitarle el acceso a alguien:** `DELETE FROM admins WHERE email = 'correo@...';`
(el usuario sigue existiendo pero ya no puede tocar nada; para borrarlo del todo,
eliminarlo también en Authentication → Users).

### Paso 4 — Copiar las credenciales al sitio

1. Menú lateral: **Project Settings** (el engranaje) → **API**.
2. Copiar dos valores:
   - **Project URL** — algo como `https://abcdefghijkl.supabase.co`
   - **anon public** (en *Project API keys*) — una clave larga que empieza con `eyJ...`
3. Abrir `js/config.js` con cualquier editor de texto y reemplazar:

   ```js
   const SUPABASE_URL  = 'https://abcdefghijkl.supabase.co';   // ← tu Project URL
   const SUPABASE_ANON = 'eyJhbGciOi...';                      // ← tu anon public key
   ```

4. Guardar el archivo y recargar el sitio.

La cinta celeste de "Modo demostración" debe desaparecer: ya está usando la base de datos.

> **¿Es seguro publicar la clave `anon`?** Sí, está pensada para ir en el navegador,
> *siempre que* hayas hecho el Paso 3.2 (cerrar el registro). Lo que protege los datos
> son las reglas RLS del script SQL: quien no esté en la tabla `admins` no puede editar
> ni borrar nada, ni leer los mensajes de contacto ni los datos de los donantes.
> La clave `service_role` es la que **nunca** debe ponerse en el sitio.

### Paso 5 — Cargar los regalos

1. Ir a `/login.html` y entrar con el usuario del Paso 3.
2. En la pestaña **Regalos** → *+ Registrar regalo*, agregar cada niño con su
   institución y hasta dos opciones de regalo.
3. En **Comentarios del slider**, borrar los de ejemplo y poner testimonios reales.
4. En **Configuración**, cambiar redes sociales, correo, año y textos del footer.
   Eso se refleja en todo el sitio sin tocar código.
5. En **Mensajes** aparece lo que envía la gente por el formulario de contacto.

### Paso 5b — Cargar muchos regalos de una vez (planilla)

Si ya tienes la lista en Excel, no hace falta escribirlos uno por uno.

1. **Regalos** → *Importar planilla*.
2. Elegir el archivo **.xlsx**, **.xls** o **.csv**.
3. El panel muestra un resumen antes de guardar nada: cuántos se van a importar,
   cuántos se omiten por estar repetidos y qué filas tienen problemas.
4. *Importar N regalos*.

**Cómo debe verse la planilla.** La primera fila son los títulos de las columnas:

| Nombre | Institución | Regalo (Opción 1) | Regalo (Opción 2) | Estado | Nombre Donador/a | Encargado |
|---|---|---|---|---|---|---|
| Alma Heredia González | Colegio Olimpia Guzman | Lápices de plumón de 100 colores | No aplica | Entregado | Felipe Moncada | Fran |
| Amanda Inostroza | Jardines Chileduca | Pop it | Piscina de pelotas | Entregado | Maximiliano G | Fran |

Reglas útiles:

- **Obligatorias:** *Nombre*, *Institución* y *Regalo (Opción 1)*. Sin alguna de las
  tres, el archivo no se importa y el panel dice cuál falta.
- Las demás columnas son opcionales; las que sobren en tu planilla se ignoran.
- Los títulos no distinguen mayúsculas ni tildes: `INSTITUCION` y `Institución` son lo mismo.
- **Estado** acepta *Disponible*, *Reservado* o *Entregado* (también *Libre*, *Pendiente*,
  *Tomado*). Vacío se toma como **Disponible**. Cualquier otra palabra marca esa fila
  como error y no se importa.
- **"No aplica"**, un guión o la celda vacía significan "sin dato" — así que
  *Regalo (Opción 2)* queda vacío, no con el texto "No aplica".
- **No se duplica:** si un niño ya está cargado con la misma institución, se omite.
  Puedes importar el mismo archivo dos veces sin que se dupliquen los regalos.
- Máximo 2.000 filas por archivo.

### Paso 6 — Fotos de los regalos (opcional)

**Vienen apagadas.** Para encenderlas: **Configuración** → *Mostrar la foto de cada
regalo en el sitio* → **Sí** → *Guardar configuración*.

Con eso encendido, cada regalo que tenga foto la muestra en la lista y en la pared
de cartas de la portada. Los que no tengan foto se ven igual que siempre, así que
no hace falta fotografiarlos todos para activar la opción.

Para subir una: **Regalos** → *Editar* (o *+ Registrar regalo*) → **Foto del regalo**.
JPG, PNG, WEBP o GIF, hasta 3 MB. La foto se sube recién al apretar *Guardar*, y
*Quitar foto* la saca del regalo.

> **Sobre fotos de niños:** para publicar la cara de un niño hace falta la
> autorización de su apoderado. Fotografiar el **regalo** (el juguete) no tiene
> ese problema y es lo que recomendamos.

### Paso 7 — Colores y fotos de las páginas (opcional)

Todo está en la pestaña **Configuración**, abajo:

- **Color de fondo del sitio** — el verde petróleo de casi todas las páginas.
- **Color de los botones y acentos** — el coral de los botones y los destacados.
- **Color de los bloques claros y del texto** — el crema de las secciones claras.
- **Sobre nosotros / Voluntarios — foto de arriba y de abajo** — se reemplazan
  eligiendo un archivo; la miniatura muestra cuál quedó.

Los cambios se ven al recargar el sitio. Si un color queda ilegible, se vuelve a
poner el original: fondo `#012e29`, acento `#ef5151`, claro `#fff7db`.

Lo que **no** se puede cambiar desde el panel es la estructura de las páginas
(mover bloques, crear secciones nuevas, cambiar tipografías). Eso es trabajo de
diseño y requiere tocar el código.

---

## PARTE 3 — Publicar en Netlify

### Opción A — Arrastrar y soltar (la más rápida)

1. Entrar a **https://app.netlify.com** → crear cuenta gratis.
2. Ir a *Sites* → arrastrar la carpeta **`sitio/`** completa a la zona que dice
   *Drag and drop your site output folder here*.
3. Listo: Netlify entrega una URL tipo `https://algo-al-azar.netlify.app`.

Para actualizar el sitio después, se vuelve a arrastrar la carpeta.

### Opción B — Conectado a Git (se actualiza solo)

1. Subir el repositorio a GitHub.
2. En Netlify: *Add new site* → *Import an existing project* → elegir el repositorio.
3. Configurar:
   - **Build command:** dejar vacío
   - **Publish directory:** `sitio`
4. *Deploy*. Cada `git push` republica el sitio automáticamente.

El archivo `netlify.toml` de la raíz ya deja configurado el *publish directory*.

### Dominio propio (por ejemplo `navidadconcorazon.cl`)

Netlify permite dominios personalizados **gratis**, incluso en el plan Free, con
certificado SSL automático (Let's Encrypt) que se renueva solo.

1. Comprar el dominio donde prefieras (NIC Chile, GoDaddy, Namecheap…).
2. En Netlify: *Site configuration* → *Domain management* → *Add a domain*.
3. Escribir el dominio y seguir las instrucciones. Hay dos caminos:
   - **Nameservers de Netlify** (lo más simple): cambiar los nameservers en el
     proveedor del dominio por los que indica Netlify.
   - **Registros DNS manuales**: crear un registro `A` apuntando a la IP que
     indica Netlify y un `CNAME` para `www`.
4. Esperar la propagación (de minutos a 24 horas). El SSL se activa solo después.

---

## Estructura de archivos

```
sitio/
├── index.html              Portada: carta hojeable, cómo funciona, pared de cartas y testimonios
├── sobre-nosotros.html     Historia (texto a la izquierda, fotos a la derecha)
├── voluntarios.html        Qué hacen, inscripción y cita en cintillo coral
├── medios.html             Placeholder para prensa (pendiente de contenido)
├── contacto.html           Formulario que guarda el mensaje en la base de datos
├── lista-de-regalos.html   Buscar, filtrar y reservar regalos
├── login.html              Entrada al panel
├── admin.html              Panel: regalos, comentarios, configuración y mensajes
├── css/style.css
├── js/
│   ├── config.js           ← EL ÚNICO ARCHIVO QUE HAY QUE EDITAR
│   ├── datos.js            Habla con Supabase o con el demo, según config.js
│   ├── importar.js         Convierte las filas de una planilla en regalos
│   ├── layout.js           Header (con menú móvil) y footer de todas las páginas
│   ├── home.js             Carta del hero, pared de cartas y slider de testimonios
│   ├── lista.js            Lista de regalos y reserva
│   ├── contacto.js         Envío del formulario
│   ├── login.js            Inicio de sesión
│   └── admin.js            Panel de administración
├── sql/supabase-setup.sql  Script para pegar en Supabase
└── test-demo.js            Chequeo del modo demo (node test-demo.js)
```

---

## ¿Aguanta el plan gratis? (medido, no estimado)

Los dos planes gratis y lo que consume el sitio hoy, con 17 regalos cargados:

| | Plan gratis | Lo que usa el sitio | Techo real |
|---|---|---|---|
| **Netlify** — banda | 100 GB/mes | ~20 KB por visita (HTML+CSS+JS comprimidos) | ~5.000.000 visitas/mes |
| **Netlify** — build | 300 min/mes | 0 si publicas arrastrando la carpeta | no aplica |
| **Supabase** — tráfico | 5 GB/mes | ~6 KB por visita (2-3 llamadas) | ~800.000 visitas/mes |
| **Supabase** — base | 500 MB | 17 regalos ≈ 20 KB | cabrían ~200.000 regalos |
| **Supabase** — archivos | 1 GB | 2 fotos ≈ 150 KB | ~10.000 fotos ya reducidas |

Las imágenes de las páginas, las tipografías y la librería de Supabase **no**
se sirven desde Netlify (vienen de Framer, Google y jsDelivr), así que no
gastan la banda del plan.

### Lo único que sí puede reventar el plan gratis

**Activar las fotos de los regalos con fotos pesadas.** Con `fotos_regalos =
si` y 200 regalos con foto, cada visita a la lista descarga las fotos que se
ven en pantalla. Con fotos de 3 MB eso eran ~27 MB por visita: los 5 GB de
Supabase se acababan en **185 visitas**. Desde ahora el panel reduce cada foto
a 1000 px y ~100 KB antes de subirla (medido: una foto de iPhone de 12 MP
queda en 85 KB), así que la misma página son ~900 KB por visita y el techo
sube a **~5.500 visitas al mes**. Si esperas más tráfico que eso con fotos
activadas, lo barato es dejar `fotos_regalos = no`.

### El proyecto se pausa solo si nadie lo usa

Supabase apaga los proyectos gratis tras **7 días sin una sola petición**. Si
eso pasa, el sitio carga pero sale sin datos, y hay que entrar al panel de
Supabase y apretar *Restore*. Durante la campaña no ocurre (las visitas lo
mantienen despierto); el riesgo es en marzo, cuando nadie entra. La forma más
simple de evitarlo es abrir el sitio una vez por semana.

---

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Sigue apareciendo la cinta "Modo demostración" | `js/config.js` todavía tiene `TU-PROYECTO`. Revisa que pegaste la Project URL completa. |
| La lista de regalos aparece vacía | La base está recién creada: hay que registrar los regalos desde `/admin.html`. |
| No puedo entrar al panel | El usuario se crea en Supabase → Authentication → Users, no desde el sitio. Verifica que quedó *confirmado*. |
| Guardo algo en el admin y no cambia nada | Cerraste sesión o el token venció. Vuelve a entrar por `/login.html`. |
| "Justo se acaba de reservar por otra persona" | Es el comportamiento correcto: alguien tomó ese regalo primero. |
| Los cambios de configuración no se ven | Recarga la página (Ctrl/Cmd + Shift + R). |
# Carta-Navidad-
# Carta-Navidad-
