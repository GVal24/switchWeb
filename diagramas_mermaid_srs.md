# Diagramas del sistema Switch

Estos diagramas complementan la descripción y las tecnologías del [README](README.md): muestran el flujo de moderación de imágenes y las relaciones entre los datos.

## 1. Qué ocurre cuando se sube una foto

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    PhotoUser["Usuario sube una foto"]
    Upload["API recibe y valida el archivo"]
    Sanitize["Se limpia la imagen y sus metadatos"]
    SaveImage[("Se guarda la imagen")]
    Queue["Pendiente de moderación"]
    Review["Revisión de administración"]
    Approved["Aprobada: publicación activa"]
    Rejected["Rechazada: no se muestra"]
    Catalog["Catálogo consulta publicaciones activas"]
    PublicImage["API entrega los bytes de la imagen"]
    BrowserPhoto["La foto aparece en el navegador"]

    PhotoUser -->|"sube"| Upload
    Upload -->|"procesa"| Sanitize
    Sanitize -->|"guarda"| SaveImage
    SaveImage -->|"espera revisión"| Queue
    Queue -->|"aparece en el panel"| Review
    Review -->|"si se aprueba"| Approved
    Review -->|"si se rechaza"| Rejected
    Approved -->|"se incluye en"| Catalog
    Approved -->|"habilita el acceso"| PublicImage
    Catalog -->|"solicita la imagen"| PublicImage
    SaveImage -->|"lee los bytes aprobados"| PublicImage
    PublicImage -->|"responde"| BrowserPhoto
```

## 2. Datos de comunidad y voluntariado

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

## 3. Publicaciones e intercambios

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
    Posts -->|"se revisa en"| Images
    Posts -->|"recibe"| Suggestions
    PostUsers -->|"propone nivel"| Suggestions
    Posts -->|"es objeto deseado"| Swaps
    PostUsers -->|"participa como dueño u ofertante"| Swaps
    Swaps -->|"puede recibir"| Reviews
    PostUsers -->|"escribe o recibe"| Reviews
```

## 4. Registros de soporte

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
    Otp -.->|"se valida por teléfono"| SupportUsers
```

Las líneas punteadas indican relaciones indirectas o asociaciones opcionales.
