import { Injectable, Logger } from '@nestjs/common';
import {
  SendPushNotificationDto,
  CancelPushNotificationDto,
  ReverseTransactionDto,
} from './dto/send-push.dto';
import axios from 'axios';
import { ParametrosService } from '../common/parametros.service';
import { ImplementacionNequi } from '../common/enums';
import { HttpHeadersService } from '../common/services/http-headers.service';
import {
  TransactionLogService,
  TransactionLogEntry,
} from '../transaction-log/transaction-log.service';
import { GenerateMessageId } from '../common/generate.message.id';
import { ResponseHandler } from '../common/response.handler';

@Injectable()
export class PaymentsServiceEnhanced {
  private readonly logger = new Logger(PaymentsServiceEnhanced.name);

  constructor(
    private readonly parametrosService: ParametrosService,
    private readonly httpHeadersService: HttpHeadersService,
    private readonly transactionLogService: TransactionLogService,
    private readonly generateMessageId: GenerateMessageId,
  ) {}

  private async validateNequiConfig(urlKey: string) {
    const headers = await this.httpHeadersService.getHeaders();
    const url = await this.parametrosService.obtenerValorParametro(urlKey);
    const timeout = await this.parametrosService.obtenerValorParametro(
      ImplementacionNequi.NEQUI_TIMEUOT_CLOUD,
    );
    if (!url || !headers?.Authorization || !headers['x-api-key']) {
      this.logger.error(`[postToNequi] URL o Headers inválidos para ${urlKey}`);
      return ResponseHandler.error(
        `Error: Configuración`,
        `No se pudo obtener URL o token de NEQUI`,
        400,
      );
    }
    return { url, headers, timeout: timeout || 60000 };
  }

  /**
   * Construye el cuerpo base de la petición NEQUI
   */
  private buildRequestMessage(
    serviceName: string,
    serviceOperation: string,
    bodyContent: object,
    stationCode?: string,
    equipmentCode?: string,
  ) {
    const messageId = this.generateMessageId.generateMessageId(
      stationCode,
      equipmentCode,
    );
    return {
      messageId,
      payload: {
        RequestMessage: {
          RequestHeader: {
            Channel: 'PNP04-C001',
            RequestDate: new Date().toISOString(),
            MessageID: messageId,
            ClientID:
              stationCode || equipmentCode
                ? `${stationCode}-${equipmentCode}`
                : '12345',
            Destination: {
              ServiceName: serviceName,
              ServiceOperation: serviceOperation,
              ServiceRegion: 'C001',
              ServiceVersion: '1.0.0',
            },
          },
          RequestBody: {
            any: bodyContent,
          },
        },
      },
    };
  }

  /**
   * Llamada genérica a NEQUI
   */
  private async postToNequi(
    urlKey: ImplementacionNequi,
    payload: any,
    logEntry: TransactionLogEntry,
    successHandler?: (response: any) => Partial<TransactionLogEntry>,
  ) {
    let logId = 0;
    const startTime = Date.now();

    try {
      const config = await this.validateNequiConfig(urlKey);
      if ('error' in config) {
        return config;
      }
      const { url, headers, timeout } = config;
      // Registrar log inicial
      logEntry.requestPayload = payload;
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      // Llamada HTTP
      const response = await axios.post(url, payload, {
        headers,
        timeout: +timeout,
      });
      const processingTime = Date.now() - startTime;

      if (response?.status === 200 && response.data) {
        const status = response.data.ResponseMessage?.ResponseHeader?.Status;
        const updateData: Partial<TransactionLogEntry> = {
          responsePayload: response.data,
          nequiStatusCode: status?.StatusCode,
          nequiStatusDescription: status?.StatusDesc,
          processingTimeMs: processingTime,
          status: status?.StatusCode === '0' ? 'SUCCESS' : 'FAILED',
          ...(successHandler ? successHandler(response) : {}),
        };

        await this.transactionLogService.updateTransactionLog(
          logId,
          updateData,
        );
        this.logger.debug(
          `Response from NEQUI: ${JSON.stringify(response.data)}`,
        );
        return status?.StatusCode === '0'
          ? ResponseHandler.success(response.data, 'Operación exitosa')
          : ResponseHandler.error(
              `Error ${status?.StatusCode} = ${status?.StatusDesc}`,
              'Error en operación NEQUI',
            );
      }

      // Error de conexión o respuesta inválida
      await this.transactionLogService.updateTransactionLog(logId, {
        status: 'FAILED',
        errorMessage: 'No se pudo conectar a NEQUI',
        processingTimeMs: processingTime,
      });
      this.logger.error(
        `No se pudo conectar a NEQUI, respuesta inválida: ${JSON.stringify(
          response,
        )}`,
      );
      return ResponseHandler.error(`FAILED`, 'Unable to connect to Nequi');
    } catch (error) {
      if (logId > 0) {
        await this.transactionLogService.updateTransactionLog(logId, {
          status: 'FAILED',
          errorMessage: error.message,
          processingTimeMs: Date.now() - startTime,
        });
      }
      this.logger.error(
        `Error en solicitud a NEQUI: ${error.message}`,
        error.stack,
      );
      return ResponseHandler.error(error, 'Error en solicitud a NEQUI');
    }
  }

  /**
   * Enviar pago
   */
  async sendPushNotification2(
    dto: SendPushNotificationDto,
    clientIp?: string,
    userAgent?: string,
    stationCode?: string,
    equipmentCode?: string,
  ) {
    this.logger.verbose(
      'Preparing to send push notification to NEQUI' + JSON.stringify(dto),
    );
    const { messageId, payload } = this.buildRequestMessage(
      'PaymentsService',
      'unregisteredPayment',
      {
        unregisteredPaymentRQ: {
          phoneNumber: dto.phoneNumber,
          code: 'NIT_1',
          value: dto.value,
          reference1: stationCode,
          reference2: equipmentCode,
          reference3: 'reference3',
        },
      },
      stationCode,
      equipmentCode,
    );

    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'SEND_PUSH',
      phoneNumber: dto.phoneNumber,
      amount: dto.value,
      status: 'PENDING',
      clientIp,
      userAgent,
      reference1: stationCode,
      reference2: equipmentCode,
      reference3: messageId,
      environment: process.env.NODE_ENV || 'production',
    };

    return this.postToNequi(
      ImplementacionNequi.NEQUI_UNREGISTERED_PAYMENT_URL,
      payload,
      logEntry,
      (response) => {
        const transactionId =
          response.data.ResponseMessage?.ResponseBody?.any?.unregisteredPaymentRS?.transactionId?.trim();
        return { transactionId };
      },
    );
  }

  async sendPushNotification(
    dto: SendPushNotificationDto,
    clientIp?: string,
    userAgent?: string,
    stationCode?: string,
    equipmentCode?: string,
  ): Promise<any> {
    const messageId = this.generateMessageId.generateMessageId(
      stationCode,
      equipmentCode,
    );
    const startTime = Date.now();

    this.logger.verbose('Sending push notification to NEQUI');

    // Crear registro inicial de transacción
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'SEND_PUSH',
      phoneNumber: dto.phoneNumber,
      amount: dto.value,
      status: 'PENDING',
      clientIp,
      userAgent,
      reference1: stationCode,
      reference2: equipmentCode,
      reference3: messageId,
      environment: process.env.NODE_ENV || 'production',
    };

    let logId: number = 0;

    try {
      // Crear el payload de la solicitud
      const payload = {
        RequestMessage: {
          RequestHeader: {
            Channel: 'PNP04-C001',
            RequestDate: new Date().toISOString(),
            MessageID: messageId,
            ClientID:
              stationCode || equipmentCode
                ? `${stationCode}-${equipmentCode}`
                : '12345',
            Destination: {
              ServiceName: 'PaymentsService',
              ServiceOperation: 'unregisteredPayment',
              ServiceRegion: 'C001',
              ServiceVersion: '1.2.0',
            },
          },
          RequestBody: {
            any: {
              unregisteredPaymentRQ: {
                phoneNumber: dto.phoneNumber,
                code: 'NIT_1',
                value: dto.value,
                reference1: stationCode,
                reference2: equipmentCode,
                reference3: 'reference3',
              },
            },
          },
        },
      };

      logEntry.requestPayload = payload;

      // Registrar la transacción inicial
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      // Obtener configuración
      const basePath = await this.parametrosService.obtenerValorParametro(
        ImplementacionNequi.NEQUI_UNREGISTERED_PAYMENT_URL,
      );
      if (!basePath) {
        this.logger.error(
          '[sendPushNotification] No se pudo obtener la basePath o paymentUrl de NEQUI.',
        );
        return ResponseHandler.error(
          ``,
          'No se pudo obtener la basePath o paymentUrl de NEQUI.',
          400,
        );
      }

      const headers = await this.httpHeadersService.getHeaders();
      if (
        !headers ||
        !headers.Authorization ||
        basePath === null ||
        basePath === undefined ||
        basePath === '' ||
        headers['x-api-key'] === null ||
        headers['x-api-key'] === undefined ||
        headers['x-api-key'] === ''
      ) {
        this.logger.error(
          '[sendPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.',
        );
        return ResponseHandler.error(
          ``,
          'No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.',
          400,
        );
      }

      // Realizar la solicitud a Nequi
      const response = await axios.post(basePath, payload, {
        headers,
        timeout: 60000,
      });
      const processingTime = Date.now() - startTime;

      this.logger.debug(
        'Response from NEQUI Sending: ' + JSON.stringify(response.data),
      );

      if (!!response && response.status === 200 && response.data) {
        const { data } = response;
        const { StatusCode: statusCode = '', StatusDesc: statusDesc = '' } =
          data.ResponseMessage.ResponseHeader.Status;

        // Actualizar el log con la respuesta
        const updateData: Partial<TransactionLogEntry> = {
          responsePayload: response.data,
          nequiStatusCode: statusCode,
          nequiStatusDescription: statusDesc,
          processingTimeMs: processingTime,
        };

        if (statusCode === '0') {
          const { transactionId = '' } =
            data.ResponseMessage.ResponseBody.any.unregisteredPaymentRS;

          updateData.transactionId = transactionId.trim();
          updateData.status = 'SUCCESS';

          this.logger.debug(
            'Solicitud de pago realizada correctamente\n' +
              `- Id Transacción -> ${transactionId.trim()}`,
          );

          await this.transactionLogService.updateTransactionLog(
            logId,
            updateData,
          );
          return ResponseHandler.success(response.data, 'Operación exitosa');
        } else {
          updateData.status = 'FAILED';
          updateData.errorMessage = `Error ${statusCode} = ${statusDesc}`;

          await this.transactionLogService.updateTransactionLog(
            logId,
            updateData,
          );
          return ResponseHandler.error(
            `Error ${statusCode} = ${statusDesc}`,
            'Error en el pago',
          );
        }
      } else {
        const updateData: Partial<TransactionLogEntry> = {
          status: 'FAILED',
          errorMessage:
            'Unable to connect to Nequi, please check the information sent.',
          processingTimeMs: processingTime,
        };

        await this.transactionLogService.updateTransactionLog(
          logId,
          updateData,
        );
        return ResponseHandler.error(
          `FAILED`,
          'Unable to connect to Nequi, please check the information sent.',
        );
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Actualizar el log con el error
      if (logId || logId !== 0) {
        await this.transactionLogService.updateTransactionLog(logId, {
          status: 'FAILED',
          errorMessage: error.message,
          processingTimeMs: processingTime,
        });
      }
      return ResponseHandler.error(
        error,
        'No se pudo realizar la solicitud a NEQUI',
      );
    }
  }

  async cancelPushNotification(
    dto: CancelPushNotificationDto,
    clientIp?: string,
    userAgent?: string,
    stationCode?: string,
    equipmentCode?: string,
  ): Promise<any> {
    const { transactionId, phoneNumber } = dto;
    const messageId = this.generateMessageId.generateMessageId(
      stationCode,
      equipmentCode,
    );
    const startTime = Date.now();

    this.logger.verbose('Sending cancel notification to NEQUI');
    this.logger.verbose(`>> ${JSON.stringify(transactionId)}`);
    this.logger.verbose(`>> ${JSON.stringify(phoneNumber)}`);
    this.logger.verbose(`>> ${JSON.stringify(stationCode)}`);
    this.logger.verbose(`>> ${JSON.stringify(equipmentCode)}`);

    // Buscar la transacción original para establecer la relación padre-hijo
    let parentTransactionId: number | undefined;
    try {
      const originalTransactions =
        await this.transactionLogService.getTransactionLogs({
          transactionId: transactionId,
          operationType: 'SEND_PUSH',
          phoneNumber: phoneNumber,
        });
      if (originalTransactions.length > 0) {
        parentTransactionId = originalTransactions[0].id;
      }
    } catch (error) {
      this.logger.warn(
        `Could not find parent transaction for cancellation: ${error.message}`,
      );
      return ResponseHandler.error(
        error,
        'Could not find parent transaction for cancellation',
        400,
      );
    }

    // Crear registro inicial de cancelación
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'CANCEL_PUSH',
      phoneNumber,
      status: 'PENDING',
      clientIp,
      userAgent,
      parentTransactionId,
      transactionId: transactionId,
      reference1: stationCode,
      reference2: equipmentCode,
      reference3: messageId,
      environment: process.env.NODE_ENV || 'production',
    };

    let logId: number = 0;

    try {
      const config = await this.validateNequiConfig(
        ImplementacionNequi.NEQUI_CANCEL_PAYMENT_URL,
      );
      if ('error' in config) {
        return config;
      }
      const { url, headers } = config;

      const body = {
        RequestMessage: {
          RequestHeader: {
            Channel: 'PNP04-C001',
            RequestDate: new Date().toISOString(),
            MessageID: messageId,
            ClientID:
              stationCode || equipmentCode
                ? `${stationCode}-${equipmentCode}`
                : '12345',
            Destination: {
              ServiceName: 'PaymentsService',
              ServiceOperation: 'unregisteredPayment',
              ServiceRegion: 'C001',
              ServiceVersion: '1.0.0',
            },
          },
          RequestBody: {
            any: {
              cancelUnregisteredPaymentRQ: {
                code: '1',
                phoneNumber: `${phoneNumber}`,
                transactionId: `${transactionId}`,
              },
            },
          },
        },
      };

      logEntry.requestPayload = body;

      // Registrar la transacción de cancelación
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const response = await axios.post(url, body, { headers, timeout: 60000 });
      const processingTime = Date.now() - startTime;
      if (!!response && response.status === 200 && response.data) {
        const { data } = response;
        const { StatusCode: statusCode = '', StatusDesc: statusDesc = '' } =
          data.ResponseMessage.ResponseHeader.Status;

        const updateData: Partial<TransactionLogEntry> = {
          responsePayload: response.data,
          nequiStatusCode: statusCode,
          nequiStatusDescription: statusDesc,
          processingTimeMs: processingTime,
        };

        if (statusCode === '0') {
          updateData.status = 'SUCCESS';

          this.logger.debug(
            'Solicitud de cancelacion realizada correctamente\n' +
              `- Id Transacción -> ${transactionId.trim()}`,
          );

          // También actualizar la transacción original como cancelada
          if (parentTransactionId) {
            await this.transactionLogService.updateTransactionLog(
              parentTransactionId,
              {
                status: 'CANCELLED',
              },
            );
          }

          await this.transactionLogService.updateTransactionLog(
            logId,
            updateData,
          );
          this.logger.debug(
            'Cancelación de pago realizada correctamente: ' +
              JSON.stringify(response.data),
          );
          return ResponseHandler.success(response.data, 'Operación exitosa');
        } else {
          updateData.status = 'FAILED';
          updateData.errorMessage = `Error ${statusCode} = ${statusDesc}`;

          await this.transactionLogService.updateTransactionLog(
            logId,
            updateData,
          );
          this.logger.error(
            `No se pudo conectar a NEQUI, respuesta inválida: ${JSON.stringify(
              response?.data ?? {},
            )}`,
          );
          return ResponseHandler.error(
            `Error ${statusCode} = ${statusDesc}`,
            'Unable to connect to Nequi, please check the information sent.',
          );
        }
      } else {
        const updateData: Partial<TransactionLogEntry> = {
          status: 'FAILED',
          errorMessage:
            'Unable to connect to Nequi, please check the information sent.',
          processingTimeMs: processingTime,
        };

        await this.transactionLogService.updateTransactionLog(
          logId,
          updateData,
        );
        this.logger.error(
          `No se pudo conectar a NEQUI, respuesta inválida: ${JSON.stringify(
            response,
          )}`,
        );
        return ResponseHandler.error(
          `FAILED`,
          'Unable to connect to Nequi, please check the information sent.',
        );
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;

      if (logId || logId !== 0) {
        await this.transactionLogService.updateTransactionLog(logId, {
          status: 'FAILED',
          errorMessage: error.message,
          processingTimeMs: processingTime,
        });
      }
      this.logger.error(
        `Error al cancelar notificación: ${error.message}`,
        error.stack,
      );
      return ResponseHandler.error(
        error,
        'No se pudo realizar la cancelacion a NEQUI',
      );
    }
  }

  async getPaymentStatus(
    codeQR: any,
    clientIp?: string,
    userAgent?: string,
    stationCode?: string,
    equipmentCode?: string,
  ): Promise<any> {
    const { transactionId } = codeQR;
    const messageId = this.generateMessageId.generateMessageId(
      stationCode,
      equipmentCode,
    );
    const startTime = Date.now();

    this.logger.verbose(
      `Consultando estado de pago: ${JSON.stringify(transactionId)}`,
    );

    // Crear registro de consulta de estado
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'GET_STATUS',
      status: 'PENDING',
      clientIp,
      userAgent,
      environment: process.env.NODE_ENV || 'production',
      transactionId,
      reference1: stationCode,
      reference2: equipmentCode,
      reference3: messageId,
    };

    let logId: number = 0;

    try {
      const config = await this.validateNequiConfig(
        ImplementacionNequi.NEQUI_STATUS_PAYMENT_URL,
      );
      if ('error' in config) {
        return config;
      }
      const { url, headers, timeout } = config;

      const body = {
        RequestMessage: {
          RequestHeader: {
            Channel: 'PNP04-C001',
            RequestDate: new Date().toISOString(),
            MessageID: messageId,
            ClientID:
              stationCode || equipmentCode
                ? `${stationCode}-${equipmentCode}`
                : '12345',
            Destination: {
              ServiceName: 'PaymentsService',
              ServiceOperation: 'getStatusPayment',
              ServiceRegion: 'C001',
              ServiceVersion: '1.0.0',
            },
          },
          RequestBody: {
            any: {
              getStatusPaymentRQ: {
                codeQR: transactionId,
              },
            },
          },
        },
      };

      logEntry.requestPayload = body;

      // Registrar la consulta
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const response = await axios.post(url, body, {
        headers,
        timeout: +timeout,
      });
      const processingTime = Date.now() - startTime;

      this.logger.debug(
        'Response from NEQUI Consult: ' + JSON.stringify(response.data),
      );

      // Actualizar el log con la respuesta
      await this.transactionLogService.updateTransactionLog(logId, {
        responsePayload: response.data,
        status: 'SUCCESS',
        processingTimeMs: processingTime,
        nequiStatusCode:
          response.data.ResponseMessage.ResponseHeader.Status.StatusCode,
        nequiStatusDescription:
          response.data.ResponseMessage.ResponseHeader.Status.StatusDesc,
      });
      Logger.debug(
        'Estado de pago consultado correctamente: ' +
          JSON.stringify(response.data),
      );
      return ResponseHandler.success(response.data, 'Operación exitosa');
    } catch (error) {
      const processingTime = Date.now() - startTime;

      if (logId || logId !== 0) {
        await this.transactionLogService.updateTransactionLog(logId, {
          status: 'FAILED',
          errorMessage: error.message,
          processingTimeMs: processingTime,
        });
      }
      Logger.error(
        `Error al consultar estado de pago: ${error.message}`,
        error.stack,
      );
      return ResponseHandler.error(
        error,
        'No se pudo realizar la solicitud a NEQUI',
      );
    }
  }

  async reverseTransaction(
    dto: ReverseTransactionDto,
    clientIp?: string,
    userAgent?: string,
    stationCode?: string,
    equipmentCode?: string,
  ): Promise<any> {
    const { messageId: originalMessageId, phoneNumber, value } = dto;
    const messageId = this.generateMessageId.generateMessageId(
      stationCode,
      equipmentCode,
    );
    const startTime = Date.now();

    this.logger.verbose('Sending reverse pago to NEQUI');
    this.logger.verbose(`>> ${JSON.stringify(originalMessageId)}`);
    this.logger.verbose(`>> ${JSON.stringify(phoneNumber)}`);
    this.logger.verbose(`>> ${JSON.stringify(value)}`);

    // Buscar la transacción original
    let parentTransactionId: number | undefined;
    try {
      const originalTransaction =
        await this.transactionLogService.getTransactionLogByMessageId(
          originalMessageId,
        );
      if (originalTransaction) {
        parentTransactionId = originalTransaction.id;
      }
    } catch (error) {
      this.logger.warn(
        `Could not find parent transaction for reversal: ${error.message}`,
      );
      return ResponseHandler.error(
        error,
        'Could not find parent transaction for reversal',
        400,
      );
    }

    // Crear registro de reversión
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'REVERSE',
      phoneNumber,
      amount: value,
      status: 'PENDING',
      clientIp,
      userAgent,
      parentTransactionId,
      reference1: stationCode,
      reference2: equipmentCode,
      reference3: messageId,
      environment: process.env.NODE_ENV || 'production',
    };

    let logId: number = 0;

    try {
      const config = await this.validateNequiConfig(
        ImplementacionNequi.NEQUI_REVERSE_PAYMENT_URL,
      );
      if ('error' in config) {
        return config;
      }
      const { url, headers, timeout } = config;

      const body = {
        RequestMessage: {
          RequestHeader: {
            Channel: 'PNP04-C001',
            RequestDate: new Date().toISOString(),
            MessageID: messageId,
            ClientID:
              stationCode || equipmentCode
                ? `${stationCode}-${equipmentCode}`
                : '12345',
            Destination: {
              ServiceName: 'ReverseServices',
              ServiceOperation: 'reverseTransaction',
              ServiceRegion: 'C001',
              ServiceVersion: '1.0.0',
            },
          },
          RequestBody: {
            any: {
              reversionRQ: {
                phoneNumber: `${phoneNumber}`,
                value: `${value}`,
                code: 'NIT_1',
                messageId: `${originalMessageId}`,
                type: 'payment',
              },
            },
          },
        },
      };

      logEntry.requestPayload = body;

      // Registrar la reversión
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const response = await axios.post(url, body, {
        headers,
        timeout: +timeout,
      });
      const processingTime = Date.now() - startTime;

      if (!!response && response.status === 200 && response.data) {
        const { data } = response;
        const { StatusCode: statusCode = '', StatusDesc: statusDesc = '' } =
          data.ResponseMessage.ResponseHeader.Status;

        const updateData: Partial<TransactionLogEntry> = {
          responsePayload: response.data,
          nequiStatusCode: statusCode,
          nequiStatusDescription: statusDesc,
          processingTimeMs: processingTime,
        };

        if (statusCode === '0') {
          updateData.status = 'SUCCESS';

          this.logger.debug('Solicitud de reversion realizada correctamente');

          // Actualizar la transacción original como revertida
          if (parentTransactionId) {
            await this.transactionLogService.updateTransactionLog(
              parentTransactionId,
              {
                status: 'REVERSED',
              },
            );
          }
          await this.transactionLogService.updateTransactionLog(
            logId,
            updateData,
          );
          return ResponseHandler.success(response.data, 'Operación exitosa');
        } else {
          updateData.status = 'FAILED';
          updateData.errorMessage = `Error ${statusCode} = ${statusDesc}`;

          await this.transactionLogService.updateTransactionLog(
            logId,
            updateData,
          );
          return ResponseHandler.error(
            `Error ${statusCode} = ${statusDesc}`,
            'Unable to connect to Nequi, please check the information sent.',
          );
        }
      } else {
        const updateData: Partial<TransactionLogEntry> = {
          status: 'FAILED',
          errorMessage:
            'Unable to connect to Nequi, please check the information sent.',
          processingTimeMs: processingTime,
        };

        await this.transactionLogService.updateTransactionLog(
          logId,
          updateData,
        );
        return ResponseHandler.error(
          `FAILED`,
          'Unable to connect to Nequi, please check the information sent.',
        );
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;

      if (logId || logId !== 0) {
        await this.transactionLogService.updateTransactionLog(logId, {
          status: 'FAILED',
          errorMessage: error.message,
          processingTimeMs: processingTime,
        });
      }
      return ResponseHandler.error(
        error,
        'No se pudo realizar la reversión de la transacción a NEQUI',
      );
    }
  }
}
