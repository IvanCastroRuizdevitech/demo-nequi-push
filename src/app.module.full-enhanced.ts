import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PaymentsModuleEnhanced } from './payments/payments.module.enhanced';
import { PaymentsQrModuleEnhanced } from './payments-qr/payments-qr.module.enhanced';
import { DatabaseModule } from './database/database.module';
import { TransactionLogModule } from './transaction-log/transaction-log.module';

@Module({
  imports: [
              AuthModule, 
              PaymentsModuleEnhanced,
              PaymentsQrModuleEnhanced,
              DatabaseModule,
              TransactionLogModule
    ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModuleFullEnhanced {}

