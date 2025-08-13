import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ObtenerInformacionEstacionService } from '../informacion.eds.service';

@Injectable()
export class PosAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PosAuthMiddleware.name);
  constructor(
    private readonly informacionEstacionService: ObtenerInformacionEstacionService,
  ) {}

  use = async (req: Request, res: Response, next: NextFunction) => {
    const clientIp = this.getClientIp(req);
    const stationCode =
      typeof req.headers['x-station-code'] === 'string'
        ? req.headers['x-station-code']
        : Array.isArray(req.headers['x-station-code'])
        ? req.headers['x-station-code'][0]
        : '';
    const equipmentCode =
      typeof req.headers['x-equipment-code'] === 'string'
        ? req.headers['x-equipment-code']
        : Array.isArray(req.headers['x-equipment-code'])
        ? req.headers['x-equipment-code'][0]
        : '';
    const isAuthorized = await this.validateCodes(stationCode, equipmentCode);

    if (!isAuthorized) {
      this.logger.log(`Send push notification request from IP: ${clientIp}`);
      this.logger.error(
        `POS no autorizado: Estacion ${stationCode}, Equipo ${equipmentCode}`,
      );
      throw new UnauthorizedException('POS no autorizado');
    }
    next();
  };

  async validateCodes(station: string, island: string): Promise<boolean> {
    try {
      const stationInfo =
        await this.informacionEstacionService.obtenerInformacionEstacion(
          parseInt(station),
          parseInt(island),
        );
      if (!stationInfo) {
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Error validating station and equipment codes: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Extrae la IP real del cliente considerando proxies y load balancers
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const realIp = request.headers['x-real-ip'];
    const clientIp =
      request.connection?.remoteAddress || request.socket?.remoteAddress;

    if (forwarded) {
      // x-forwarded-for puede contener múltiples IPs separadas por comas
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }

    if (realIp) {
      return realIp as string;
    }

    return clientIp || 'unknown';
  }
}
