# Diagramas Mermaid del sistema Switch

En este documento se visualizan el diagrama de contexto, los casos de uso y el modelo entidad-relación. La implementación actual es una app Flutter, una API REST Node.js/Express y PostgreSQL. La API expone 28 endpoints bajo /api y protege las rutas privadas con JWT.

## 1. Diagrama de contexto del sistema

```mermaid
flowchart LR
    vecino[Vecino o usuario de la comunidad]
    delegado[Delegado de institucion]
    admin[Administrador]
    gps[GPS del dispositivo]
    camara[Camara o lector QR]
    sistema((Sistema Switch))
    institucion[Instituciones comunitarias]

    vecino -->|Registro, login, voluntariado, catalogo y chat| sistema
    delegado -->|Gestion y coordinacion de cupos| sistema
    admin -->|Consulta metricas, reportes y moderacion| sistema
    camara -->|Codigo QR de presencia| sistema
    gps -->|Coordenadas de presencia| sistema
    sistema -->|Consulta y activa nexos sociales| institucion
    sistema -->|Publicaciones e intercambios| vecino
```

## 4. Casos de uso principales

```mermaid
flowchart TB
    visitante(["Visitante"])
    usuario(["Usuario autenticado"])
    admin(["Administrador"])

    subgraph gAcceso["Acceso e instituciones"]
        direction LR
        v1["Registrarse"]
        v2["Iniciar sesión"]
        v3["Registrarse como institución"]
        u1["Consultar instituciones"]
        u2["Consultar cupos abiertos"]
    end

    subgraph gVoluntariado["Voluntariado"]
        direction LR
        u3["Escanear QR<br/>y validar presencia"]
    end

    subgraph gCatalogo["Catálogo e intercambios"]
        direction LR
        c1["Consultar<br/>catálogo P2P"]
        c2["Crear publicación"]
        c3["Sugerir corrección<br/>del nivel de esfuerzo"]
        c4["Proponer intercambio"]
        c5["Responder y confirmar<br/>un trueque"]
    end

    subgraph gComunidad["Comunidad"]
        direction LR
        m1["Enviar y recibir<br/>mensajes"]
        m2["Calificar con una reseña"]
        m3["Consultar perfil,<br/>nivel e insignias"]
        m4["Reportar inconveniente<br/>o usuario"]
    end

    subgraph gAdmin["Administración"]
        direction LR
        a1["Consultar estadísticas"]
        a2["Consultar y resolver<br/>reportes"]
        a3["Suspender o dar de baja<br/>usuario"]
        a4["Aplicar o descartar<br/>sugerencias de esfuerzo"]
    end

    visitante --> v1
    visitante --> v2
    visitante --> v3
    usuario --> u1
    usuario --> u2
    usuario --> u3
    usuario --> c1
    usuario --> c2
    usuario --> c3
    usuario --> c4
    usuario --> c5
    usuario --> m1
    usuario --> m2
    usuario --> m3
    usuario --> m4
    admin --> a1
    admin --> a2
    admin --> a3
    admin --> a4
```

## 5. Modelo entidad-relacion

```mermaid
erDiagram
    USUARIOS ||--o{ NEXOS_SOCIALES : activa
    INSTITUCIONES ||--o{ CUPOS_NECESIDAD : ofrece
    CUPOS_NECESIDAD ||--o{ NEXOS_SOCIALES : relaciona
    INSTITUCIONES ||--o{ NEXOS_SOCIALES : registra
    USUARIOS ||--o{ PUBLICACIONES_P2P : crea
    USUARIOS ||--o{ INTERCAMBIOS : propone_como_dueno
    USUARIOS ||--o{ INTERCAMBIOS : propone_como_ofertante
    PUBLICACIONES_P2P ||--o{ INTERCAMBIOS : es_publicacion_deseada
    INTERCAMBIOS ||--o{ RESENAS : recibe
    USUARIOS ||--o{ RESENAS : escribe
    USUARIOS ||--o{ RESENAS : recibe
    USUARIOS ||--o{ SUGERENCIAS_ESFUERZO : sugiere
    PUBLICACIONES_P2P ||--o{ SUGERENCIAS_ESFUERZO : recibe

    USUARIOS {
        serial id PK
        varchar dni UK
        varchar nombre
        varchar apellido
        varchar telefono UK
        varchar password
        boolean validado_mayor_edad
        timestamp fecha_aceptacion_terminos
        varchar rol "VECINO, DELEGADO o ADMIN"
        boolean activo
        timestamp suspendido_hasta
        timestamp creado_en
    }

    INSTITUCIONES {
        serial id PK
        varchar nombre
        varchar tipo
        varchar direccion
        varchar telefono
        text descripcion
        numeric latitud
        numeric longitud
        varchar qr_codigo_hash UK
        timestamp creado_en
    }

    CUPOS_NECESIDAD {
        serial id PK
        int institucion_id FK
        varchar titulo
        text descripcion
        varchar prioridad "GENERAL, PRIORITARIA o URGENTE"
        int cupo_maximo
        int cupo_actual
        boolean activo
        timestamp creado_en
    }

    NEXOS_SOCIALES {
        serial id PK
        int usuario_id FK
        int cupo_necesidad_id FK
        int institucion_id FK
        varchar metodo_validacion "QR_GPS o APROBACION_DELEGADO"
        numeric latitud_usuario
        numeric longitud_usuario
        varchar nivel_impacto "SIMPLE, MEDIO o ALTO"
        varchar estado "ACTIVO, INACTIVO o EXPIRADO"
        timestamp fecha_activacion
        timestamp fecha_expiracion
    }

    PUBLICACIONES_P2P {
        serial id PK
        int usuario_id FK
        varchar titulo
        text descripcion
        varchar nivel_esfuerzo "SIMPLE, MEDIO o ALTO"
        varchar tipo_item "GENERAL, OBJETO o SERVICIO"
        text imagen_url
        varchar estado "Activo, Pausado o Completado"
        timestamp creado_en
    }

    INTERCAMBIOS {
        serial id PK
        int publicacion_deseada_id FK
        varchar titulo_deseado
        int dueno_id FK
        int ofertante_id FK
        varchar ofertante_nombre
        jsonb items_ofrecidos
        varchar estado "PENDIENTE, ACEPTADA, RECHAZADA o COMPLETADO"
        boolean confirmacion_dueno
        boolean confirmacion_ofertante
        timestamp creado_en
    }

    RESENAS {
        serial id PK
        int intercambio_id FK
        int autor_id FK
        int destino_id FK
        int puntaje "1 a 5"
        text comentario
        timestamp creado_en
    }

    SUGERENCIAS_ESFUERZO {
        serial id PK
        int publicacion_id FK
        int usuario_id FK
        varchar nivel_sugerido "SIMPLE, MEDIO o ALTO"
        varchar estado "PENDIENTE, APLICADA o DESCARTADA"
        timestamp creado_en
    }

    REPORTES {
        serial id PK
        varchar reportante_id "ID de usuario o vacio"
        varchar reportante_nombre
        varchar reportado_id "NULL = inconveniente general"
        varchar reportado_nombre
        text motivo
        varchar estado "PENDIENTE, DESESTIMADO, RESUELTO_BAN o RESUELTO_SUSPENSION"
        timestamp creado_en
    }

    MENSAJES_CHAT {
        serial id PK
        varchar emisor_id "ID de usuario o inst_N"
        varchar receptor_id "ID de usuario o inst_N"
        text texto
        boolean leido
        timestamp creado_en
    }
```