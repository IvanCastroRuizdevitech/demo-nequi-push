import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { ParametrosService } from '../parametros.service';
import { ImplementacionNequi } from '../enums'

@Injectable()
export class HttpHeadersService {
  constructor(
    private readonly authService: AuthService,
    private readonly parametrosService: ParametrosService,
  ) {}

  async getHeaders(): Promise<Record<string, string> | null> {
    const token = await this.authService.getToken();
    if (!token) return null;

    const apiKey = await this.parametrosService.obtenerValorParametro(
        ImplementacionNequi.NEQUI_API_KEY
    );

    if (!apiKey) {
        throw new Error('NEQUI_API_KEY no encontrado');
    }

    return {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        Authorization: `Bearer ${token}`,
    };
  }
}