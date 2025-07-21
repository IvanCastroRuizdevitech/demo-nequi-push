import { Injectable, Logger } from '@nestjs/common';
import { SendPushNotificationDto } from './dto/send-push.dto';
import axios from 'axios';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ParametrosService } from '../common/parametros.service';
import { ImplementacionNequi } from '../common/enums'
import { HttpHeadersService  } from '../common/services/http-headers.service';
import { TransactionLogService, TransactionLogEntry } from '../transaction-log/transaction-log.service';

@Injectable()
export class PaymentsQrServiceEnhanced {
  private readonly logger = new Logger(PaymentsQrServiceEnhanced.name);
  
  constructor(
    private readonly httpService: HttpService,
    private readonly parametrosService: ParametrosService,
    private readonly httpHeadersService: HttpHeadersService,
    private readonly transactionLogService: TransactionLogService
  ) {}

  async crearQr(dto: SendPushNotificationDto, clientIp?: string, userAgent?: string): Promise<any> {
    const messageId = this.generateMessageId();
    const startTime = Date.now();
    
    this.logger.verbose('Sending push notification QR to NEQUI #', dto.phoneNumber);
    
    // Crear registro inicial de transacción QR
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'SEND_PUSH', // Reutilizamos el tipo para QR
      phoneNumber: dto.phoneNumber,
      amount: dto.value,
      status: 'PENDING',
      clientIp,
      userAgent,
      reference1: 'reference1',
      reference2: 'reference2',
      reference3: 'reference3',
      environment: process.env.NODE_ENV || 'production',
      internalReference: `QR_${messageId}` // Identificador específico para QR
    };

    let logId: number;
    
    try {
      const payload = {
        RequestMessage: {
          RequestHeader: {
            Channel: 'PQR03-C001',
            RequestDate: new Date().toISOString(),
            MessageID: messageId,
            ClientID: '12345',
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
                reference1: 'reference1',
                reference2: 'reference2',
                reference3: 'reference3',
              },
            },
          },
        },
      };

      logEntry.requestPayload = payload;
      
      // Registrar la transacción QR inicial
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const basePath = await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_PAYMENTS_QR_URL);
      if (!basePath) {
        throw new Error('[crearQr] No se pudo obtener la basePath o paymenteUrlQr NEQUI.');
      }

      const url = `${basePath}`;
      const headers = await this.httpHeadersService.getHeaders();
      
      if (!headers || !headers.Authorization || (url === null || url === undefined || url === '') || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '')) {
        throw new Error('[crearQr] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
      }

      const response = await axios.post(url, payload, { headers });
      const processingTime = Date.now() - startTime;
      
      this.logger.debug('Response from QR NEQUI Sending: ' + JSON.stringify(response.data));

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
          const codeQR = data?.ResponseMessage?.ResponseBody?.any?.generateCodeQRRS?.qrValue || '';
          
          updateData.transactionId = codeQR; // Usamos el código QR como transaction ID
          updateData.status = 'SUCCESS';

          this.logger.debug(
            'Código QR generado correctamente\n' +
            `- Código QR -> ${codeQR}`
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
      
      throw new Error('No se pudo realizar la solicitud a QR NEQUI: ' + error.message);
    }
  }

  async consultarEstadoQr(qrId: string, clientIp?: string, userAgent?: string): Promise<any> {
    const messageId = this.generateMessageId();
    const startTime = Date.now();
    
    this.logger.verbose(`Consultando estado de pago QR con ID: ${JSON.stringify(qrId)}`);

    // Crear registro de consulta de estado QR
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'GET_STATUS',
      status: 'PENDING',
      clientIp,
      userAgent,
      environment: process.env.NODE_ENV || 'production',
      internalReference: `QR_STATUS_${qrId}`
    };

    let logId: number;

    try {
      const url = await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_STATUS_PAYMENTS_QR_URL);
      const headers = await this.httpHeadersService.getHeaders();
      
      if (!headers || !headers.Authorization || (url === null || url === undefined || url === '') || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '')) {
        throw new Error('[consultarEstadoQr] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
      }

      // Crear el payload para la consulta de estado
      const requestPayload = {
        url: url,
        method: 'GET',
        qrId: qrId
      };

      logEntry.requestPayload = requestPayload;
      
      // Registrar la consulta
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const response = await firstValueFrom(
        this.httpService.get(url, { headers })
      );
      
      const processingTime = Date.now() - startTime;

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

  async cancelarQr(qrId: string, clientIp?: string, userAgent?: string): Promise<any> {
    const messageId = this.generateMessageId();
    const startTime = Date.now();
    
    this.logger.verbose(`Cancelando código QR con ID: ${JSON.stringify(qrId)}`);

    // Buscar la transacción QR original para establecer la relación padre-hijo
    let parentTransactionId: number | undefined;
    try {
      const originalTransactions = await this.transactionLogService.getTransactionLogs({
        transactionId: qrId,
        operationType: 'SEND_PUSH'
      });
      if (originalTransactions.length > 0) {
        parentTransactionId = originalTransactions[0].id;
      }
    } catch (error) {
      this.logger.warn(`Could not find parent QR transaction for cancellation: ${error.message}`);
    }

    // Crear registro de cancelación QR
    const logEntry: TransactionLogEntry = {
      messageId,
      operationType: 'CANCEL_PUSH',
      status: 'PENDING',
      clientIp,
      userAgent,
      parentTransactionId,
      environment: process.env.NODE_ENV || 'production',
      internalReference: `QR_CANCEL_${qrId}`
    };

    let logId: number;

    try {
      const url = await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_REVERSE_PAYMENTS_QR_URL);
      const headers = await this.httpHeadersService.getHeaders();
      
      if (!headers || !headers.Authorization || (url === null || url === undefined || url === '') || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '')) {
        throw new Error('[cancelarQr] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
      }

      const requestPayload = {
        url: url,
        method: 'POST',
        qrId: qrId
      };

      logEntry.requestPayload = requestPayload;
      
      // Registrar la cancelación
      logId = await this.transactionLogService.createTransactionLog(logEntry);

      const response = await firstValueFrom(
        this.httpService.post(url, {}, { headers })
      );
      
      const processingTime = Date.now() - startTime;

      // Actualizar el log de cancelación
      await this.transactionLogService.updateTransactionLog(logId, {
        responsePayload: response.data,
        status: 'SUCCESS',
        processingTimeMs: processingTime
      });

      // También actualizar la transacción QR original como cancelada
      if (parentTransactionId) {
        await this.transactionLogService.updateTransactionLog(parentTransactionId, {
          status: 'CANCELLED'
        });
      }

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

