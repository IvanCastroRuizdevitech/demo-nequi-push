import { Injectable, Logger } from '@nestjs/common';
import { SendPushNotificationDto, CancelPushNotificationDto, ReverseTransactionDto } from './dto/send-push.dto';
import axios from 'axios';
import { ParametrosService } from '../common/parametros.service';
import { ImplementacionNequi } from '../common/enums'
import { HttpHeadersService  } from '../common/services/http-headers.service';
import { TransactionLogService, TransactionLogEntry } from '../transaction-log/transaction-log.service';

@Injectable()
export class PaymentsServiceEnhanced {
  private readonly logger = new Logger(PaymentsServiceEnhanced.name);
  
  constructor(
    private readonly parametrosService: ParametrosService,
    private readonly httpHeadersService: HttpHeadersService,
    private readonly transactionLogService: TransactionLogService
  ) {}

  async sendPushNotification(dto: SendPushNotificationDto, clientIp?: string, userAgent?: string): Promise<any> {
    const messageId = this.generateMessageId();
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
      reference1: 'reference1',
      reference2: 'reference2',
      reference3: 'reference3',
      environment: process.env.NODE_ENV || 'production'
    };

    let logId: number;
    
    try {
      // Crear el payload de la solicitud
      const payload = {
        RequestMessage: {
          RequestHeader: {
            Channel: 'PNP04-C001',
            RequestDate: new Date().toISOString(),
            MessageID: messageId,
            ClientID: '12345',
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
                reference1: 'reference1',
                reference2: 'reference2',
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
      const basePath = await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_UNREGISTERED_PAYMENT_URL);
      if (!basePath) {
        throw new Error('[sendPushNotification] No se pudo obtener la basePath o paymentUrl de NEQUI.');
      }

      const headers = await this.httpHeadersService.getHeaders();
      if (!headers || !headers.Authorization || (basePath === null || basePath === undefined || basePath === '') || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '')) {
        throw new Error('[sendPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
      }

      // Realizar la solicitud a Nequi
      const response = await axios.post(basePath, payload, { headers });
      const processingTime = Date.now() - startTime;
      
      this.logger.debug('Response from NEQUI Sending: ' + JSON.stringify(response.data));

      if (!!response && response.status === 200 && response.data) {
        const { data } = response;
        const {
          StatusCode: statusCode = '',
          StatusDesc: statusDesc = ''
        } = data.ResponseMessage.ResponseHeader.Status;

        // Actualizar el log con la respuesta
        const updateData: Partial<TransactionLogEntry> = {
          responsePayload: response.data,
          nequiStatusCode: statusCode,
          nequiStatusDescription: statusDesc,
          processingTimeMs: processingTime
        };

        if (statusCode === "0") {
          const {
            transactionId = ''
          } = data.ResponseMessage.ResponseBody.any.unregisteredPaymentRS;

          updateData.transactionId = transactionId.trim();
          updateData.status = 'SUCCESS';

          this.logger.debug(
            'Solicitud de pago realizada correctamente\n' +
            `- Id Transacción -> ${transactionId.trim()}`
          );

          await this.transactionLogService.updateTransactionLog(logId, updateData);
          return response.data;

        } else {
          updateData.status = 'FAILED';
          updateData.errorMessage = `Error ${statusCode} = ${statusDesc}`;
          
          await this.transactionLogService.updateTransactionLog(logId, updateData);
          throw new Error(`Error ${statusCode} = ${statusDesc}`);
        }
      } else {
        const updateData: Partial<TransactionLogEntry> = {
          status: 'FAILED',
          errorMessage: 'Unable to connect to Nequi, please check the information sent.',
          processingTimeMs: processingTime
        };
        
        await this.transactionLogService.updateTransactionLog(logId, updateData);
        throw new Error('Unable to connect to Nequi, please check the information sent.');
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Actualizar el log con el error
      if (logId) {
        await this.transactionLogService.updateTransactionLog(logId, {
          status: 'FAILED',
          errorMessage: error.message,
          processingTimeMs: processingTime
        });
      }
      
      throw new Error('No se pudo realizar la solicitud a NEQUI: ' + error.message);
    }
  }

  async cancelPushNotification(dto: CancelPushNotificationDto, clientIp?: string, userAgent?: string): Promise<any> {
    const { transactionId, phoneNumber } = dto;
    const messageId = this.generateMessageId();
    const startTime = Date.now();
    
    this.logger.verbose('Sending cancel notification to NEQUI');
    this.logger.verbose(`>> ${JSON.stringify(transactionId)}`);
    this.logger.verbose(`>> ${JSON.stringify(phoneNumber)}`);

    // Buscar la transacción original para establecer la relación padre-hijo
    let parentTransactionId: number | undefined;
    try {
      const originalTransactions = await this.transactionLogService.getTransactionLogs({
        transactionId: transactionId,
        operationType: 'SEND_PUSH'
      });
      if (originalTransactions.length > 0) {
        parentTransactionId = originalTransactions[0].id;
      }
    } catch (error) {
      this.logger.warn(`Could not find parent transaction for cancellation: ${error.message}`);
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
      environment: process.env.NODE_ENV || 'production'
    };

    let logId: number;

    try {
      const url = `${await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_CANCEL_PAYMENT_URL)}`;
      const headers = await this.httpHeadersService.getHeaders();
      
      if (!headers || !headers.Authorization || (url === null || url === undefined || url === '') || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '')) {
        throw new Error('[cancelPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
      }

      const body = {
        "RequestMessage": {
          "RequestHeader": {
            "Channel": "PNP04-C001",
            "RequestDate": new Date().toISOString(),
            "MessageID": messageId,
            "ClientID": "12345",
            "Destination": {
              "ServiceName": "PaymentsService",
              "ServiceOperation": "unregisteredPayment",
              "ServiceRegion": "C001",
              "ServiceVersion": "1.0.0"
            }
          },
          "RequestBody": {
            "any": {
              "cancelUnregisteredPaymentRQ": {
                "code": "1",
                "phoneNumber": `${phoneNumber}`,
                "transactionId": `${transactionId}`
              }
            }
          }
        }
      };

      logEntry.requestPayload = body;
      
      // Registrar la transacción de cancelación
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const response = await axios.post(url, body, { headers });
      const processingTime = Date.now() - startTime;

      if (!!response && response.status === 200 && response.data) {
        const { data } = response;
        const {
          StatusCode: statusCode = '',
          StatusDesc: statusDesc = ''
        } = data.ResponseMessage.ResponseHeader.Status;

        const updateData: Partial<TransactionLogEntry> = {
          responsePayload: response.data,
          nequiStatusCode: statusCode,
          nequiStatusDescription: statusDesc,
          processingTimeMs: processingTime
        };

        if (statusCode === "0") {
          updateData.status = 'SUCCESS';
          
          this.logger.debug(
            'Solicitud de cancelacion realizada correctamente\n' +
            `- Id Transacción -> ${transactionId.trim()}`
          );

          // También actualizar la transacción original como cancelada
          if (parentTransactionId) {
            await this.transactionLogService.updateTransactionLog(parentTransactionId, {
              status: 'CANCELLED'
            });
          }

          await this.transactionLogService.updateTransactionLog(logId, updateData);
          return response.data;

        } else {
          updateData.status = 'FAILED';
          updateData.errorMessage = `Error ${statusCode} = ${statusDesc}`;
          
          await this.transactionLogService.updateTransactionLog(logId, updateData);
          throw new Error(`Error ${statusCode} = ${statusDesc}`);
        }
      } else {
        const updateData: Partial<TransactionLogEntry> = {
          status: 'FAILED',
          errorMessage: 'Unable to connect to Nequi, please check the information sent.',
          processingTimeMs: processingTime
        };
        
        await this.transactionLogService.updateTransactionLog(logId, updateData);
        throw new Error('Unable to connect to Nequi, please check the information sent.');
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      if (logId) {
        await this.transactionLogService.updateTransactionLog(logId, {
          status: 'FAILED',
          errorMessage: error.message,
          processingTimeMs: processingTime
        });
      }
      
      throw new Error('No se pudo realizar la cancelacion a NEQUI: ' + error.message);
    }
  }

  async getPaymentStatus(codeQR: any, clientIp?: string, userAgent?: string): Promise<any> {
    const { transactionId } = codeQR;
    const messageId = this.generateMessageId();
    const startTime = Date.now();

    this.logger.verbose(`Consultando estado de pago: ${JSON.stringify(transactionId)}`);

    // Crear registro de consulta de estado
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'GET_STATUS',
      status: 'PENDING',
      clientIp,
      userAgent,
      environment: process.env.NODE_ENV || 'production'
    };

    let logId: number;

    try {
      const url = `${await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_STATUS_PAYMENT_URL)}`;
      const headers = await this.httpHeadersService.getHeaders();
      
      if (!headers || !headers.Authorization || (url === null || url === undefined || url === '') || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '')) {
        throw new Error('[getPaymentStatus] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
      }

      const body = {
        RequestMessage: {
          RequestHeader: {
            Channel: 'PNP04-C001',
            RequestDate: new Date().toISOString(),
            MessageID: messageId,
            ClientID: '12345',
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

      const response = await axios.post(url, body, { headers });
      const processingTime = Date.now() - startTime;

      this.logger.debug('Response from NEQUI Consult: ' + JSON.stringify(response.data));

      // Actualizar el log con la respuesta
      await this.transactionLogService.updateTransactionLog(logId, {
        responsePayload: response.data,
        status: 'SUCCESS',
        processingTimeMs: processingTime
      });

      return response.data;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      if (logId) {
        await this.transactionLogService.updateTransactionLog(logId, {
          status: 'FAILED',
          errorMessage: error.message,
          processingTimeMs: processingTime
        });
      }
      
      throw error;
    }
  }

  async reverseTransaction(dto: ReverseTransactionDto, clientIp?: string, userAgent?: string): Promise<any> {
    const { messageId: originalMessageId, phoneNumber, value } = dto;
    const messageId = this.generateMessageId();
    const startTime = Date.now();
    
    this.logger.verbose('Sending reverse pago to NEQUI');
    this.logger.verbose(`>> ${JSON.stringify(originalMessageId)}`);
    this.logger.verbose(`>> ${JSON.stringify(phoneNumber)}`);
    this.logger.verbose(`>> ${JSON.stringify(value)}`);

    // Buscar la transacción original
    let parentTransactionId: number | undefined;
    try {
      const originalTransaction = await this.transactionLogService.getTransactionLogByMessageId(originalMessageId);
      if (originalTransaction) {
        parentTransactionId = originalTransaction.id;
      }
    } catch (error) {
      this.logger.warn(`Could not find parent transaction for reversal: ${error.message}`);
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
      environment: process.env.NODE_ENV || 'production'
    };

    let logId: number;

    try {
      const url = `${await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_REVERSE_PAYMENT_URL)}`;
      const headers = await this.httpHeadersService.getHeaders();
      
      if (!headers || !headers.Authorization || (url === null || url === undefined || url === '') || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '')) {
        throw new Error('[reverseTransaction] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
      }

      const body = {
        "RequestMessage": {
          "RequestHeader": {
            "Channel": "PNP04-C001",
            "RequestDate": new Date().toISOString(),
            "MessageID": messageId,
            "ClientID": "12345",
            "Destination": {
              "ServiceName": "ReverseServices",
              "ServiceOperation": "reverseTransaction",
              "ServiceRegion": "C001",
              "ServiceVersion": "1.0.0"
            }
          },
          "RequestBody": {
            "any": {
              "reversionRQ": {
                "phoneNumber": `${phoneNumber}`,
                "value": `${value}`,
                "code": "NIT_1",
                "messageId": `${originalMessageId}`,
                "type": "payment"
              }
            }
          }
        }
      };

      logEntry.requestPayload = body;
      
      // Registrar la reversión
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const response = await axios.post(url, body, { headers });
      const processingTime = Date.now() - startTime;

      if (!!response && response.status === 200 && response.data) {
        const { data } = response;
        const {
          StatusCode: statusCode = '',
          StatusDesc: statusDesc = ''
        } = data.ResponseMessage.ResponseHeader.Status;

        const updateData: Partial<TransactionLogEntry> = {
          responsePayload: response.data,
          nequiStatusCode: statusCode,
          nequiStatusDescription: statusDesc,
          processingTimeMs: processingTime
        };

        if (statusCode === "0") {
          updateData.status = 'SUCCESS';
          
          this.logger.debug('Solicitud de reversion realizada correctamente');

          // Actualizar la transacción original como revertida
          if (parentTransactionId) {
            await this.transactionLogService.updateTransactionLog(parentTransactionId, {
              status: 'REVERSED'
            });
          }

          await this.transactionLogService.updateTransactionLog(logId, updateData);
          return response.data;

        } else {
          updateData.status = 'FAILED';
          updateData.errorMessage = `Error ${statusCode} = ${statusDesc}`;
          
          await this.transactionLogService.updateTransactionLog(logId, updateData);
          throw new Error(`Error ${statusCode} = ${statusDesc}`);
        }
      } else {
        const updateData: Partial<TransactionLogEntry> = {
          status: 'FAILED',
          errorMessage: 'Unable to connect to Nequi, please check the information sent.',
          processingTimeMs: processingTime
        };
        
        await this.transactionLogService.updateTransactionLog(logId, updateData);
        throw new Error('Unable to connect to Nequi, please check the information sent.');
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      if (logId) {
        await this.transactionLogService.updateTransactionLog(logId, {
          status: 'FAILED',
          errorMessage: error.message,
          processingTimeMs: processingTime
        });
      }
      
      throw new Error('No se pudo realizar la reversión de la transacción a NEQUI: ' + error.message);
    }
  }

  private generateMessageId(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      const rand = Math.floor(Math.random() * chars.length);
      result += chars[rand];
    }
    return result;
  }
}

