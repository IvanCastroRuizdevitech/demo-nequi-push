import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { HttpModule } from '@nestjs/axios';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [HttpModule, CommonModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
