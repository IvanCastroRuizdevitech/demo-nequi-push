import { Controller, Post, Body, Get, Param, Req, Logger } from '@nestjs/common';
import { PaymentsServiceEnhanced } from './payments.service.enhanced';
import { SendPushNotificationDto, CancelPushNotificationDto, ReverseTransactionDto } from './dto/send-push.dto';
import { Request } from 'express';

@Controller('payments-enhanced')
export class PaymentsControllerEnhanced {
  private readonly logger = new Logger(PaymentsControllerEnhanced.name);

  constructor(private readonly paymentsService: PaymentsServiceEnhanced) {}

  @Post('send-push')
  async sendPushNotification(
    @Body() dto: SendPushNotificationDto,
    @Req() request: Request
  ): Promise<any> {
    try {
      const clientIp = this.getClientIp(request);
      const userAgent = request.headers['user-agent'];
      
      this.logger.log(`Send push notification request from IP: ${clientIp}`);
      
      return await this.paymentsService.sendPushNotification(dto, clientIp, userAgent);
    } catch (error) {
      this.logger.error(`Error in send push notification: ${error.message}`);
      throw error;
    }
  }

  @Post('cancel-push')
  async cancelPushNotification(
    @Body() dto: CancelPushNotificationDto,
    @Req() request: Request
  ): Promise<any> {
    try {
      const clientIp = this.getClientIp(request);
      const userAgent = request.headers['user-agent'];
      
      this.logger.log(`Cancel push notification request from IP: ${clientIp}`);
      
      return await this.paymentsService.cancelPushNotification(dto, clientIp, userAgent);
    } catch (error) {
      this.logger.error(`Error in cancel push notification: ${error.message}`);
      throw error;
    }
  }

  @Get('status/:transactionId')
  async getPaymentStatus(
    @Param('transactionId') transactionId: string,
    @Req() request: Request
  ): Promise<any> {
    try {
      const clientIp = this.getClientIp(request);
      const userAgent = request.headers['user-agent'];
      
      this.logger.log(`Get payment status request from IP: ${clientIp} for transaction: ${transactionId}`);
      
      return await this.paymentsService.getPaymentStatus({ transactionId }, clientIp, userAgent);
    } catch (error) {
      this.logger.error(`Error in get payment status: ${error.message}`);
      throw error;
    }
  }

  @Post('reverse')
  async reverseTransaction(
    @Body() dto: ReverseTransactionDto,
    @Req() request: Request
  ): Promise<any> {
    try {
      const clientIp = this.getClientIp(request);
      const userAgent = request.headers['user-agent'];
      
      this.logger.log(`Reverse transaction request from IP: ${clientIp}`);
      
      return await this.paymentsService.reverseTransaction(dto, clientIp, userAgent);
    } catch (error) {
      this.logger.error(`Error in reverse transaction: ${error.message}`);
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

