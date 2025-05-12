import { Injectable, Logger } from '@nestjs/common';
import { SendPushNotificationDto, CancelPushNotificationDto, ReverseTransactionDto } from './dto/send-push.dto';
import axios from 'axios';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly authService: AuthService) {}

  private async getHeaders(): Promise<any> {
    const token = await this.authService.getToken();
    return {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NEQUI_API_KEY,
      Authorization: `Bearer ${token}`,
    };
  }

  async sendPushNotification(dto: SendPushNotificationDto): Promise<any> {
    this.logger.verbose('Sending push notification to NEQUI');
    const codeSucces: string = "0";
    const payload = {
      RequestMessage: {
        RequestHeader: {
          Channel: 'PNP04-C001',
          RequestDate: new Date().toISOString(),
          MessageID: this.generateMessageId(),
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

    const url =  process.env.NEQUI_API_BASE_PATH! + process.env.NEQUI_UNREGISTERED_PAYMENT_URL!;
    const headers = await this.getHeaders();

    if (!headers || !headers.Authorization || (url === null || url === undefined || url === '')  || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '') ) {
      throw new Error('[sendPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
    }
    
    try {
        const response = await axios.post(url, payload, { headers });
        this.logger.debug('Response from NEQUI Sending: ' + JSON.stringify(response.data));
        if (!!response && response.status === 200 && response.data) {
          const { data } = response;
          const {
              StatusCode:statusCode = '',
              StatusDesc:statusDesc = ''
          } = data.ResponseMessage.ResponseHeader.Status;

          if (statusCode === codeSucces) {
              const {
                  transactionId = ''
              } = data.ResponseMessage.ResponseBody.any.unregisteredPaymentRS;

              this.logger.debug(
                  'Solicitud de pago realizada correctamente\n' +
                  `- Id Transacción -> ${transactionId.trim()}`
              );

              return response.data;

          } else {
              throw new Error(`Error ${statusCode} = ${statusDesc}`)
          }
        } else {
            throw new Error('Unable to connect to Nequi, please check the information sent.');
        }

    } catch (error) {
      throw new Error('No se pudo realizar la solicitud a NEQUI: ' + error.message);
    }
  }

  async cancelPushNotification(dto: CancelPushNotificationDto): Promise<any> {
    const { transactionId, phoneNumber } = dto;
    const codeSucces: string = "0";
    this.logger.verbose('Sending cancel notification to NEQUI');
    this.logger.verbose(`>> ${JSON.stringify(transactionId)}`);
    this.logger.verbose(`>> ${JSON.stringify(phoneNumber)}`);
        
    const url = `${process.env.NEQUI_API_BASE_PATH}/payments/v2/-services-paymentservice-cancelunregisteredpayment`;
    const headers = await this.getHeaders();
    if (!headers || !headers.Authorization || (url === null || url === undefined || url === '')  || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '') ) {
      throw new Error('[sendPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
    }

    try {
      const body = {
        "RequestMessage": {
          "RequestHeader": {
            "Channel": "PNP04-C001",
            "RequestDate": new Date().toISOString(),
            "MessageID": this.generateMessageId(),
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
      
      const response = await axios.post(
        url,
        body,
        { headers },
      );

      if (!!response && response.status === 200 && response.data) {
          const { data } = response;
          const {
              StatusCode:statusCode = '',
              StatusDesc:statusDesc = ''
          } = data.ResponseMessage.ResponseHeader.Status;

          if (statusCode === codeSucces) {
              this.logger.debug(
                  'Solicitud de cancelacion realizada correctamente\n' +
                  `- Id Transacción -> ${transactionId.trim()}`
              );

              return response.data;

          } else {
              throw new Error(`Error ${statusCode} = ${statusDesc}`)
          }
        } else {
            throw new Error('Unable to connect to Nequi, please check the information sent.');
        }


    } catch (error) {
      throw new Error('No se pudo realizar la cancelacion a NEQUI: ' + error.message);
    }
  }

  async getPaymentStatus(codeQR: any): Promise<any> {

    const { transactionId } = codeQR;

    this.logger.verbose(`Consultando estado de pago: ${JSON.stringify(transactionId)}`);
    const url =  `${process.env.NEQUI_API_BASE_PATH}/payments/v2/-services-paymentservice-getstatuspayment`;
    const headers = await this.getHeaders();
    if (!headers || !headers.Authorization || (url === null || url === undefined || url === '')  || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '') ) {
      throw new Error('[sendPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
    }

    const body = {
      RequestMessage: {
        RequestHeader: {
          Channel: 'PNP04-C001',
          RequestDate: new Date().toISOString(),
          MessageID: this.generateMessageId(),
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

    const response = await axios.post(
      url,
      body,
      { headers },
    );

    this.logger.debug('Response from NEQUI Consult: ' + JSON.stringify(response.data));

    return response.data;
  }

  async reverseTransaction(dto: ReverseTransactionDto): Promise<any> {
    const { messageId, phoneNumber, value } = dto;
    const codeSucces: string = "0";
    this.logger.verbose('Sending reverse pago to NEQUI');
    this.logger.verbose(`>> ${JSON.stringify(messageId)}`);
    this.logger.verbose(`>> ${JSON.stringify(phoneNumber)}`);
    this.logger.verbose(`>> ${JSON.stringify(value)}`);
    const url = `${process.env.NEQUI_API_BASE_PATH}/payments/v2/-services-reverseservices-reversetransaction`;
    const headers = await this.getHeaders();
    if (!headers || !headers.Authorization || (url === null || url === undefined || url === '')  || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '') ) {
      throw new Error('[sendPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
    }

    try {
      const body = {
        "RequestMessage": {
          "RequestHeader": {
            "Channel": "PNP04-C001",
            "RequestDate": new Date().toISOString(),
            "MessageID": this.generateMessageId(),
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
                "messageId": `${messageId}`,
                "type": "payment"
              }
            }
          }
        }
      };

      const response = await axios.post(
        url,
        body,
        { headers },
      );
      
      if (!!response && response.status === 200 && response.data) {
          const { data } = response;
          const {
              StatusCode:statusCode = '',
              StatusDesc:statusDesc = ''
          } = data.ResponseMessage.ResponseHeader.Status;

          if (statusCode === codeSucces) {
              this.logger.debug(
                  'Solicitud de reversion realizada correctamente'
              );

              return response.data;

          } else {
              throw new Error(`Error ${statusCode} = ${statusDesc}`)
          }
      } else {
            throw new Error('Unable to connect to Nequi, please check the information sent.');
      }    
    } catch (error) {
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
