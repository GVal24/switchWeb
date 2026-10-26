# Diagramas del sistema Switch

Estos diagramas muestran el sistema actual en palabras simples. Cada uno explica una parte distinta: dónde se ejecuta la app, qué pasa con una foto y cómo se conectan los datos principales. No hace falta conocer el código para leerlos.

## 1. Dónde funciona la aplicación

La persona usa Switch desde el navegador. Render entrega la web y la API; la API consulta y guarda los datos en PostgreSQL alojado en Neon.

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    Person["Vecino, delegado o administrador"]
    Browser["Navegador del telefono o PC"]
    subgraph RenderApp["Aplicacion web en Render"]
        Pwa["Interfaz PWA en /app"]
        Api["API Node.js y Express en /api"]
    end
    Database[("PostgreSQL en Neon")]

    Person -->|"usa Switch"| Browser
    Browser -->|"carga pantallas"| Pwa
    Browser -->|"envia acciones y consultas"| Api
    Api -->|"lee y guarda informacion"| Database
```

**Cómo leerlo:** la PWA es la parte visual; la API procesa las acciones. Ambas se publican en Render y la información persistente vive en Neon. En desarrollo local, el backend puede usar PostgreSQL local según la configuración del entorno.

## 2. Qué ocurre cuando se sube una foto

Este recorrido explica por qué una foto nueva no aparece inmediatamente: antes debe revisarla una persona administradora.

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    PhotoUser["Usuario sube una foto"]
    Upload["API recibe y valida el archivo"]
    Sanitize["Se limpia la imagen y sus metadatos"]
    SaveImage[("Neon guarda bytes y registro")]
    Queue["Queda pendiente de moderacion"]
    Review["Administracion revisa la imagen"]
    Approved["Aprobada: publicacion activa"]
    Rejected["Rechazada: no se muestra"]
    Catalog["Catalogo consulta publicaciones activas"]
    PublicImage["API entrega los bytes de la imagen"]
    BrowserPhoto["La foto aparece en el navegador"]

    PhotoUser -->|"sube"| Upload
    Upload -->|"procesa"| Sanitize
    Sanitize -->|"guarda"| SaveImage
    SaveImage -->|"espera revision"| Queue
    Queue -->|"aparece en el panel"| Review
    Review -->|"si se aprueba"| Approved
    Review -->|"si se rechaza"| Rejected
    Approved -->|"se incluye en"| Catalog
    Approved -->|"habilita el acceso"| PublicImage
    Catalog -->|"solicita la imagen"| PublicImage
    SaveImage -->|"lee los bytes aprobados"| PublicImage
    PublicImage -->|"responde"| BrowserPhoto
```

**Importante:** las imágenes nuevas persisten en Neon y no dependen del disco temporal de Render. Las imágenes que sólo existían en un disco efímero y se perdieron no pueden recuperarse desde la aplicación.

## 3. Datos de comunidad y voluntariado

Una institución publica cupos de necesidad. La participación de una persona en uno de esos cupos queda registrada como un Nexo Social.

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart LR
    People["usuarios"]
    Orgs["instituciones"]
    Needs["cupos_necesidad"]
    Nexuses["nexos_sociales"]

    Orgs -->|"publica cupos"| Needs
    People -->|"participa"| Nexuses
    Orgs -->|"lugar de la actividad"| Nexuses
    Needs -.->|"cupo asociado opcional"| Nexuses
```

La línea punteada indica que `cupo_necesidad_id` puede quedar vacío en un Nexo Social.

## 4. Publicaciones e intercambios

Las publicaciones pertenecen a usuarios. Las propuestas de intercambio conectan una publicación deseada con las personas involucradas; después de completar el intercambio se pueden guardar reseñas.

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart LR
    PostUsers["usuarios"]
    Posts["publicaciones_p2p"]
    Images["moderacion_imagenes"]
    Suggestions["sugerencias_esfuerzo"]
    Swaps["intercambios"]
    Reviews["resenas"]

    PostUsers -->|"crea"| Posts
    PostUsers -->|"sube"| Images
    Posts -->|"puede tener revision de imagen"| Images
    Posts -->|"recibe"| Suggestions
    PostUsers -->|"propone nivel"| Suggestions
    Posts -->|"es objeto deseado"| Swaps
    PostUsers -->|"participa como dueno u ofertante"| Swaps
    Swaps -->|"puede recibir"| Reviews
    PostUsers -->|"escribe o recibe"| Reviews
```

## 5. Registros de soporte

Estos datos acompañan las funciones principales. Algunos registros se relacionan por identificadores de texto, no por claves foráneas.

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart LR
    SupportUsers["usuarios"]
    Chat["mensajes_chat"]
    Reports["reportes"]
    Contact["mensajes_contacto"]
    Legal["aceptaciones_legales"]
    Otp["verificaciones_otp"]

    SupportUsers -.->|"identificadores de texto"| Chat
    SupportUsers -.->|"identidad del reporte"| Reports
    SupportUsers -.->|"autor opcional"| Contact
    SupportUsers -.->|"aceptaciones de cuenta"| Legal
    Otp -.->|"se valida por telefono"| SupportUsers
```

En `mensajes_chat` y `reportes`, las identidades se guardan como texto y no tienen una clave foránea directa a `usuarios`. `mensajes_contacto` y `aceptaciones_legales` sí permiten guardar registros sin un usuario asociado.
