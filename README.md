# Switch — Web (PWA de Trueques y Voluntariado Comunitario)

Switch es una plataforma que conecta a los vecinos de una ciudad con las instituciones comunitarias de su comunidad y les permite intercambiar objetos y servicios entre pares (P2P). La app premia la participación real: cada trueque completado o voluntariado verificado genera **Impacto Comunitario** (niveles, puntos e insignias) que mejora la reputación del vecino y la visibilidad de sus publicaciones.

Este repositorio contiene la **versión web progresiva (PWA)** de Switch, que se puede usar desde cualquier teléfono o navegador, sin instalar nada desde una tienda de aplicaciones.

<p align="center">
  <img src="docs/screenshots/logo.png" width="120" alt="Switch">
</p>

---

## 📸 Capturas

> Las imágenes de `docs/screenshots/` son de la app móvil original. Se reemplazarán por capturas de la versión web cuando esté publicada.

| Voluntariado | Catálogo P2P | Perfil e insignias |
|:---:|:---:|:---:|
| ![Voluntariado](docs/screenshots/voluntariado.jpg) | ![Catálogo](docs/screenshots/catalogo.jpg) | ![Perfil](docs/screenshots/perfil.jpg) |

| Accesibilidad | Panel admin | Chat |
|:---:|:---:|:---:|
| ![Accesibilidad](docs/screenshots/accesibilidad.jpg) | ![Admin](docs/screenshots/admin.jpg) | ![Chat](docs/screenshots/chat.jpg) |

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Web (PWA) | HTML, CSS y JavaScript (ES Modules), sin dependencias externas |
| Backend | Node.js + Express (API REST) |
| Base de datos | PostgreSQL |
| Autenticación | JWT (JSON Web Tokens) + bcrypt |
| Archivos | Multer (subida de imágenes) |
| QR / Geolocalización | Lectura de QR en el navegador (`BarcodeDetector`) + `geolocation` |
| Despliegue | Web en **Vercel**, backend en **Render**, base de datos en **Neon** |

### Características de la PWA

- **Instalable**: se agrega a la pantalla de inicio del teléfono como una app (`manifest.webmanifest`).
- **Funciona offline (parcial)**: un service worker (`sw.js`) cachea la interfaz; las acciones que necesitan datos requieren conexión.
- **Accesibilidad**: 4 paletas (estándar, vista accesible, alto contraste y paleta suave), escala de texto, modo blanco y negro, navegación por teclado, foco visible y respeto por `prefers-reduced-motion`.
- **Sin CDN**: todos los recursos se sirven desde el propio proyecto.

---

## Funcionalidades principales

- **Voluntariado verificado**: las instituciones publican sus necesidades con prioridad (General / Prioritaria / Urgente). El vecino coordina por chat, se presenta y **escanea el QR físico de la institución** para activar su *Nexo Social*.
- **Vigencia inteligente del Nexo Social**: los días de validez se calculan según la urgencia de la necesidad, el esfuerzo estimado de la tarea y el nivel comunitario del voluntario.
- **Catálogo P2P**: publicación de objetos y servicios con **clasificación automática de esfuerzo**, búsqueda, filtros y propuestas de trueque multi-ítem.
- **Gamificación**: niveles de comunidad — *Semilla del Barrio → Brote Activo → Vecino Confiable → Motor Solidario → Pilar de la Comunidad* — con puntos e insignias, incluidas **insignias secretas**.
- **Chat integrado** entre vecinos y con instituciones, sistema de reportes y reseñas.
- **Panel de administración**: métricas de la red, moderación de publicaciones e imágenes, reportes (desestimar, suspender, dar de baja), buzón de contacto y sugerencias de esfuerzo.

---

## Estructura del proyecto

```
switchWeb/
├── frontend-web/              # La PWA (lo que se publica en Vercel)
│   ├── index.html             # Estructura base
│   ├── manifest.webmanifest   # Configuración de la PWA instalable
│   ├── sw.js                  # Service worker (cache / offline)
│   ├── css/                   # tema.css, componentes.css, pantallas.css
│   ├── icons/                 # Íconos de la app
│   └── js/
│       ├── app.js             # Arranque, armazón y navegación
│       ├── config.js          # URL del backend
│       ├── store.js           # Sesión y preferencias de accesibilidad
│       ├── api.js             # Cliente de la API REST
│       ├── ui.js              # Componentes e íconos
│       ├── router.js          # Enrutador por hash
│       └── screens/           # Pantallas (públicas y admin/)
├── backend/                   # API REST (lo que se publica en Render)
│   ├── src/
│   │   ├── config/            # Conexión a PostgreSQL
│   │   ├── controllers/       # Capa HTTP
│   │   ├── middlewares/       # JWT, errores, asyncWrapper
│   │   ├── models/            # Acceso a datos (SQL)
│   │   ├── routes/            # Endpoints /api
│   │   └── utils/             # Gamificación, clasificador, geo, imágenes
│   ├── scripts/generarQrs.js
│   └── qrs_instituciones/     # PNG de los QR de presencia
├── docs/screenshots/          # Capturas usadas en el README
├── .env.example               # Plantilla de variables de entorno
├── schema.sql                 # DDL completo (14 tablas)
├── seed.sql                   # Datos de ejemplo
└── diagramas_mermaid_srs.md   # UML del sistema
```

El backend también sirve la PWA en `/app/` cuando se ejecuta en el mismo servidor, así que puede usarse **todo junto en Render** sin necesidad de Vercel.

---

## Puesta en marcha (desarrollo local)

### Requisitos

- Node.js 18+
- PostgreSQL 14+ (local, o una base en Neon)

### 1. Base de datos

Con PostgreSQL local:

```bash
psql -U postgres -c "CREATE DATABASE switch_db;"
psql -U postgres -d switch_db -f schema.sql
psql -U postgres -d switch_db -f seed.sql
```

O cargá `schema.sql` y luego `seed.sql` en el editor SQL de Neon (en ese orden).

### 2. Backend

```bash
cd backend
npm install
npm run dev     # o: npm start
```

La configuración usa los mismos nombres de variables en local y Render. En local, copiá `.env.example` como `.env` en la raíz del repositorio y completá los datos de tu PostgreSQL local. El backend detecta Render automáticamente: allí no carga el `.env` y usa las variables configuradas en **Environment** del servicio. Poné en Render los datos de Neon con esos mismos nombres (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`) o configurá `DATABASE_URL` con la connection string de Neon. Así, el `.env` local no pisa las credenciales de producción.

```env
PORT=3000
DB_USER=postgres
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=5432
DB_NAME=switch_db
DB_SSL=false
# Alternativa para Render: DATABASE_URL=postgresql://...Neon...
JWT_SECRET=una_clave_larga_y_secreta
OTP_PROVEEDOR=MOCK
OTP_HMAC_SECRET=una_clave_larga_para_otp
GPS_VALIDACION_ACTIVA=false
ORIGENES_PERMITIDOS=       # vacío = permite cualquier origen (local)
```

La opción **Recuperarla** envía un código al teléfono registrado y permite cambiar la contraseña sin intervención administrativa. Para que funcione en Render, configurá un proveedor real de SMS o WhatsApp (`OTP_PROVEEDOR` y sus credenciales; por ejemplo `TWILIO_SMS`) y una clave `OTP_HMAC_SECRET` larga y secreta. `MOCK` es solo para desarrollo local. Los cambios necesarios de base de datos están incluidos en `schema.sql`.

### 3. Web

Con el backend corriendo en el puerto 3000, la web se sirve en:

```
http://localhost:3000/app/
```

También se puede abrir `frontend-web/index.html` con un servidor estático (Live Server, etc.); en ese caso la web apunta sola al backend en el puerto 3000 del mismo host.

### 4. Códigos QR de las instituciones

```bash
cd backend
node scripts/generarQrs.js   # guarda los PNG en backend/qrs_instituciones/
```

---

## Despliegue en la nube

El sistema se reparte en tres servicios:

```
   ┌─────────┐     ┌──────────────┐     ┌───────────┐
   │  Vercel │────▶│    Render    │────▶│   Neon    │
   │  (web)  │ API │  (backend)   │ SQL │ (base de  │
   │         │     │              │     │  datos)   │
   └─────────┘     └──────────────┘     └───────────┘
```

### 1. Base de datos (Neon)

1. Crear un proyecto en [neon.tech](https://neon.tech) y copiar la cadena de conexión.
2. En el **SQL Editor**, ejecutar `schema.sql`. Incluye la estructura completa y las actualizaciones; se puede volver a ejecutar sobre una base existente sin borrar sus datos.
3. Ejecutar `seed.sql` sólo si querés cargar los datos de demostración en una base descartable: ese archivo vacía las tablas antes de insertar los ejemplos.

### 2. Backend (Render)

1. Crear un **Web Service** apuntando a este repositorio.
2. **Root Directory:** `backend`
3. **Build Command:** `npm install`  ·  **Start Command:** `npm start`
4. Cargar las variables de entorno (las de Neon + `JWT_SECRET` + `ORIGENES_PERMITIDOS`).

Las imágenes nuevas se guardan como `BYTEA` en Neon, por lo que sobreviven los reinicios y despliegues de Render sin necesitar un disco persistente. Las imágenes quedan en cuarentena y recién se muestran en el catálogo cuando una persona administradora las aprueba. Las fotos subidas antes de este cambio no se recuperan automáticamente si Render ya eliminó el almacenamiento efímero. Considerá el espacio de base de datos disponible en tu plan de Neon: las fotos consumen ese espacio.

### 3. Web (Vercel)

1. Importar el repositorio en [vercel.com](https://vercel.com).
2. **Root Directory:** `frontend-web`
3. En `frontend-web/index.html`, descomentar y completar la línea que apunta al backend:

```html
<script>window.SWITCH_API_URL = 'https://TU-BACKEND.onrender.com/api';</script>
```

4. Copiar la URL de Vercel y agregarla a `ORIGENES_PERMITIDOS` en Render.

> Alternativa más simple: usar **solo Render** (sin Vercel). El backend sirve la web en `https://TU-BACKEND.onrender.com/app/`.

---

## Usuarios del seed

Todos los vecinos y delegados comparten la contraseña `clave123`; el administrador tiene la suya.

| ID | Rol | DNI | Nombre | Contraseña |
|---|---|---|---|---|
| 1 | Vecina (nivel 2) | `38450912` | Guillermina Valdez | `clave123` |
| 2 | Vecino | `35123456` | Carlos Rodríguez | `clave123` |
| 3 | Delegada | `28999888` | María Gómez | `clave123` |
| 4 | Administrador | `11111111` | Admin Switch | `Switch2024!` |
| 5 | Vecina | `31222444` | Laura Fernández | `clave123` |
| 6 | Vecino | `27333455` | Diego Martínez | `clave123` |
| 7 | Delegada | `29888777` | Sofía López | `clave123` |
| 8 | Vecino | `33555666` | Martín Pérez | `clave123` |
| 9 | Vecina | `34119988` | Valentina Sosa | `clave123` |
| 10 | Vecino | `30888999` | Joaquín Romero | `clave123` |
| 11 | Vecina | `35555667` | Camila Díaz | `clave123` |
| 12 | Delegado | `31888999` | Nicolás Álvarez | `clave123` |

Los hashes QR de las instituciones del seed están en `seed.sql`.

---

## Documentación adicional

- [Diagramas Mermaid](diagramas_mermaid_srs.md): diagrama de contexto, casos de uso y modelo entidad-relación.
