import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // 👈 Faltaba esto
import { PaymentsQrController } from './payments-qr.controller';
import { PaymentsQrService } from './payments-qr.service';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { HttpHeadersService } from '../common/services/http-headers.service';

@Module({
  imports: [
      HttpModule, 
      AuthModule, 
      CommonModule
    ],
  controllers: [PaymentsQrController],
  providers: [PaymentsQrService, HttpHeadersService],
})
export class PaymentsQrModule {}
