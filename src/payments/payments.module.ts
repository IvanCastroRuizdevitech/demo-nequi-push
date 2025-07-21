import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuthModule } from '../auth/auth.module'; 
import { CommonModule } from '../common/common.module';
import { HttpHeadersService  } from '../common/services/http-headers.service';

@Module({
  imports: [
      AuthModule,
      CommonModule
    ],
  providers: [PaymentsService, HttpHeadersService],
  controllers: [PaymentsController]
})
export class PaymentsModule {}
