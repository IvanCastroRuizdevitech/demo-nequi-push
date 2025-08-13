import { Injectable, Logger } from '@nestjs/common';
import {
  SendPushNotificationDto,
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
export class PaymentsQrServiceEnhanced {
  private readonly logger = new Logger(PaymentsQrServiceEnhanced.name);

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

  async crearQr(
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

    this.logger.verbose(
      'Sending push notification QR to NEQUI #',
      dto.phoneNumber,
      ' Station: ',
      stationCode,
      ' Equipment: ',
      equipmentCode,
    );

    // Crear registro inicial de transacción QR
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'SEND_PUSH', // Reutilizamos el tipo para QR
      phoneNumber: dto.phoneNumber,
      amount: dto.value,
      status: 'PENDING',
      clientIp,
      userAgent,
      reference1: stationCode,
      reference2: equipmentCode,
      reference3: messageId,
      environment: process.env.NODE_ENV || 'production',
      internalReference: `QR_${messageId}`, // Identificador específico para QR
    };

    let logId: number = 0;

    try {
      const payload = {
        RequestMessage: {
          RequestHeader: {
            Channel: 'PQR03-C001',
            RequestDate: new Date().toISOString(),
            MessageID: messageId,
            ClientID:
              stationCode || equipmentCode
                ? `${stationCode}-${equipmentCode}`
                : '12345',
            Destination: {
              ServiceName: 'PaymentsService',
              ServiceOperation: 'generateCodeQR',
              ServiceRegion: 'C001',
              ServiceVersion: '1.2.0',
            },
          },
          RequestBody: {
            any: {
              generateCodeQRRQ: {
                code: 'NIT_1',
                value: dto.value,
                reference1: stationCode,
                reference2: equipmentCode,
                reference3: messageId,
              },
            },
          },
        },
      };

      logEntry.requestPayload = payload;

      // Registrar la transacción QR inicial
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const config = await this.validateNequiConfig(
        ImplementacionNequi.NEQUI_PAYMENTS_QR_URL,
      );
      if ('error' in config) {
        return config;
      }
      const { url, headers, timeout } = config;

      const response = await axios.post(url, payload, {
        headers,
        timeout: +timeout,
      });
      const processingTime = Date.now() - startTime;

      this.logger.debug(
        'Response from QR NEQUI Sending: ' + JSON.stringify(response.data),
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
          const codeQR =
            data?.ResponseMessage?.ResponseBody?.any?.generateCodeQRRS
              ?.qrValue || '';

          updateData.transactionId = codeQR; // Usamos el código QR como transaction ID
          updateData.status = 'SUCCESS';

          this.logger.debug(
            'Código QR generado correctamente\n' + `- Código QR -> ${codeQR}`,
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
        'No se pudo realizar la solicitud a QR NEQUI',
        400,
      );
    }
  }

  async consultarEstadoQr(
    qrId: string,
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

    this.logger.verbose(
      `Consultando estado de pago QR con ID: ${JSON.stringify(
        qrId,
      )} Station: ${stationCode}, Equipment: ${equipmentCode}`,
    );

    // Crear registro de consulta de estado QR
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'GET_STATUS',
      status: 'PENDING',
      clientIp,
      userAgent,
      reference1: stationCode,
      reference2: equipmentCode,
      environment: process.env.NODE_ENV || 'production',
      internalReference: `QR_STATUS_${qrId}`,
    };

    let logId: number = 0;

    try {
      const config = await this.validateNequiConfig(
        ImplementacionNequi.NEQUI_STATUS_PAYMENTS_QR_URL,
      );
      if ('error' in config) {
        return config;
      }
      const { url, headers, timeout } = config;

      // Crear el payload para la consulta de estado
      const requestPayload = {
        url: url,
        method: 'GET',
        qrId: qrId,
      };

      logEntry.requestPayload = requestPayload;

      // Registrar la consulta
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const response = await axios.post(url, {
        headers,
        timeout: +timeout,
      });
      const processingTime = Date.now() - startTime;

      // Actualizar el log con la respuesta
      await this.transactionLogService.updateTransactionLog(logId, {
        responsePayload: response.data,
        status: 'SUCCESS',
        processingTimeMs: processingTime,
      });
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
      return ResponseHandler.error(
        error,
        'No se pudo consultar el estado del QR',
        400,
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

    this.logger.verbose('Sending reverse QR pago to NEQUI');
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
                qrValue: `${value}`,
                code: 'NIT_1',
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
