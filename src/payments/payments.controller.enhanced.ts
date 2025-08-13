import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  Logger,
} from '@nestjs/common';
import { PaymentsServiceEnhanced } from './payments.service.enhanced';
import {
  SendPushNotificationDto,
  CancelPushNotificationDto,
  ReverseTransactionDto,
} from './dto/send-push.dto';
import { ResponseHandler } from '../common/response.handler';
import { Request } from 'express';

@Controller('payments-enhanced')
export class PaymentsControllerEnhanced {
  private readonly logger = new Logger(PaymentsControllerEnhanced.name);

  constructor(private readonly paymentsService: PaymentsServiceEnhanced) {}

  @Post('send-push')
  async sendPushNotification(
    @Body() dto: SendPushNotificationDto,
    @Req() request: Request,
  ): Promise<any> {
    try {
      const { clientIp, userAgent, stationCode, equipmentCode } =
        this.getRequestMetadata(request);
      this.logger.log(
        `Send push notification request from IP: ${clientIp} Station: ${stationCode}, Equipment: ${equipmentCode}`,
      );

      return await this.paymentsService.sendPushNotification2(
        dto,
        clientIp,
        userAgent,
        stationCode,
        equipmentCode,
      );
    } catch (error) {
      this.logger.error(`Error in send push notification: ${error.message}`);
      return ResponseHandler.error(error, 'Error in send push notification');
    }
  }

  @Post('cancel-push')
  async cancelPushNotification(
    @Body() dto: CancelPushNotificationDto,
    @Req() request: Request,
  ): Promise<any> {
    try {
      const { clientIp, userAgent, stationCode, equipmentCode } =
        this.getRequestMetadata(request);
      this.logger.log(
        `Cancel push notification request from IP: ${clientIp} for transaction: ${dto.transactionId} Station: ${stationCode}, Equipment: ${equipmentCode}`,
      );

      return await this.paymentsService.cancelPushNotification(
        dto,
        clientIp,
        userAgent,
        stationCode,
        equipmentCode,
      );
    } catch (error) {
      this.logger.error(`Error in cancel push notification: ${error.message}`);
      return ResponseHandler.error(error, 'Error in cancel push notification');
    }
  }

  @Get('status/:transactionId')
  async getPaymentStatus(
    @Param('transactionId') transactionId: string,
    @Req() request: Request,
  ): Promise<any> {
    try {
      const { clientIp, userAgent, stationCode, equipmentCode } =
        this.getRequestMetadata(request);
      this.logger.log(
        `Get payment status request from IP: ${clientIp} for transaction: ${transactionId} Station: ${stationCode}, Equipment: ${equipmentCode}`,
      );

      return await this.paymentsService.getPaymentStatus(
        { transactionId },
        clientIp,
        userAgent,
        stationCode,
        equipmentCode,
      );
    } catch (error) {
      this.logger.error(`Error in get payment status: ${error.message}`);
      return ResponseHandler.error(error, 'Error in get payment status');
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

      return await this.paymentsService.reverseTransaction(
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
