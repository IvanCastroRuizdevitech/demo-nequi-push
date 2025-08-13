export class ResponseHandler {
  static success(data: any, message = 'Operación exitosa') {
    return {
      success: true,
      message,
      data,
    };
  }

  static error(error: any, message = 'Error en la operación', statusCode = 500) {
    return {
      success: false,
      message,
      error: typeof error === 'string' ? error : error?.message || error,
      statusCode,
    };
  }
}