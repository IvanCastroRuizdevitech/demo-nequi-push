import { Controller, Post, Body, Param, Get, Req, Logger } from '@nestjs/common';
import { PaymentsQrServiceEnhanced } from './payments-qr.service.enhanced';
import { SendPushNotificationDto } from './dto/send-push.dto';
import { Request } from 'express';

@Controller('payments-qr')
export class PaymentsQrControllerEnhanced {
  private readonly logger = new Logger(PaymentsQrControllerEnhanced.name);

  constructor(private readonly pagosQrService: PaymentsQrServiceEnhanced) {}

  @Post('crear-qr')
  async crearQr(
    @Body() dto: SendPushNotificationDto,
    @Req() request: Request
  ): Promise<any> {
    try {
      const clientIp = this.getClientIp(request);
      const userAgent = request.headers['user-agent'];
      
      this.logger.log(`Create QR request from IP: ${clientIp} for phone: ${dto.phoneNumber}`);
      
      return await this.pagosQrService.crearQr(dto, clientIp, userAgent);
    } catch (error) {
      this.logger.error(`Error in create QR: ${error.message}`);
      throw error;
    }
  }

  @Get('estado-qr/:qrId')
  async consultarEstadoQr(
    @Param('qrId') qrId: string,
    @Req() request: Request
  ): Promise<any> {
    try {
      const clientIp = this.getClientIp(request);
      const userAgent = request.headers['user-agent'];
      
      this.logger.log(`Get QR status request from IP: ${clientIp} for QR: ${qrId}`);
      
      return await this.pagosQrService.consultarEstadoQr(qrId, clientIp, userAgent);
    } catch (error) {
      this.logger.error(`Error in get QR status: ${error.message}`);
      throw error;
    }
  }

  @Post('cancelar-qr/:qrId')
  async cancelarQr(
    @Param('qrId') qrId: string,
    @Req() request: Request
  ): Promise<any> {
    try {
      const clientIp = this.getClientIp(request);
      const userAgent = request.headers['user-agent'];
      
      this.logger.log(`Cancel QR request from IP: ${clientIp} for QR: ${qrId}`);
      
      return await this.pagosQrService.cancelarQr(qrId, clientIp, userAgent);
    } catch (error) {
      this.logger.error(`Error in cancel QR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extrae la IP real del cliente considerando proxies y load balancers
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const realIp = request.headers['x-real-ip'];
    const clientIp = request.connection?.remoteAddress || request.socket?.remoteAddress;

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

