import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Req,
  Logger,
} from '@nestjs/common';
import { PaymentsQrServiceEnhanced } from './payments-qr.service.enhanced';
import {
  SendPushNotificationDto,
  ReverseTransactionDto,
} from './dto/send-push.dto';
import { ResponseHandler } from '../common/response.handler';
import { Request } from 'express';

@Controller('payments-qr-enhanced')
export class PaymentsQrControllerEnhanced {
  private readonly logger = new Logger(PaymentsQrControllerEnhanced.name);

  constructor(private readonly pagosQrService: PaymentsQrServiceEnhanced) {}

  @Post('crear-qr')
  async crearQr(
    @Body() dto: SendPushNotificationDto,
    @Req() request: Request,
  ): Promise<any> {
    try {
      const { clientIp, userAgent, stationCode, equipmentCode } =
        this.getRequestMetadata(request);
      this.logger.log(
        `Create QR request from IP: ${clientIp} for phone: ${dto.phoneNumber} Station: ${stationCode}, Equipment: ${equipmentCode}`,
      );

      return await this.pagosQrService.crearQr(
        dto,
        clientIp,
        userAgent,
        stationCode,
        equipmentCode,
      );
    } catch (error) {
      this.logger.error(`Error in create QR: ${error.message}`);
      throw error;
    }
  }

  @Get('estado-qr/:qrId')
  async consultarEstadoQr(
    @Param('qrId') qrId: string,
    @Req() request: Request,
  ): Promise<any> {
    try {
      const { clientIp, userAgent, stationCode, equipmentCode } =
        this.getRequestMetadata(request);
      this.logger.log(
        `Get QR status request from IP: ${clientIp} for QR: ${qrId} Station: ${stationCode}, Equipment: ${equipmentCode}`,
      );

      return await this.pagosQrService.consultarEstadoQr(
        qrId,
        clientIp,
        userAgent,
        stationCode,
        equipmentCode,
      );
    } catch (error) {
      this.logger.error(`Error in get QR status: ${error.message}`);
      throw error;
    }
  }

  @Post('reverse')
  async reverseTransaction(
    @Body() dto: ReverseTransactionDto,
    @Req() request: Request,
  ): Promise<any> {
    try {
      const { clientIp, userAgent, stationCode, equipmentCode } =
        this.getRequestMetadata(request);
      this.logger.log(
        `Reverse transaction request from IP: ${clientIp} for transaction: ${JSON.stringify(
          dto,
        )} Station: ${stationCode}, Equipment: ${equipmentCode}`,
      );

      return await this.pagosQrService.reverseTransaction(
        dto,
        clientIp,
        userAgent,
        stationCode,
        equipmentCode,
      );
    } catch (error) {
      this.logger.error(`Error in reverse transaction: ${error.message}`);
      return ResponseHandler.error(error, 'Error in reverse transaction');
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

  private getRequestMetadata(request: Request) {
    const clientIp = this.getClientIp(request);
    const userAgent = request.headers['user-agent'] || '';
    const stationCode = Array.isArray(request.headers['x-station-code'])
      ? request.headers['x-station-code'][0]
      : (request.headers['x-station-code'] as string) || '';
    const equipmentCode = Array.isArray(request.headers['x-equipment-code'])
      ? request.headers['x-equipment-code'][0]
      : (request.headers['x-equipment-code'] as string) || '';

    return { clientIp, userAgent, stationCode, equipmentCode };
  }
}
