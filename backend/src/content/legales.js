/**
 * Documentos legales de Switch.
 *
 * Se sirven por GET /api/legal/:documento (público) para que la persona
 * usuaria los lea ANTES de registrarse, y la aceptación queda registrada con
 * versión, fecha e IP en la tabla aceptaciones_legales.
 *
 * IMPORTANTE: los textos se redactaron contrastados contra lo que el sistema
 * hace hoy. Donde la funcionalidad no existe, el texto lo dice. No se afirma
 * ninguna protección que el código no aplique.
 */

const VERSION = '1.0.0';
const VIGENTE_DESDE = '2026-09-30';

const TERMINOS = {
  id: 'terminos',
  titulo: 'Términos y Condiciones de Uso y Funcionamiento de la Plataforma "Switch"',
  version: VERSION,
  vigenteDesde: VIGENTE_DESDE,
  intro:
    'El presente contrato regula los términos y condiciones generales aplicables al uso de los servicios ofrecidos por la plataforma digital Switch (en adelante, "la Plataforma"), comprendiendo su aplicación web progresiva (PWA) y su aplicación móvil nativa. Cualquier persona que desee acceder, navegar o utilizar la Plataforma (en adelante, "Persona Usuaria") podrá hacerlo sujetándose a los presentes Términos y Condiciones Generales, junto con la Política de Privacidad. La aceptación de estos términos es de carácter obligatorio y vinculante.',
  secciones: [
    {
      titulo: 'Cláusula Primera: Aspectos Generales y Aceptación de los Términos',
      cuerpo: [
        'Switch ofrece acceso a la Plataforma a través de su aplicación web progresiva (PWA) y de su aplicación móvil nativa. No se distribuye como aplicación de escritorio.',
        'El uso del servicio implica que la Persona Usuaria ha leído, entendido y aceptado plenamente todas las condiciones establecidas. La aceptación se registra con fecha, hora, dirección IP y versión vigente del documento, y puede solicitarse su constancia.',
      ],
    },
    {
      titulo: 'Cláusula Segunda: Definición del Modelo y Naturaleza Jurídica',
      cuerpo: [
        'Inexistencia de Intermediación Financiera: Switch es una solución tecnológica de innovación social basada en la Red de Reciprocidad Triangulada por Mérito y Cohesión Social (Red RMC).',
        'Inexistencia de Moneda o Créditos: La Plataforma no constituye una entidad bancaria, proveedora de servicios de pago (PSP), billetera virtual, ni mercado bursátil. Bajo ninguna circunstancia se emitirán, almacenarán, transferirán ni comercializará monedas fiduciarias, monedas virtuales, criptoactivos, créditos, vales o puntos acumulables.',
        'Dinámica P2P y Actividades Comunitarias: Switch opera exclusivamente como un canal de visibilización y coordinación directa Persona a Persona (P2P). La posibilidad de solicitar o intercambiar bienes u oficios en el Catálogo General P2P se habilita (Nexo Social) mediante el aporte voluntario previo en instituciones comunitarias acreditadas.',
      ],
    },
    {
      titulo: 'Cláusula Tercera: Requisitos de Capacidad y Registro de Usuarios',
      cuerpo: [
        'Mayoría de Edad: El uso de la Plataforma está reservado única y exclusivamente para personas físicas mayores de 18 años con capacidad legal plena para contratar.',
        'Prohibición Expresa de Menores de Edad: En resguardo de la legislación vigente, queda prohibido el registro o uso de la Plataforma por parte de personas menores de 18 años. Switch se reserva el derecho de solicitar documentación respaldatoria (DNI) y dar de baja cualquier perfil que infrinja esta norma.',
        'Veracidad de la Información: La Persona Usuaria garantiza la autenticidad, exactitud y vigencia de los datos brindados durante el registro (DNI, nombre, teléfono celular y contraseña de acceso). Cada cuenta es personal, única e intransferible.',
        'Verificación del Teléfono Celular: El número de teléfono celular se utiliza exclusivamente para verificar la titularidad de la cuenta mediante un código de un solo uso (OTP), de uso único y con vigencia limitada. No se publica, no se muestra en perfiles ajenos ni en el Catálogo General P2P, y no se comparte con terceros con fines comerciales.',
        'Contraseña: La Persona Usuaria elige su contraseña, que Switch almacena cifrada. Switch no puede conocerla ni recuperarla.',
      ],
    },
    {
      titulo: 'Cláusula Cuarta: Reglas de Publicación, Contenido y Protección Integral de las Infancias',
      cuerpo: [
        'Protección de la Imagen Infantil (Ley N° 26.061): Queda estrictamente prohibida la publicación, carga o difusión de cualquier archivo visual (fotografías, imágenes editadas, ilustraciones, vectores o creaciones generadas por Inteligencia Artificial) que exhiba rostros, cuerpos o figuras de personas menores de edad.',
        'Servicios Destinados a Infancias y Adultos Mayores: Toda oferta de servicios profesionales o de acompañamiento (apoyo escolar, talleres, cuidados) deberá ilustrarse únicamente con recursos pedagógicos, isotipos, cartelería gráfica o la imagen exclusiva del profesional adulto prestador.',
        'Bienes Permitidos y Prohibidos: Solo se podrán ofertar bienes de procedencia lícita. Queda terminantemente prohibido publicar armas, medicamentos, sustancias controladas, fauna, productos vencidos, o cualquier elemento que contravenga las leyes argentinas.',
        'Revisión Obligatoria Previa a la Publicación: Ninguna publicación del Catálogo General P2P se hace visible de inmediato. Al crearse, toda publicación queda en estado "PENDIENTE_REVISION" y permanece invisible para el resto de las Personas Usuarias hasta que una persona del equipo de administración la apruebe expresamente. Las publicaciones que no traen imagen también se revisan, por su título y su descripción.',
        'Filtrado Técnico Automático: Antes de esa revisión, Switch aplica un control automático que verifica el formato real del archivo (por sus propios bytes, no por su nombre ni por la extensión), sus dimensiones, su peso y si es una imagen animada, y elimina los metadatos del archivo antes de guardarlo, incluidos los datos de ubicación (coordenadas GPS) que suelen guardar las cámaras de los celulares y los datos del dispositivo. Las imágenes animadas y los formatos que no permiten ese saneamiento quedan marcados y requieren una revisión más cuidadosa.',
        'Alcance del Control Automático: Switch NO afirma contar con un sistema que detecte automáticamente la presencia de personas menores de edad. No existe una verificación técnica confiable para eso, y presentarla como si la hubiera sería engañoso. El control que protege a las infancias es la revisión humana, obligatoria e individual de cada imagen.',
        'Acceso Restringido a las Imágenes Pendientes: Mientras una imagen espera revisión se guarda en una carpeta de acceso restringido que no se publica en la web. El archivo no puede descargarse ni con el enlace que la aplicación muestra en el celular, ni por quien lo subió. Sólo el equipo de administración con sesión habilitada puede abrirlo, a través de un acceso propio y registrado.',
        'Imágenes Rechazadas: Cuando una publicación se rechaza por incumplir estas normas, el archivo se elimina del servidor. Si la imagen representa a una persona menor de edad, en cambio, el archivo NO se borra: se conserva de forma restringida y se deja constancia de quién lo detectó y cuándo, porque la Ley N° 26.061 obliga a actuar de inmediato y a preservar el material para que las autoridades competentes puedan actuar. En ese caso se suspende la cuenta de la persona que lo publicó.',
        'Moderación y Controles: Además de la revisión previa, cualquier Persona Usuaria puede presentar un reporte de contenidos, que la administración atiende. Ante el incumplimiento de estas normas, Switch elimina la publicación y aplica la sanción que corresponda, que puede incluir la suspensión temporal o la baja definitiva de la cuenta.',
      ],
    },
    {
      titulo: 'Cláusula Quinta: Funcionamiento de las Validaciones (QR, GPS y Cupos)',
      cuerpo: [
        'Validación Antifraude: La activación del Nexo Social requiere la presencia física de la Persona Usuaria en la sede de la institución comunitaria. Esto se verifica mediante el escaneo de un Código QR exclusivo de cada institución.',
        'Verificación Geográfica Opcional: El escaneo del código QR puede complementarse con la verificación de la distancia geográfica respecto de la sede institucional. Esta verificación depende de la configuración de despliegue de la Plataforma y no se aplica en todas las instalaciones.',
        'Control de Cupos Institucionales: Las instituciones comunitarias habilitan metas fijas y temporales de necesidad. Una vez alcanzado el cupo máximo publicado, la opción de recepción queda deshabilitada para evitar saturaciones de espacio o gestión.',
        'Habilitación por Tiempo: El Nexo Social tiene una vigencia determinada por la prioridad del cupo cubierto y por la edad de la colaboración. Vencida esa habilitación, la Persona Usuaria puede seguir navegando y leyendo la Plataforma, pero no puede publicar en el catálogo, proponer, aceptar ni rechazar trueques, ni escribir mensajes de chat.',
      ],
    },
    {
      titulo: 'Cláusula Sexta: Exclusión de Responsabilidad y Garantías',
      cuerpo: [
        'Intercambios Directos P2P: Los bienes y servicios se intercambian de forma libre y directa entre los particulares. Switch no posee, custodia, revisa, empaqueta ni transporta los elementos publicados.',
        'Recepción en el Estado en que se Encuentra: La Persona Usuaria receptora es la única responsable de inspeccionar la higiene, seguridad, conservación y funcionamiento de los artículos en el momento del encuentro presencial.',
        'Deslinde Legal: Switch no será responsable por daños materiales, personales, vicios ocultos, pérdidas o controversias derivadas de las relaciones entabladas entre Personas Usuarias.',
      ],
    },
    {
      titulo: 'Cláusula Séptima: Propiedad Intelectual y Modificaciones',
      cuerpo: [
        'La marca Switch, sus logotipos, código fuente, diseño de interfaces y arquitecturas de software son propiedad exclusiva de su titular.',
        'Switch se reserva el derecho de modificar los presentes Términos y Condiciones. Toda modificación se publicará en la Plataforma indicando su versión y fecha de vigencia. Las modificaciones que afecten derechos sustanciales se comunicarán con antelación suficiente y requerirán aceptación expresa de la Persona Usuaria.',
      ],
    },
  ],
};

const PRIVACIDAD = {
  id: 'privacidad',
  titulo: 'Política de Privacidad y Protección de Datos Personales de "Switch"',
  version: VERSION,
  vigenteDesde: VIGENTE_DESDE,
  intro:
    'La presente Política regula la recolección, almacenamiento, tratamiento y protección de los datos personales de las Personas Usuarias de Switch, de conformidad con la Ley de Protección de Datos Personales N° 25.326, su reforma Ley N° 27.744 y las normas complementarias de la República Argentina.',
  secciones: [
    {
      titulo: 'Sección 1: Cumplimiento Normativo y Responsable del Tratamiento',
      cuerpo: [
        'Esta Política da cumplimiento a la Ley N° 25.326 de Protección de Datos Personales y a la Ley N° 27.744 que la reforma. El órgano de control de la materia es la Agencia de Acceso a la Información Pública (AAIP), Av. Presidente Julio A. Roca 710, Ciudad Autónoma de Buenos Aires.',
      ],
    },
    {
      titulo: 'Sección 2: Datos Recolectados y su Finalidad Específica',
      cuerpo: [
        'Datos de Identificación (DNI, nombre, apellido): Se usan para autenticar a la Persona Usuaria, validar la mayoría de edad declarada y evitar cuentas duplicadas. El DNI no se muestra en el catálogo público.',
        'Teléfono celular: Se usa exclusivamente para verificar la titularidad de la cuenta mediante un código de un solo uso (OTP), de uso único y con vigencia limitada. NO se publica, NO se expone en perfiles ajenos ni en el Catálogo General P2P, y no se cede a terceros con fines comerciales. La Persona Usuaria puede consultar el suyo únicamente desde su propio perfil.',
        'Contraseña de acceso: Se almacena cifrada con algoritmo bcrypt. No es posible conocerla ni recuperarla desde el sistema.',
        'Contenido generado por la Persona Usuaria: Las publicaciones del catálogo, los mensajes de chat, las propuestas de trueque, las reseñas y los reportes se almacenan para hacer funcionar el servicio.',
        'Datos de Geolocalización: Se procesan de forma puntual, solo en el momento del escaneo del código QR institucional, para validar la presencia física. No se realiza seguimiento de ubicación en segundo plano ni rastreo continuo.',
        'Imágenes y su tratamiento previo: Las fotografías que la Persona Usuaria adjunta para ilustrar sus publicaciones se someten a un control técnico automático (verificación del formato real del archivo, sus dimensiones, su peso y si es una imagen animada) y a la eliminación de sus metadatos, que pueden incluir las coordenadas GPS de dónde se tomó la foto y datos del dispositivo.',
        'Imágenes pendientes de revisión: Toda publicación nace sin ser visible y su imagen queda guardada en una carpeta de acceso restringido, que no responde a pedidos de descarga de ninguna persona (tampoco de quien la subió). Sólo el equipo de administración puede abrirla, con sesión habilitada, y esa apertura queda registrada. Es una medida para que ninguna imagen llegue a ser pública sin haber sido revisada, en particular cuando se sospecha la presencia de una persona menor de edad.',
        'Destino final de las imágenes: Una imagen aprobada queda accesible en el catálogo. Una imagen rechazada se elimina del servidor. Una imagen en la que se detectó la representación de una persona menor de edad se conserva de forma restringida, con registro de quién la revisó y cuándo, para poder remitirla a la autoridad competente en materia de protección de las infancias, y se suspende la cuenta de quien la publicó.',
      ],
    },
    {
      titulo: 'Sección 3: Privacidad y Protección Territorial',
      cuerpo: [
        'Ubicación no Expuesta: El Catálogo General P2P muestra un listado unificado sin divulgar públicamente la dirección exacta, piso o domicilio particular de las Personas Usuarias.',
        'Teléfono no Expuesto: El número de teléfono de las Personas Usuarias no se expone en ningún endpoint público de la Plataforma, ni en perfiles de terceros. La coordinación se realiza mediante el chat interno de la aplicación.',
        'Canal de Chat: Las coordinaciones presenciales se realizan mediante la mensajería interna de la app. Los mensajes se transmiten cifrados en tránsito y se almacenan en la base de datos.',
      ],
    },
    {
      titulo: 'Sección 4: Seguridad de la Información',
      cuerpo: [
        'Switch aplica medidas de seguridad técnicas y organizativas para evitar la alteración, pérdida, acceso no autorizado o tratamiento ilícito de la información:',
        'Las contraseñas se almacenan cifradas con bcrypt y nunca en texto legible.',
        'El acceso a las bases de datos está restringido a personal autorizado y las consultas se parametrizan para evitar inyección de código.',
        'El tráfico entre la aplicación y el servidor debe realizarse bajo HTTPS con TLS. En instalaciones de desarrollo o pruebas puede configurarse HTTP sin cifrado.',
        'Las sesiones se verifican contra el estado de la cuenta en cada operación, de modo que una suspensión o una baja se aplican de inmediato.',
      ],
    },
    {
      titulo: 'Sección 5: Derechos de los Titulares de los Datos',
      cuerpo: [
        'Acceso: La Persona Usuaria puede consultar libremente los datos de su propia cuenta desde su perfil.',
        'Rectificación y Actualización: Puede solicitar la corrección de sus datos escribiendo a los canales de atención de Switch.',
        'Supresión: Puede solicitar la eliminación de sus datos. La baja de una cuenta es una baja lógica: la cuenta deja de ser accesible y sus publicaciones se retiran del catálogo. La eliminación definitiva de los registros asociados requiere una solicitud expresa y se ejecuta dentro de los plazos legales aplicables.',
        'Los derechos de acceso se ejercen de forma gratuita. Los canales de atención se publicarán en la Plataforma.',
        'El órgano de control de la Ley N° 25.326 es la Agencia de Acceso a la Información Pública (AAIP), ubicada en Av. Presidente Julio A. Roca 710, Ciudad Autónoma de Buenos Aires.',
      ],
    },
    {
      titulo: 'Sección 6: Cesiones y Transferencias',
      cuerpo: [
        'Switch no cede ni transfiere datos personales de las Personas Usuarias a terceros con fines comerciales.',
        'Proveedor de envío de mensajes: para entregar el código de un solo uso, Switch utiliza un proveedor de mensajería (SMS o mensajería instantánea) que actúa como encargado del tratamiento, no como destinatario final. Ese proveedor recibe únicamente el número de teléfono y el texto del mensaje, y lo hace para cumplir la función técnica de enviar ese mensaje. Switch es responsable de instruirlo por escrito y de verificar que trata los datos conforme a la Ley 25.326.',
      ],
    },
  ],
};

const DOCUMENTOS = { terminos: TERMINOS, privacidad: PRIVACIDAD };

/**
 * Huella SHA-256 del contenido servido. Se guarda junto a la aceptación
 * para poder demostrar más adelante que el texto vigente en el momento
 * del registro era exactamente este, aunque después se modifique.
 */
function hashDocumento(id) {
  const doc = DOCUMENTOS[id];
  if (!doc) return null;
  const crypto = require('crypto');
  const contenido = JSON.stringify({
    id: doc.id,
    titulo: doc.titulo,
    version: doc.version,
    vigenteDesde: doc.vigenteDesde,
    intro: doc.intro,
    secciones: doc.secciones,
  });
  return crypto.createHash('sha256').update(contenido, 'utf8').digest('hex');
}

module.exports = {
  VERSION,
  VIGENTE_DESDE,
  DOCUMENTOS,
  hashDocumento,
  listar: () =>
    Object.values(DOCUMENTOS).map((d) => ({
      id: d.id,
      titulo: d.titulo,
      version: d.version,
      vigenteDesde: d.vigenteDesde,
      hash: hashDocumento(d.id),
    })),
  obtener: (id) => {
    const doc = DOCUMENTOS[id];
    if (!doc) return null;
    return { ...doc, hash: hashDocumento(id) };
  },
};
