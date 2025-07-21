import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { PaymentsQrService } from './payments-qr.service';
import { SendPushNotificationDto, CancelPushNotificationDto, ReverseTransactionDto } from './dto/send-push.dto';

@Controller('payments-qr')
export class PaymentsQrController {
  constructor(private readonly pagosService: PaymentsQrService) {}

  @Post('crear-qr')
  async crearQr(@Body() dto: SendPushNotificationDto) {
    return this.pagosService.crearQr(dto);
  }

  @Get('estado-qr')
  async consultarEstadoQr(@Body() qrId: string) {
    return this.pagosService.consultarEstadoQr(qrId);
  }

  @Post('cancelar-qr/:qrId')
  async cancelarQr(@Param('qrId') qrId: string) {
    return this.pagosService.cancelarQr(qrId);
  }
}