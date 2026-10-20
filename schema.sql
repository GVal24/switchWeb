-- ============================================================
-- PROYECTO SWITCH: SCRIPT DE ESTRUCTURA DE BASE DE DATOS (schema.sql)
-- Motor: PostgreSQL 14+
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLA: usuarios
-- ------------------------------------------------------------
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    dni VARCHAR(15) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    telefono VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    validado_mayor_edad BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_aceptacion_terminos TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rol VARCHAR(20) NOT NULL DEFAULT 'VECINO', -- 'VECINO', 'DELEGADO', 'ADMIN'
    activo BOOLEAN NOT NULL DEFAULT TRUE,      -- false => bloqueo permanente por administración
    suspendido_hasta TIMESTAMP NULL,           -- fecha de fin de suspensión temporal (NULL = sin suspensión)
    motivo_suspension TEXT NULL,               -- por qué se suspendió (ej. hallazgo de posible imagen de menor)
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_rol CHECK (rol IN ('VECINO', 'DELEGADO', 'ADMIN'))
);

-- ------------------------------------------------------------
-- 2. TABLA: instituciones
-- ------------------------------------------------------------
CREATE TABLE instituciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'COMEDOR', 'HOGAR', 'BIBLIOTECA', 'CENTRO_DIA', etc.
    direccion VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    descripcion TEXT,
    latitud NUMERIC(10, 8) NOT NULL,
    longitud NUMERIC(11, 8) NOT NULL,
    qr_codigo_hash VARCHAR(255) UNIQUE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 3. TABLA: cupos_necesidad
-- ------------------------------------------------------------
CREATE TABLE cupos_necesidad (
    id SERIAL PRIMARY KEY,
    institucion_id INT NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
    titulo VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    -- La institución declara qué tan crítica es la necesidad para su población.
    -- Determina la vigencia base del Nexo Social de quien la cubre.
    prioridad VARCHAR(15) NOT NULL DEFAULT 'GENERAL',
    cupo_maximo INT NOT NULL CHECK (cupo_maximo > 0),
    cupo_actual INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE, -- false cuando se completa o se pausa
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_prioridad CHECK (prioridad IN ('GENERAL', 'PRIORITARIA', 'URGENTE')),
    CONSTRAINT chk_cupos_validos CHECK (cupo_actual <= cupo_maximo)
);

-- ------------------------------------------------------------
-- 4. TABLA: nexos_sociales
-- ------------------------------------------------------------
CREATE TABLE nexos_sociales (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cupo_necesidad_id INT REFERENCES cupos_necesidad(id),
    institucion_id INT NOT NULL REFERENCES instituciones(id),
    metodo_validacion VARCHAR(20) NOT NULL DEFAULT 'QR_GPS', -- 'QR_GPS', 'APROBACION_DELEGADO'
    latitud_usuario NUMERIC(10, 8),
    longitud_usuario NUMERIC(11, 8),
    nivel_impacto VARCHAR(10) NOT NULL DEFAULT 'SIMPLE', -- 'SIMPLE', 'MEDIO', 'ALTO'
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO', -- 'ACTIVO', 'INACTIVO', 'EXPIRADO'
    fecha_activacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '60 days'),

    CONSTRAINT chk_metodo CHECK (metodo_validacion IN ('QR_GPS', 'APROBACION_DELEGADO')),
    CONSTRAINT chk_estado_nexo CHECK (estado IN ('ACTIVO', 'INACTIVO', 'EXPIRADO'))
);

-- ------------------------------------------------------------
-- 5. TABLA: publicaciones_p2p
-- ------------------------------------------------------------
CREATE TABLE publicaciones_p2p (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    nivel_esfuerzo VARCHAR(10) NOT NULL, -- 'SIMPLE', 'MEDIO', 'ALTO'
    tipo_item VARCHAR(20) NOT NULL DEFAULT 'GENERAL', -- 'GENERAL', 'OBJETO', 'SERVICIO'
    imagen_url TEXT,
    -- 'PENDIENTE_REVISION': la imagen fue screenshoteada y está en cuarentena
    -- hasta que una persona la apruebe. No aparece en el catálogo público.
    -- 'Activo', 'Pausado', 'Completado', 'Rechazada'
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_REVISION',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_nivel CHECK (nivel_esfuerzo IN ('SIMPLE', 'MEDIO', 'ALTO')),
    CONSTRAINT chk_estado_publicacion
        CHECK (estado IN ('PENDIENTE_REVISION', 'Activo', 'Pausado', 'Completado', 'Rechazada'))
);

-- ------------------------------------------------------------
-- 6. TABLA: mensajes_chat
--    emisor_id / receptor_id son VARCHAR para soportar tanto
--    IDs de usuarios ("1", "2") como instituciones ("inst_1")
-- ------------------------------------------------------------
CREATE TABLE mensajes_chat (
    id SERIAL PRIMARY KEY,
    emisor_id VARCHAR(50) NOT NULL,
    receptor_id VARCHAR(50) NOT NULL,
    texto TEXT NOT NULL,
    leido BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mensajes_conversacion ON mensajes_chat (emisor_id, receptor_id);
CREATE INDEX idx_mensajes_creado ON mensajes_chat (creado_en);

-- ------------------------------------------------------------
-- 7. TABLA: reportes (denuncias de la comunidad)
-- ------------------------------------------------------------
CREATE TABLE reportes (
    id SERIAL PRIMARY KEY,
    reportante_id VARCHAR(50) NOT NULL,
    reportante_nombre VARCHAR(101) NOT NULL DEFAULT '',
    reportado_id VARCHAR(50),                 -- NULL => inconveniente general (no apunta a un usuario)
    reportado_nombre VARCHAR(101) NOT NULL DEFAULT '',
    motivo TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'DESESTIMADO', 'RESUELTO_BAN', 'RESUELTO_SUSPENSION'
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_estado_reporte CHECK (estado IN ('PENDIENTE', 'DESESTIMADO', 'RESUELTO_BAN', 'RESUELTO_SUSPENSION'))
);

-- ------------------------------------------------------------
-- 8. TABLA: intercambios (propuestas de Switch / trueques)
-- ------------------------------------------------------------
CREATE TABLE intercambios (
    id SERIAL PRIMARY KEY,
    publicacion_deseada_id INT NOT NULL REFERENCES publicaciones_p2p(id) ON DELETE CASCADE,
    titulo_deseado VARCHAR(100) NOT NULL DEFAULT '',
    dueno_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ofertante_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ofertante_nombre VARCHAR(101) NOT NULL DEFAULT '',
    items_ofrecidos JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ "id": "3", "titulo": "..." }]
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'COMPLETADO'
    confirmacion_dueno BOOLEAN NOT NULL DEFAULT FALSE,
    confirmacion_ofertante BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_estado_intercambio CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'COMPLETADO'))
);

CREATE INDEX idx_intercambios_creado ON intercambios (creado_en);
CREATE INDEX idx_intercambios_dueno ON intercambios (dueno_id);
CREATE INDEX idx_intercambios_ofertante ON intercambios (ofertante_id);

-- ------------------------------------------------------------
-- 9. TABLA: resenas (calificaciones entre vecinos tras un trueque)
-- ------------------------------------------------------------
CREATE TABLE resenas (
    id SERIAL PRIMARY KEY,
    intercambio_id INT NOT NULL REFERENCES intercambios(id) ON DELETE CASCADE,
    autor_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    destino_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    puntaje INT NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
    comentario TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_resena_por_intercambio UNIQUE (intercambio_id, autor_id)
);

-- Sugerencias de la comunidad sobre el nivel de esfuerzo de una publicación.
-- El clasificador automático puede equivocarse: los usuarios marcan el error
-- y administración decide si aplica la corrección.
CREATE TABLE sugerencias_esfuerzo (
    id SERIAL PRIMARY KEY,
    publicacion_id INT NOT NULL REFERENCES publicaciones_p2p(id) ON DELETE CASCADE,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nivel_sugerido VARCHAR(10) NOT NULL CHECK (nivel_sugerido IN ('SIMPLE', 'MEDIO', 'ALTO')),
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_estado_sugerencia CHECK (estado IN ('PENDIENTE', 'APLICADA', 'DESCARTADA')),
    -- Un mismo usuario no puede sugerir dos veces para la misma publicación
    CONSTRAINT uq_sugerencia_por_usuario UNIQUE (publicacion_id, usuario_id)
);

-- ------------------------------------------------------------
-- 10. TABLA: verificaciones_otp
--     Códigos de un solo uso para comprobar que el teléfono celular
--     pertenece a quien se está registrando. El código NUNCA se guarda
--     en claro: se almacena su HMAC-SHA256 con clave del servidor.
--     Al consumirse queda marcado y no puede reutilizarse.
-- ------------------------------------------------------------
CREATE TABLE verificaciones_otp (
    id SERIAL PRIMARY KEY,
    telefono VARCHAR(20) NOT NULL,
    proposito VARCHAR(30) NOT NULL,            -- 'REGISTRO' (único uso por ahora)
    canal VARCHAR(10) NOT NULL,                -- canal por el que se envió
    codigo_hash VARCHAR(64) NOT NULL,          -- HMAC-SHA256 del código
    ip_origen VARCHAR(45) NULL,                -- freno de abuso por origen
    intentos INT NOT NULL DEFAULT 0,           -- intentos fallidos acumulado
    max_intentos INT NOT NULL DEFAULT 5,
    expira_en TIMESTAMP NOT NULL,              -- vigencia del código
    consumido_en TIMESTAMP NULL,               -- NULL = todavía sin usar
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_otp_proposito CHECK (proposito IN ('REGISTRO')),
    CONSTRAINT chk_otp_canal CHECK (canal IN ('SMS', 'WHATSAPP'))
);

-- Búsqueda del código activo de un teléfono para un propósito dado
CREATE INDEX idx_otp_telefono_proposito
    ON verificaciones_otp (telefono, proposito, creado_en DESC);

-- Purga periódica de códigos vencidos
CREATE INDEX idx_otp_expira_en
    ON verificaciones_otp (expira_en);

-- ------------------------------------------------------------
-- 11. TABLA: aceptaciones_legales
--     Constancia de qué versión de cada documento aceptó la persona
--     usuaria, cuándo y desde dónde. Sin esto no hay forma de probar
--     que el consentimiento fue informado (ver Política de Privacidad).
--     usuario_id es NULL porque el registro ocurre justo al crear la
--     cuenta: primero se acepta, después se inserta el usuario.
-- ------------------------------------------------------------
CREATE TABLE aceptaciones_legales (
    id SERIAL PRIMARY KEY,
    usuario_id INT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    documento VARCHAR(20) NOT NULL,            -- 'TERMINOS' | 'PRIVACIDAD'
    version VARCHAR(20) NOT NULL,              -- versión del texto aceptado
    hash_documento VARCHAR(64) NOT NULL,       -- SHA-256 del contenido servido
    ip_origen VARCHAR(45) NULL,                -- X-Forwarded-For o req.ip
    user_agent VARCHAR(255) NULL,
    aceptado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_doc_aceptado CHECK (documento IN ('TERMINOS', 'PRIVACIDAD'))
);

CREATE INDEX idx_aceptaciones_usuario
    ON aceptaciones_legales (usuario_id);

-- ------------------------------------------------------------
-- 12. TABLA: moderacion_imagenes
--     Registro de cada imagen subida y del resultado del filtrado.
--
--     Decisión de diseño: el filtro automático NO puede determinar con
--     fiabilidad si una persona es menor de edad (los modelos de edad se
--     erran por años y fallan con fotos borrosas o de perfil). Por eso
--     la aplicación no intenta adivinarlo: marca SIEMPRE la imagen para
--     revisión humana y la publication queda en cuarentena, invisible
--     para el catálogo público, hasta que alguien la apruebe.
--
--     El filtrado automático sí resuelve lo que el software detecta bien:
--     formato real del archivo, dimensiones, peso, contenido animado y
--     metadatos EXIF/GPS (que además es un riesgo de privacidad).
-- ------------------------------------------------------------
CREATE TABLE moderacion_imagenes (
    id SERIAL PRIMARY KEY,
    publicacion_id INT NULL REFERENCES publicaciones_p2p(id) ON DELETE CASCADE,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    mime_detectado VARCHAR(30) NULL,           -- leído de los bytes reales, no del enviado
    peso_bytes INT NULL,

    -- Resultado del filtrado técnico automático
    filtro_estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    filtro_puntaje INT NOT NULL DEFAULT 0,    -- 0 (limpio) a 100 (altamente sospechoso)
    filtro_motivos JSONB NULL,                  -- lista de motivos del rechazo automático

    -- Resultado de la revisión de una persona
    revisado_por INT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    revisado_en TIMESTAMP NULL,
    decision VARCHAR(20) NULL,                -- 'APROBADA' | 'RECHAZADA'
    motivo_rechazo VARCHAR(200) NULL,
    contiene_menor BOOLEAN NOT NULL DEFAULT FALSE,  -- hallazgo de revisión humana

    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_filtro_estado
        CHECK (filtro_estado IN ('PENDIENTE', 'APROBADA_TECNICAMENTE', 'RECHAZADA_TECNICAMENTE', 'ERROR')),
    CONSTRAINT chk_decision_moderacion
        CHECK (decision IS NULL OR decision IN ('APROBADA', 'RECHAZADA'))
);

-- Cola de trabajo del panel de administración
CREATE INDEX idx_moderacion_pendientes
    ON moderacion_imagenes (filtro_estado, creado_en)
    WHERE decision IS NULL;

CREATE INDEX idx_moderacion_publicacion
    ON moderacion_imagenes (publicacion_id);

-- Evita que la misma imagen se procese dos veces por carrera
CREATE UNIQUE INDEX idx_moderacion_archivo_unico
    ON moderacion_imagenes (nombre_archivo);

-- ------------------------------------------------------------
-- 13. TABLA: mensajes_contacto
--     Preguntas, comentarios o pedidos de ayuda que cualquier persona
--     le envía al equipo de administración.
--
--     Se guarda el texto de quien escribe aunque la cuenta luego se borre
--     (usuario_id queda NULL): los datos personales se copian en columnas
--     de texto para que el mensaje siga siendo legible y para poder
--     responder aunque el autor ya no exista.
--
--     'leido' es lo que dispara el aviso en el panel: mientras sea FALSE
--     el mensaje cuenta como pendiente de responder.
-- ------------------------------------------------------------
CREATE TABLE mensajes_contacto (
    id SERIAL PRIMARY KEY,
    usuario_id INT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    autor_nombre VARCHAR(101) NOT NULL,        -- nombre y apellido al momento de escribir
    autor_dni VARCHAR(20) NULL,                -- sólo si estaba conectado al escribir
    autor_telefono VARCHAR(30) NULL,
    asunto VARCHAR(60) NOT NULL,               -- 'PREGUNTA' | 'COMENTARIO' | 'CONTACTO'
    mensaje TEXT NOT NULL,
    respuesta TEXT NULL,                       -- lo que la administración contesta
    respondido_por INT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    respondido_en TIMESTAMP NULL,
    leido BOOLEAN NOT NULL DEFAULT FALSE,
    ip_origen VARCHAR(45) NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_asunto_contacto
        CHECK (asunto IN ('PREGUNTA', 'COMENTARIO', 'CONTACTO'))
);

-- Bandeja del panel: primero lo que nadie leyó, y de lo más nuevo a lo más viejo
CREATE INDEX idx_mensajes_contacto_pendientes
    ON mensajes_contacto (leido, creado_en DESC);

CREATE INDEX idx_mensajes_contacto_usuario
    ON mensajes_contacto (usuario_id);
