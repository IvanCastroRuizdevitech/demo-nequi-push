import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly httpService: HttpService,
  ) {}

  async getToken(): Promise<string | null> {

    const clientId = process.env.NEQUI_CLIENT_ID!;
    const clientSecret = process.env.NEQUI_CLIENT_SECRET!;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const headers = {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };

    const url = process.env.NEQUI_AUTH_URI!;

    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.post(url, null, { headers }),
      );
      return response.data.access_token;
    } catch (error) {
      this.logger.error('Error al obtener token Nequi', error?.response?.data || error.message);
      return null;
    }
  }
}
