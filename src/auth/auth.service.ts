import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { ParametrosService } from '../common/parametros.service';
import { ImplementacionNequi } from '../common/enums';

import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly parametrosService: ParametrosService,
  ) {}

  async getToken(): Promise<string | null> {
    Logger.log('Iniciando obtención de token Nequi');
    try {
      const clientId = await this.parametrosService.obtenerValorParametro(
        ImplementacionNequi.NEQUI_CLIENT_ID,
      );
      const clientSecret = await this.parametrosService.obtenerValorParametro(
        ImplementacionNequi.NEQUI_CLIENT_SECRET,
      );
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64',
      );
      const url = await this.parametrosService.obtenerValorParametro(
        ImplementacionNequi.NEQUI_AUTH_URI,
      );

      const headers = {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      };

      if (!url || !clientId || !clientSecret || !credentials) {
        this.logger.error('La configuración de Nequi no es válida');
        return null;
      }

      try {
        const response: AxiosResponse = await firstValueFrom(
          this.httpService.post(url, null, { headers }),
        );
        Logger.log('Token Nequi obtenido con éxito');
        return response.data.access_token;
      } catch (error) {
        this.logger.error(
          'Error al obtener token Nequi',
          error?.response?.data || error.message,
        );
        return null;
      }
    } catch (error) {
      this.logger.error(
        'Error al obtener token Nequi',
        error?.response?.data || error.message,
      );
      return null;
    }
  }
}
