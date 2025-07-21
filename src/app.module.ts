import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { DatabaseModule } from './database/database.module';
import { PaymentsQrModule } from './payments-qr/payments-qr.module';

@Module({
  imports: [
              AuthModule, 
              PaymentsModule,
              DatabaseModule,
              PaymentsQrModule 
    ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
