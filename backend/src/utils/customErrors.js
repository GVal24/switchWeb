class AppError extends Error {
  constructor(message, statusCode, detalles = null) {
    super(message);
    this.statusCode = statusCode;
    this.detalles = detalles;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, detalles) {
    super(message, 400, detalles);
  }
}

class ForbiddenError extends AppError {
  constructor(message, detalles) {
    super(message, 403, detalles);
  }
}

class NotFoundError extends AppError {
  constructor(message, detalles) {
    super(message, 404, detalles);
  }
}

class ConflictError extends AppError {
  constructor(message, detalles) {
    super(message, 409, detalles);
  }
}

class UnauthorizedError extends AppError {
  constructor(message, detalles) {
    super(message, 401, detalles);
  }
}

/**
 * 429: el cliente pidió demasiado seguido. Se usa para el freno de abuso
 * del envío de códigos OTP.
 */
class TooManyRequestsError extends AppError {
  constructor(message, detalles) {
    super(message, 429, detalles);
  }
}

module.exports = {
  AppError,
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  TooManyRequestsError
};