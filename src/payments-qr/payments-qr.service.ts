import { Injectable, Logger } from '@nestjs/common';
import { SendPushNotificationDto } from './dto/send-push.dto';
import axios from 'axios';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ParametrosService } from '../common/parametros.service';
import { ImplementacionNequi } from '../common/enums'
import { HttpHeadersService  } from '../common/services/http-headers.service';

@Injectable()
export class PaymentsQrService {
  private readonly logger = new Logger(PaymentsQrService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly parametrosService: ParametrosService,
    private readonly httpHeadersService: HttpHeadersService,
  ) {}

  async crearQr(dto: SendPushNotificationDto): Promise<any> {
    this.logger.verbose('Sending push notification QR to NEQUI #', dto.phoneNumber);
    const codeSucces: string = "0";
    const payload = {
      RequestMessage: {
        RequestHeader: {
          Channel: 'PQR03-C001',
          RequestDate: new Date().toISOString(),
          MessageID: this.generateMessageId(),
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

    const basePath = await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_PAYMENTS_QR_URL);
    if (!basePath) {
      throw new Error('[sendPushNotificationQr] No se pudo obtener la basePath o paymenteUrlQr NEQUI.');
    }
    const url = `${basePath}`;
    const headers = await this.httpHeadersService.getHeaders();
    if (!headers || !headers.Authorization || (url === null || url === undefined || url === '')  || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '') ) {
      throw new Error('[sendPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
    }
    try {
        const response =  await axios.post(url, payload, { headers })
        this.logger.debug('Response from QR NEQUI Sending: ' + JSON.stringify(response.data));
        if (!!response && response.status === 200 && response.data) {
            const { data } = response;
            const {
                StatusCode:statusCode = '',
                StatusDesc:statusDesc = ''
            } = data.ResponseMessage.ResponseHeader.Status;

            if (statusCode === codeSucces) {
                const codeQR =
                  data?.ResponseMessage?.ResponseBody?.any?.generateCodeQRRS?.qrValue || '';

                console.info(
                    'Código generado correctamente\n' +
                    `- Código QR -> ${codeQR}`
                );
            } else {
                throw new Error(`Error ${statusCode} = ${statusDesc}`)
            }
        } else {
            throw new Error('Unable to connect to Nequi, please check the information sent.');
        }
      
    } catch (error) {
      throw new Error('No se pudo realizar la solicitud a QR NEQUI: ' + error.message);
    }    
  }

  async consultarEstadoQr(qrId: string): Promise<any> {
    this.logger.verbose(
      `Consultando estado de pago QR con ID: ${JSON.stringify(qrId)}`,
    );
    
    const url = await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_STATUS_PAYMENTS_QR_URL);
    const headers = await this.httpHeadersService.getHeaders();
    if (!headers || !headers.Authorization || (url === null || url === undefined || url === '')  || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '') ) {
      throw new Error('[sendPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
    }

    const response = await firstValueFrom(
      this.httpService.get(url, { headers }),
    );

    return response.data;
  }

  async cancelarQr(qrId: string): Promise<any> {
    const url = await this.parametrosService.obtenerValorParametro(ImplementacionNequi.NEQUI_REVERSE_PAYMENTS_QR_URL);
    const headers = await this.httpHeadersService.getHeaders();
    if (!headers || !headers.Authorization || (url === null || url === undefined || url === '')  || (headers["x-api-key"] === null || headers["x-api-key"] === undefined || headers["x-api-key"] === '') ) {
      throw new Error('[sendPushNotification] No se pudo obtener el token de autenticación o la URL de NEQUI no está definida.');
    }

    const response = await firstValueFrom(
      this.httpService.post(url, {}, { headers }),
    );

    return response.data;
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