import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PaymentsModuleEnhanced } from './payments/payments.module.enhanced';
import { DatabaseModule } from './database/database.module';
import { PaymentsQrModule } from './payments-qr/payments-qr.module';
import { TransactionLogModule } from './transaction-log/transaction-log.module';

@Module({
  imports: [
              AuthModule, 
              PaymentsModuleEnhanced,
              DatabaseModule,
              PaymentsQrModule,
              TransactionLogModule
    ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModuleEnhanced {}

