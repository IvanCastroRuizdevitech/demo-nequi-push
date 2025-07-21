import { Module } from '@nestjs/common';
import { ParametrosService } from './parametros.service';
import { DatabaseService } from '../database/database.service';

@Module({
  providers: [ParametrosService, DatabaseService],
  exports: [ParametrosService],
})
export class CommonModule {}