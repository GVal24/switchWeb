const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Ocurrió un error interno en el servidor de Switch.";

  // Manejo de códigos específicos de PostgreSQL
  if (err.code === '23505') { // Constraint UNIQUE violada (DNI o Teléfono duplicado)
    statusCode = 409;
    message = "El DNI o número de teléfono ya se encuentra registrado en Switch.";
  }

  if (err.code === '23503') { // Foreign Key no existente
    statusCode = 400;
    message = "La referencia a la institución o recurso no es válida.";
  }

  // 22P02 = "invalid_text_representation": un texto no se pudo convertir al
  // tipo que la columna pide. Puede ser un UUID mal formado, un número
  // inválido o un JSON mal armado, así que el mensaje no culpa a un UUID
  // en particular: informa que el dato recibido no tiene el formato correcto.
  if (err.code === '22P02') {
    statusCode = 400;
    message =
      "Alguno de los datos enviados no tiene el formato esperado. " +
      "Revisá los campos e intentá de nuevo.";
  }

  if (statusCode === 500) {
    console.error("🔴 ERROR CRÍTICO NO CONTROLADO:", err);
  } else {
    console.warn(`⚠️ Excepción de negocio [${statusCode}]: ${message}`);
  }

  res.status(statusCode).json({
    exito: false,
    codigoEstado: statusCode,
    mensaje: message,
    // Datos auxiliares del error de negocio (por ejemplo, cuántos segundos
    // faltan para poder volver a pedir un código OTP).
    ...(err.detalles ? { detalles: err.detalles } : {}),
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;