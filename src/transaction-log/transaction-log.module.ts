import { Module } from '@nestjs/common';
import { TransactionLogService } from './transaction-log.service';
import { TransactionLogController } from './transaction-log.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [TransactionLogService],
  controllers: [TransactionLogController],
  exports: [TransactionLogService],
})
export class TransactionLogModule {}
