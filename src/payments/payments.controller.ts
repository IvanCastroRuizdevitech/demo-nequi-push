import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SendPushNotificationDto, CancelPushNotificationDto, ReverseTransactionDto } from './dto/send-push.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Payments') // Este será el título de tu grupo en Swagger UI
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('push')
  @ApiOperation({ summary: 'Enviar notificación push a Nequi' })
  @ApiResponse({ status: 200, description: 'Notificación enviada correctamente' })
  @ApiBody({ type: SendPushNotificationDto })
  async sendPushNotification(@Body() dto: SendPushNotificationDto) {
    return this.paymentsService.sendPushNotification(dto);
  }

  @Post('push/cancel')
  @ApiOperation({ summary: 'Cancelar notificación push' })
  @ApiBody({ type: CancelPushNotificationDto })
  @ApiResponse({ status: 200, description: 'Notificación cancelada correctamente' })
  async cancelPushNotification(@Body() dto: CancelPushNotificationDto) {
    return this.paymentsService.cancelPushNotification(dto);
  }

  @Get('push')
  @ApiOperation({ summary: 'Obtener estado de pago' })
  @ApiBody({ schema: { type: 'string', example: '350-12345-37114447-cb760a08-fa39-43e6-9724-be1881f' } })
  @ApiResponse({ status: 200, description: 'Estado de pago obtenido correctamente' })
  async getPaymentStatus(@Body() transactionId: string) {
    return this.paymentsService.getPaymentStatus(transactionId);
  }

  @Post('push/reverse')
  @ApiOperation({ summary: 'Reversar transacción' })
  @ApiBody({ type: ReverseTransactionDto })
  @ApiResponse({ status: 200, description: 'Transacción reversada correctamente' })
  async reverseTransaction(@Body() dto: ReverseTransactionDto) {
    return this.paymentsService.reverseTransaction(dto);
  }
}
