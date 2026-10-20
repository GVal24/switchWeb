-- ============================================================
-- PROYECTO SWITCH: DATOS DE PRUEBA E INICIALIZACIÓN (seed.sql)
-- Requiere haber ejecutado schema.sql sobre una base vacía.
--
-- CUIDADO: este archivo empieza con TRUNCATE. Borra lo que haya en la base,
-- así que no lo corras sobre una base con datos que quieras conservar.
--
-- Contraseñas de prueba:
--   - Usuarios VECINO/DELEGADO => clave123
--   - Usuario ADMIN            => Switch2024!
-- ============================================================

TRUNCATE TABLE
  sugerencias_esfuerzo,
  resenas,
  intercambios,
  reportes,
  mensajes_chat,
  moderacion_imagenes,
  mensajes_contacto,
  verificaciones_otp,
  publicaciones_p2p,
  nexos_sociales,
  cupos_necesidad,
  instituciones,
  usuarios
RESTART IDENTITY CASCADE;

-- 1. Usuarios (passwords hasheadas con bcrypt)
INSERT INTO usuarios (id, dni, nombre, apellido, telefono, password, validado_mayor_edad, rol, activo) VALUES
  (1, '38450912', 'Guillermina', 'Valdez',    '2281459821', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO',   TRUE),
  (2, '35123456', 'Carlos',      'Rodríguez', '2281506070', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO',   TRUE),
  (3, '28999888', 'María',       'Gómez',     '2281667788', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'DELEGADO', TRUE),
  (4, '11111111', 'Admin',       'Switch',    '2281000001', '$2b$10$48vPvsxai5PjqkrqvtNAp.zKqMIUUPfVjiWl2pRe.wArYoZOA5Ew.', TRUE, 'ADMIN',    TRUE);

-- 2. Instituciones comunitarias
INSERT INTO instituciones (id, nombre, tipo, direccion, latitud, longitud, qr_codigo_hash) VALUES
  (1, 'Comedor Infantil El Sol',                   'COMEDOR',    'Calle Rivas 123', -36.778100, -59.858400, 'QR_HASH_COMEDOR_ELSOL_2026'),
  (2, 'Hogar San José para Personas Mayores',      'HOGAR',      'Av. Mitre 840',   -36.782500, -59.861200, 'QR_HASH_HOGAR_SANJOSE_2026'),
  (3, 'Biblioteca Popular Bartolomé J. Ronco',     'BIBLIOTECA', 'Burgos 687',      -36.779500, -59.858200, 'QR_HASH_BIBLIO_RONCO_2026');

-- 3. Cupos de necesidad
INSERT INTO cupos_necesidad (id, institucion_id, titulo, descripcion, prioridad, cupo_maximo, cupo_actual, activo) VALUES
  (1, 1, 'Donación de Leche en Polvo',        'Se necesitan paquetes de leche para la merienda comunitaria.', 'PRIORITARIA', 20, 14, TRUE),
  (2, 1, 'Apoyo en Cocina (Tarde)',           'Ayuda voluntaria de 2 horas para fraccionar viandas.',         'URGENTE',     3,  3, FALSE),
  (3, 2, 'Elementos de Higiene Personal',     'Jabones de tocador, lavandina y toallas de mano.',             'GENERAL',     15, 6, TRUE),
  (4, 3, 'Taller de Lectura para Niños',      'Acompañamiento literario sábados de 10 a 12 hs.',              'GENERAL',      5, 2, TRUE);

-- 4. Nexo Social activo para Guillermina (habilita a publicar)
INSERT INTO nexos_sociales (usuario_id, cupo_necesidad_id, institucion_id, metodo_validacion, latitud_usuario, longitud_usuario, nivel_impacto, estado, fecha_activacion, fecha_expiracion) VALUES
  (1, 1, 1, 'QR_GPS', -36.778120, -59.858410, 'MEDIO', 'ACTIVO', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '85 days');

-- 5. Publicaciones del catálogo P2P (estado 'Activo')
INSERT INTO publicaciones_p2p (id, usuario_id, titulo, descripcion, nivel_esfuerzo, tipo_item, imagen_url, estado, creado_en) VALUES
  (1, 1, 'Cochecito de Bebé Plegable',            'En muy buen estado de conservación. Ideal para bebés de hasta 2 años.', 'SIMPLE', 'OBJETO',   NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (2, 2, 'Clases de Apoyo Escolar en Matemática', 'Ofrezco 2 horas semanales para nivel primario.',                'ALTO',   'SERVICIO', NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  (3, 3, 'Bicicleta Rodado 26',                   'Lista para usar. Le hice mantenimiento completo de cadena y frenos.',   'MEDIO',  'OBJETO',   NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '6 days'),
  (4, 2, 'Reparación de PC / Laptop',             'Formateo, limpieza y optimización a domicilio.',         'ALTO',   'SERVICIO', NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '9 days'),
  (5, 1, 'Libros Infantiles (lote x10)',          'Cuentos para primeras lecturas, en muy buen estado.',                   'SIMPLE', 'OBJETO',   NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '12 days');

-- 6. Mensajes de chat de prueba (entre Carlos "2" y Guillermina "1")
INSERT INTO mensajes_chat (emisor_id, receptor_id, texto, leido, creado_en) VALUES
  ('2', '1', '¡Hola Guillermina! Me interesa el cochecito. ¿Sigue disponible?',              TRUE,  CURRENT_TIMESTAMP - INTERVAL '3 hours'),
  ('1', '2', '¡Hola Carlos! Sí, está impecable. ¿Cuándo lo querés venir a ver?',            TRUE,  CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('2', '1', '¿Te sirve el sábado por la mañana? Puedo llevar las clases de apoyo como cambio.', FALSE, CURRENT_TIMESTAMP - INTERVAL '1 hour');

-- 7. Reportes / denuncias pendientes para el panel de administración
INSERT INTO reportes (reportante_id, reportante_nombre, reportado_id, reportado_nombre, motivo, estado, creado_en) VALUES
  ('1', 'Guillermina Valdez', '3', 'María Gómez', 'El producto entregado no coincide con las fotos publicadas.', 'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('2', 'Carlos Rodríguez',   '3', 'María Gómez', 'Lenguaje inapropiado en el chat de negociación.',             'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '2 days');

-- 8. Intercambios históricos (alimentan métricas, gráficos y reputación)
-- Distribución: Mar=1, Abr=2, May=2, Jun=2, Jul=2, Ago=3  (Total: 12)
-- Los más antiguos quedan COMPLETADOS con confirmaciones mutuas; los recientes quedan jugables.
INSERT INTO intercambios (publicacion_deseada_id, titulo_deseado, dueno_id, ofertante_id, ofertante_nombre, items_ofrecidos, estado, confirmacion_dueno, confirmacion_ofertante, creado_en) VALUES
  (1, 'Cochecito de Bebé Plegable',            1, 2, 'Carlos Rodríguez', '[{"id": "2", "titulo": "Clases de Apoyo Escolar"}]'::jsonb,  'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '5 months' + INTERVAL '3 days'),
  (2, 'Clases de Apoyo Escolar en Matemática', 2, 3, 'María Gómez',      '[{"id": "5", "titulo": "Libros Infantiles"}]'::jsonb,        'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '4 months' + INTERVAL '2 days'),
  (3, 'Bicicleta Rodado 26',                   3, 1, 'Guillermina Valdez', '[{"id": "1", "titulo": "Cochecito de Bebé"}]'::jsonb,      'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '4 months' + INTERVAL '20 days'),
  (4, 'Reparación de PC / Laptop',             2, 3, 'María Gómez',      '[{"id": "3", "titulo": "Bicicleta Rodado 26"}]'::jsonb,      'RECHAZADA', FALSE, FALSE, DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '3 months' + INTERVAL '6 days'),
  (5, 'Libros Infantiles (lote x10)',          1, 2, 'Carlos Rodríguez', '[{"id": "2", "titulo": "Clases de Apoyo Escolar"}]'::jsonb,  'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '3 months' + INTERVAL '18 days'),
  (2, 'Clases de Apoyo Escolar en Matemática', 2, 1, 'Guillermina Valdez', '[{"id": "5", "titulo": "Libros Infantiles"}]'::jsonb,      'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '2 months' + INTERVAL '9 days'),
  (3, 'Bicicleta Rodado 26',                   3, 2, 'Carlos Rodríguez', '[{"id": "4", "titulo": "Reparación de PC"}]'::jsonb,         'PENDIENTE', FALSE, FALSE, DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '2 months' + INTERVAL '21 days'),
  (1, 'Cochecito de Bebé Plegable',            1, 3, 'María Gómez',      '[{"id": "3", "titulo": "Bicicleta Rodado 26"}]'::jsonb,      'ACEPTADA', FALSE, FALSE, DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '1 month' + INTERVAL '4 days'),
  (4, 'Reparación de PC / Laptop',             2, 1, 'Guillermina Valdez', '[{"id": "1", "titulo": "Cochecito de Bebé"}]'::jsonb,      'ACEPTADA', FALSE, FALSE, DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '1 month' + INTERVAL '16 days'),
  (5, 'Libros Infantiles (lote x10)',          1, 3, 'María Gómez',      '[{"id": "2", "titulo": "Clases de Apoyo Escolar"}]'::jsonb,  'ACEPTADA', FALSE, FALSE, CURRENT_TIMESTAMP - INTERVAL '5 days'),
  (3, 'Bicicleta Rodado 26',                   3, 1, 'Guillermina Valdez', '[{"id": "5", "titulo": "Libros Infantiles"}]'::jsonb,      'PENDIENTE', FALSE, FALSE, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (2, 'Clases de Apoyo Escolar en Matemática', 2, 3, 'María Gómez',      '[{"id": "4", "titulo": "Reparación de PC"}]'::jsonb,         'ACEPTADA', FALSE, FALSE, CURRENT_TIMESTAMP - INTERVAL '1 day');

-- 9. Reseñas de los trueques completados (reputación)
INSERT INTO resenas (intercambio_id, autor_id, destino_id, puntaje, comentario) VALUES
  (1, 1, 2, 5, 'Carlos entregó las clases pactadas. Súper recomendable.'),
  (1, 2, 1, 5, 'El cochecito estaba impecable, tal cual la descripción.'),
  (2, 2, 3, 4, 'Buena disposición, aunque llegamos a reprogramar una clase.'),
  (2, 3, 2, 5, 'Excelente profe, mi hijo quedó encantado.'),
  (3, 3, 1, 5, 'Guillermina cuidó la bici como si fuera propia.'),
  (3, 1, 3, 4, 'Todo bien, coordinamos rápido por el chat.'),
  (5, 1, 2, 5, 'Gran persona, además dejó material extra de apoyo.'),
  (5, 2, 1, 4, 'Los libros estaban muy cuidados.'),
  (6, 2, 1, 5, 'Puntual y amable, un gusto truequear así.');

-- 10. Reajustar las secuencias tras los inserts base con ID explícito ANTES
--     de cargar los datos adicionales (que usan IDs automáticos).
SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));
SELECT setval('instituciones_id_seq', (SELECT MAX(id) FROM instituciones));
SELECT setval('cupos_necesidad_id_seq', (SELECT MAX(id) FROM cupos_necesidad));
SELECT setval('nexos_sociales_id_seq', (SELECT MAX(id) FROM nexos_sociales));
SELECT setval('publicaciones_p2p_id_seq', (SELECT MAX(id) FROM publicaciones_p2p));
SELECT setval('mensajes_chat_id_seq', (SELECT MAX(id) FROM mensajes_chat));
SELECT setval('reportes_id_seq', (SELECT MAX(id) FROM reportes));
SELECT setval('intercambios_id_seq', (SELECT MAX(id) FROM intercambios));
SELECT setval('resenas_id_seq', (SELECT MAX(id) FROM resenas));

-- ============================================================
-- DATOS FICTICIOS ADICIONALES PARA ENRIQUECER EL PANEL DE ADMIN
-- (usuarios, nexos, publicaciones, trueques, reportes y
--  sugerencias de esfuerzo extra para las capturas)
-- ============================================================

-- 11. Usuarios adicionales (sube el KPI "Usuarios")
--     Password: clave123 (misma hash bcrypt que el seed)
INSERT INTO usuarios (dni, nombre, apellido, telefono, password, validado_mayor_edad, rol, activo) VALUES
  ('31222444', 'Laura',      'Fernández', '2281334455', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO',   TRUE),
  ('27333455', 'Diego',      'Martínez',  '2281778899', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO',   TRUE),
  ('29888777', 'Sofía',      'López',     '2281554433', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'DELEGADO', TRUE),
  ('33555666', 'Martín',     'Pérez',     '2281221100', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO',   TRUE),
  ('34119988', 'Valentina',  'Sosa',      '2281998877', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO',   TRUE),
  ('30888999', 'Joaquín',    'Romero',    '2281445566', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO',   TRUE),
  ('35555667', 'Camila',     'Díaz',      '2281665544', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO',   TRUE),
  ('31888999', 'Nicolás',    'Álvarez',   '2281789900', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'DELEGADO', TRUE),
  -- Estas tres son para probar la pantalla de cuentas bloqueadas, que
  -- muestra los tres casos por separado: penalizada, vencida y bloqueada.
  -- Sólo la última no puede entrar; las otras dos sí, en modo lectura.
  -- Sus DNIs empiezan con 80, la marca que usan los scripts de prueba para
  -- no confundirse con la demo.
  ('80990011', 'Lucía',      'Penalizada', '2281800111', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO', TRUE),
  ('80990022', 'Pedro',      'Bloqueado',  '2281800222', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO', FALSE),
  ('80990033', 'Ana',        'Vencida',    '2281800333', '$2b$10$X8zsNck2lcV7hSnWMkcYSuGHxl.uHQdkgU1etRjRgQc/QJ8zvH5r.', TRUE, 'VECINO', TRUE);

-- 11b. Una penalización vigente y una ya vencida
--       suspendido_hasta es una fecha: si ya pasó, la cuenta se levanta sola
--       cuando esa persona entra. Ver authService.js. La cuenta bloqueada
--       (activo = FALSE) no tiene fecha: esa la levanta un humano.
UPDATE usuarios
SET suspendido_hasta = CURRENT_TIMESTAMP + INTERVAL '5 days',
    motivo_suspension = 'Posible imagen de menor en una publicación'
WHERE dni = '80990011';

UPDATE usuarios
SET suspendido_hasta = CURRENT_TIMESTAMP - INTERVAL '1 day',
    motivo_suspension = 'Penalización vencida: se levanta al entrar'
WHERE dni = '80990033';

-- 12. Nexos Sociales adicionales (sube "Asistencias QR")
INSERT INTO nexos_sociales (usuario_id, cupo_necesidad_id, institucion_id, metodo_validacion, latitud_usuario, longitud_usuario, nivel_impacto, estado, fecha_activacion, fecha_expiracion) VALUES
  (5,  2, 1, 'QR_GPS',             -36.778130, -59.858420, 'ALTO',   'ACTIVO',   CURRENT_TIMESTAMP - INTERVAL '30 days',  CURRENT_TIMESTAMP + INTERVAL '60 days'),
  (6,  3, 2, 'APROBACION_DELEGADO', -36.782510, -59.861210, 'MEDIO',  'ACTIVO',   CURRENT_TIMESTAMP - INTERVAL '20 days',  CURRENT_TIMESTAMP + INTERVAL '70 days'),
  (7,  4, 3, 'QR_GPS',             -36.779510, -59.858210, 'SIMPLE', 'ACTIVO',   CURRENT_TIMESTAMP - INTERVAL '10 days',  CURRENT_TIMESTAMP + INTERVAL '80 days'),
  (8,  1, 1, 'QR_GPS',             -36.778140, -59.858430, 'MEDIO',  'ACTIVO',   CURRENT_TIMESTAMP - INTERVAL '25 days',  CURRENT_TIMESTAMP + INTERVAL '65 days'),
  (9,  3, 2, 'APROBACION_DELEGADO', -36.782520, -59.861220, 'ALTO',   'ACTIVO',   CURRENT_TIMESTAMP - INTERVAL '15 days',  CURRENT_TIMESTAMP + INTERVAL '75 days'),
  (10, 4, 3, 'QR_GPS',             -36.779520, -59.858220, 'MEDIO',  'ACTIVO',   CURRENT_TIMESTAMP - INTERVAL '8 days',   CURRENT_TIMESTAMP + INTERVAL '82 days'),
  (11, 2, 1, 'APROBACION_DELEGADO', -36.778150, -59.858440, 'SIMPLE', 'ACTIVO',   CURRENT_TIMESTAMP - INTERVAL '12 days',  CURRENT_TIMESTAMP + INTERVAL '78 days'),
  (12, 1, 1, 'QR_GPS',             -36.778160, -59.858450, 'MEDIO',  'ACTIVO',   CURRENT_TIMESTAMP - INTERVAL '6 days',   CURRENT_TIMESTAMP + INTERVAL '84 days');

-- 13. Publicaciones P2P adicionales
INSERT INTO publicaciones_p2p (usuario_id, titulo, descripcion, nivel_esfuerzo, tipo_item, imagen_url, estado, creado_en) VALUES
  (5,  'Horno a Convección',                 'Funciona perfecto, 6 meses de uso con factura.',              'MEDIO',  'OBJETO',   NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (6,  'Ayuda con Mudanza (Mercado a Domicilio)', '2 personas disponibles este fin de semana.',           'ALTO',   'SERVICIO', NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  (7,  'Colección de Revistas de Ciencia',    'Revistas para fanáticos de la ciencia, lote x15.',           'SIMPLE', 'OBJETO',   NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '5 days'),
  (8,  'Clases de Inglés Básico',             'Nivel principiante, 10 clases presenciales por semana.',     'ALTO',   'SERVICIO', NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '8 days'),
  (9,  'Set de Herramientas Manuales',        'Martillo, destornilladores y llaves en estuche.',             'SIMPLE', 'OBJETO',   NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '11 days'),
  (10, 'Soporte Técnico a Domicilio',         'Instalo routers, armo redes y resuelvo problemas de PC.',     'ALTO',   'SERVICIO', NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '14 days'),
  (11, 'Juegos de Mesa para Niños',           'Lote de 6 juegos de mesa en excelente estado.',               'SIMPLE', 'OBJETO',   NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (12, 'Microondas',                          'Funciona bien, solo se le borró un botón de la perilla.',     'MEDIO',  'OBJETO',   NULL, 'Activo', CURRENT_TIMESTAMP - INTERVAL '2 days');

-- 14. Pedidos de ayuda adicionales (cupos) para que las instituciones tengan
--     varias necesidades activas y se pruebe la elección por QR.
INSERT INTO cupos_necesidad (institucion_id, titulo, descripcion, prioridad, cupo_maximo, cupo_actual, activo) VALUES
  (1, 'Frutas y Verduras para la Merienda',   'Necesitamos frutas de estación para complementar la merienda de los niños.', 'GENERAL', 25, 6, TRUE),
  (1, 'Acompañamiento en Taller de Cocina',   'Voluntarios para cocinar viandas los jueves de 9 a 12 hs.',              'PRIORITARIA', 4, 1, TRUE),
  (2, 'Acompañamiento a Personas Mayores',    'Charlas y compañía para los residentes del hogar, 2 horas a la semana.',  'GENERAL', 8, 2, TRUE),
  (2, 'Donación de Ropa de Abrigo',           'Camperas, mantas y calzado en buen estado para el invierno.',             'URGENTE', 30, 12, TRUE),
  (3, 'Ordenación y Clasificación de Libros', 'Ayuda para inventariar y ordenar la biblioteca los sábados.',              'GENERAL', 3, 0, TRUE),
  (3, 'Taller de Informática Básica',         'Dictar clases de computación para adultos mayores.',                       'PRIORITARIA', 5, 2, TRUE),
  (1, 'Limpieza y Desmalezado del Patio',     'Tareas de limpieza del patio comunitario y mantenimiento general.',        'GENERAL', 6, 0, TRUE);

-- 15. Intercambios adicionales (llena el gráfico mensual y sube "Trueques del mes")
INSERT INTO intercambios (publicacion_deseada_id, titulo_deseado, dueno_id, ofertante_id, ofertante_nombre, items_ofrecidos, estado, confirmacion_dueno, confirmacion_ofertante, creado_en) VALUES
  (5, 'Libros Infantiles (lote x10)',          5, 6, 'Diego Martínez',   '[{"id": "6", "titulo": "Ayuda con Mudanza"}]'::jsonb,     'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '5 months' + INTERVAL '10 days'),
  (1, 'Cochecito de Bebé Plegable',            7, 8, 'Joaquín Romero',   '[{"id": "8", "titulo": "Clases de Inglés"}]'::jsonb,       'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '5 months' + INTERVAL '22 days'),
  (6, 'Horno a Convección',                    6, 9, 'Camila Díaz',      '[{"id": "9", "titulo": "Herramientas"}]'::jsonb,           'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '4 months' + INTERVAL '12 days'),
  (10,'Soporte Técnico a Domicilio',           10, 5, 'Laura Fernández', '[{"id": "5", "titulo": "Libros Infantiles"}]'::jsonb,      'ACEPTADA',   FALSE, FALSE, DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '4 months' + INTERVAL '25 days'),
  (8, 'Clases de Inglés Básico',               8, 11, 'Nicolás Álvarez', '[{"id": "11", "titulo": "Juegos de Mesa"}]'::jsonb,         'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '3 months' + INTERVAL '8 days'),
  (3, 'Bicicleta Rodado 26',                   3, 9, 'Camila Díaz',      '[{"id": "9", "titulo": "Herramientas"}]'::jsonb,           'RECHAZADA',  FALSE, FALSE, DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '3 months' + INTERVAL '19 days'),
  (7, 'Colección de Revistas de Ciencia',      7, 12, 'Camila Díaz',     '[{"id": "12", "titulo": "Microondas"}]'::jsonb,            'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '2 months' + INTERVAL '14 days'),
  (2, 'Clases de Apoyo Escolar',               2, 6, 'Diego Martínez',   '[{"id": "6", "titulo": "Ayuda con Mudanza"}]'::jsonb,      'ACEPTADA',   FALSE, FALSE, DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '2 months' + INTERVAL '26 days'),
  (9, 'Set de Herramientas Manuales',          9, 5, 'Laura Fernández', '[{"id": "5", "titulo": "Libros Infantiles"}]'::jsonb,      'COMPLETADO', TRUE, TRUE,  DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '1 month' + INTERVAL '6 days'),
  (4, 'Reparación de PC / Laptop',             2, 10, 'Valentina Sosa',  '[{"id": "10", "titulo": "Soporte Técnico"}]'::jsonb,       'PENDIENTE',  FALSE, FALSE, DATE_TRUNC('month', CURRENT_TIMESTAMP) - INTERVAL '1 month' + INTERVAL '18 days'),
  (11,'Juegos de Mesa para Niños',             11, 7, 'Sofía López',     '[{"id": "7", "titulo": "Revistas de Ciencia"}]'::jsonb,    'ACEPTADA',   FALSE, FALSE, CURRENT_TIMESTAMP - INTERVAL '12 days'),
  (1, 'Cochecito de Bebé Plegable',            1, 8, 'Joaquín Romero',   '[{"id": "8", "titulo": "Clases de Inglés"}]'::jsonb,       'PENDIENTE',  FALSE, FALSE, CURRENT_TIMESTAMP - INTERVAL '9 days'),
  (8, 'Clases de Inglés Básico',               8, 6, 'Diego Martínez',   '[{"id": "6", "titulo": "Mudanza"}]'::jsonb,                 'COMPLETADO', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '6 days'),
  (6, 'Horno a Convección',                    6, 3, 'María Gómez',      '[{"id": "3", "titulo": "Bicicleta"}]'::jsonb,              'ACEPTADA',   FALSE, FALSE, CURRENT_TIMESTAMP - INTERVAL '4 days'),
  (7, 'Revistas de Ciencia',                   7, 1, 'Guillermina Valdez', '[{"id": "1", "titulo": "Cochecito"}]'::jsonb,              'PENDIENTE',  FALSE, FALSE, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (10,'Soporte Técnico a Domicilio',           10, 2, 'Carlos Rodríguez','[{"id": "2", "titulo": "Clases de Apoyo"}]'::jsonb,        'ACEPTADA',   FALSE, FALSE, CURRENT_TIMESTAMP - INTERVAL '1 day');

-- 16. Reportes adicionales (variedad de estados para el panel)
INSERT INTO reportes (reportante_id, reportante_nombre, reportado_id, reportado_nombre, motivo, estado, creado_en) VALUES
  ('5',  'Laura Fernández',   '6',  'Diego Martínez',  'Acordamos un trueque y nunca respondió los mensajes después del visto bueno.', 'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
  ('6',  'Diego Martínez',   NULL, '',                 'Inconveniente general de la plataforma al subir una imagen de la publicación.', 'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
  ('8',  'Joaquín Romero',   '9',  'Camila Díaz',      'Señala que la herramienta entregada estaba incompleta respecto a lo ofrecido.', 'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('11', 'Nicolás Álvarez',  '1',  'Guillermina Valdez', 'Descartado: fue un malentendido entre ambas partes, ya se resolvió.', 'DESESTIMADO', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  ('2',  'Carlos Rodríguez', '10', 'Valentina Sosa',   'Reporte cerrado: la suspensión de 7 días ya se cumplió y la cuenta quedó habilitada.', 'RESUELTO_SUSPENSION', CURRENT_TIMESTAMP - INTERVAL '6 days'),
  ('12', 'Nicolás Álvarez',  '9',  'Camila Díaz',      'Doble reporte: conducta repetida de no entregar lo pactado.', 'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '2 hours');

-- 17. Sugerencias de esfuerzo pendientes (sección 3 del panel)
INSERT INTO sugerencias_esfuerzo (publicacion_id, usuario_id, nivel_sugerido, estado, creado_en) VALUES
  (5, 2, 'MEDIO', 'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (1, 3, 'ALTO',  'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  (3, 1, 'SIMPLE','PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
  (4, 5, 'MEDIO', 'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
  (2, 7, 'MEDIO', 'PENDIENTE', CURRENT_TIMESTAMP - INTERVAL '1 hour');

-- ============================================================
-- DATOS PARA PROBAR LA MODERACIÓN DE IMÁGENES Y EL BUZÓN
-- (si el seed no trae esto, esas dos pantallas arrancan vacías)
-- ============================================================

-- 19. Una publicación esperando revisión humana
--     'PENDIENTE_REVISION' es el estado que usa el backend: la publicación no
--     aparece en el catálogo público hasta que una persona la apruebe.
INSERT INTO publicaciones_p2p (usuario_id, titulo, descripcion, nivel_esfuerzo, tipo_item, imagen_url, estado, creado_en) VALUES
  (13, 'Mesa Plegable de Madera', 'Publicada con foto, quedó esperando que alguien la mire.', 'SIMPLE', 'OBJETO', 'uploads/demo/mesa-plegable.jpg', 'PENDIENTE_REVISION', CURRENT_TIMESTAMP - INTERVAL '3 hours');

-- 20. La imagen que se está revisando
--     filtro_estado va en PENDIENTE y decision en NULL: eso es exactamente lo
--     que la cola de moderación muestra. La segunda fila ya está resuelta, para
--     que se vea también el histórico.
INSERT INTO moderacion_imagenes (publicacion_id, usuario_id, nombre_archivo, mime_detectado, peso_bytes, filtro_estado, filtro_puntaje, filtro_motivos, revisado_por, revisado_en, decision, motivo_rechazo, contiene_menor, creado_en) VALUES
  ((SELECT MAX(id) FROM publicaciones_p2p), 13, 'mesa-plegable.jpg', 'image/jpeg', 284120, 'PENDIENTE', 12, '["persona en primer plano"]'::jsonb, NULL, NULL, NULL, NULL, FALSE, CURRENT_TIMESTAMP - INTERVAL '3 hours'),
  ((SELECT MAX(id) - 1 FROM publicaciones_p2p), 5, 'cochecito-2.jpg', 'image/jpeg', 402118, 'RECHAZADA_TECNICAMENTE', 74, '["formato no esperado","resolucion baja"]'::jsonb, 4, CURRENT_TIMESTAMP - INTERVAL '2 days', 'RECHAZADA', 'La imagen no se distingue de una foto de una persona menor.', TRUE, CURRENT_TIMESTAMP - INTERVAL '3 days');

-- 21. Buzón de contacto: dos sin responder y uno ya contestado
--     Los que tienen usuario_id NULL son los que escribió alguien sin sesión:
--     se guardan igual, con el nombre que puso en el formulario.
INSERT INTO mensajes_contacto (usuario_id, autor_nombre, autor_dni, autor_telefono, asunto, mensaje, respuesta, respondido_por, respondido_en, leido, creado_en) VALUES
  (2,  'Carlos Rodríguez',  '35123456', '2281506070', 'PREGUNTA',   '¿El intercambio de la heladera sigue en pie? La otra persona no me contesta desde ayer.', NULL, NULL, NULL, FALSE, CURRENT_TIMESTAMP - INTERVAL '40 minutes'),
  (NULL, 'Visitante del sitio', NULL,    NULL,         'CONTACTO',  'Quiero saber si puedo usar la plataforma siendo de otro barrio.', NULL, NULL, NULL, FALSE, CURRENT_TIMESTAMP - INTERVAL '5 hours'),
  (5,  'Laura Fernández',    '31222444', '2281334455', 'COMENTARIO', 'El buscador del catálogo va muy bien, sólo falta filtrar por institución.', '¡Gracias por avisar! Lo anotamos para la próxima versión.', 4, CURRENT_TIMESTAMP - INTERVAL '1 day', TRUE, CURRENT_TIMESTAMP - INTERVAL '2 days');

-- 22. Aceptación de los textos legales de la demo
--     El hash es el que devuelve GET /legal/terminos, así que la constancia
--     coincide con el documento que la persona vio. Si cambia el texto legal,
--     hay que recalcularlo con hashDocumento('terminos') y actualizar acá.
INSERT INTO aceptaciones_legales (usuario_id, documento, version, hash_documento, ip_origen, user_agent, aceptado_en) VALUES
  ((SELECT id FROM usuarios WHERE dni = '38450912'), 'TERMINOS', '1.0.0', '48540fc1e4682d1d34020c81a97043d85b0a87ba8627184495f0713e75a2f970', '127.0.0.1', 'seed', CURRENT_TIMESTAMP - INTERVAL '30 days'),
  ((SELECT id FROM usuarios WHERE dni = '35123456'), 'TERMINOS', '1.0.0', '48540fc1e4682d1d34020c81a97043d85b0a87ba8627184495f0713e75a2f970', '127.0.0.1', 'seed', CURRENT_TIMESTAMP - INTERVAL '28 days'),
  ((SELECT id FROM usuarios WHERE dni = '28999888'), 'TERMINOS', '1.0.0', '48540fc1e4682d1d34020c81a97043d85b0a87ba8627184495f0713e75a2f970', '127.0.0.1', 'seed', CURRENT_TIMESTAMP - INTERVAL '25 days'),
  ((SELECT id FROM usuarios WHERE dni = '11111111'), 'TERMINOS', '1.0.0', '48540fc1e4682d1d34020c81a97043d85b0a87ba8627184495f0713e75a2f970', '127.0.0.1', 'seed', CURRENT_TIMESTAMP - INTERVAL '20 days'),
  ((SELECT id FROM usuarios WHERE dni = '11111111'), 'PRIVACIDAD', '1.0.0', 'db52f0ee903542621c449a8ab2f150ed5e8bae4953fce2e37cb8afeb16061c20', '127.0.0.1', 'seed', CURRENT_TIMESTAMP - INTERVAL '20 days');

-- 23. Reajustar las secuencias de las tablas nuevas
SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));
SELECT setval('instituciones_id_seq', (SELECT MAX(id) FROM instituciones));
SELECT setval('cupos_necesidad_id_seq', (SELECT MAX(id) FROM cupos_necesidad));
SELECT setval('nexos_sociales_id_seq', (SELECT MAX(id) FROM nexos_sociales));
SELECT setval('publicaciones_p2p_id_seq', (SELECT MAX(id) FROM publicaciones_p2p));
SELECT setval('mensajes_chat_id_seq', (SELECT MAX(id) FROM mensajes_chat));
SELECT setval('reportes_id_seq', (SELECT MAX(id) FROM reportes));
SELECT setval('intercambios_id_seq', (SELECT MAX(id) FROM intercambios));
SELECT setval('resenas_id_seq', (SELECT MAX(id) FROM resenas));
SELECT setval('sugerencias_esfuerzo_id_seq', (SELECT MAX(id) FROM sugerencias_esfuerzo));
SELECT setval('moderacion_imagenes_id_seq', (SELECT MAX(id) FROM moderacion_imagenes));
SELECT setval('mensajes_contacto_id_seq', (SELECT MAX(id) FROM mensajes_contacto));
SELECT setval('aceptaciones_legales_id_seq', (SELECT MAX(id) FROM aceptaciones_legales));
