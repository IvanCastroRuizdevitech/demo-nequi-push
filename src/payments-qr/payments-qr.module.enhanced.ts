import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentsQrControllerEnhanced } from './payments-qr.controller.enhanced';
import { PaymentsQrServiceEnhanced } from './payments-qr.service.enhanced';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { HttpHeadersService } from '../common/services/http-headers.service';
import { TransactionLogModule } from '../transaction-log/transaction-log.module';

@Module({
  imports: [
      HttpModule, 
      AuthModule, 
      CommonModule,
      TransactionLogModule
    ],
  controllers: [PaymentsQrControllerEnhanced],
  providers: [PaymentsQrServiceEnhanced, HttpHeadersService],
  exports: [PaymentsQrServiceEnhanced]
})
export class PaymentsQrModuleEnhanced {}

