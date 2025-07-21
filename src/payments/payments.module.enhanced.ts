import { Module } from '@nestjs/common';
import { PaymentsServiceEnhanced } from './payments.service.enhanced';
import { PaymentsControllerEnhanced } from './payments.controller.enhanced';
import { AuthModule } from '../auth/auth.module'; 
import { CommonModule } from '../common/common.module';
import { HttpHeadersService  } from '../common/services/http-headers.service';
import { TransactionLogModule } from '../transaction-log/transaction-log.module';

@Module({
  imports: [
      AuthModule,
      CommonModule,
      TransactionLogModule
    ],
  providers: [PaymentsServiceEnhanced, HttpHeadersService],
  controllers: [PaymentsControllerEnhanced],
  exports: [PaymentsServiceEnhanced]
})
export class PaymentsModuleEnhanced {}

