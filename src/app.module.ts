import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PaymentsModuleEnhanced } from './payments/payments.module.enhanced';
import { DatabaseModule } from './database/database.module';
import { PaymentsQrModuleEnhanced } from './payments-qr/payments-qr.module.enhanced';
import { PosAuthMiddleware } from './common/middleware/pos-auth.middleware';
import { ObtenerInformacionEstacionService } from './common/informacion.eds.service';
import { TransactionLogModule } from './transaction-log/transaction-log.module';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    PaymentsModuleEnhanced,
    PaymentsQrModuleEnhanced,
    TransactionLogModule,
  ],
  controllers: [],
  providers: [ObtenerInformacionEstacionService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PosAuthMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
