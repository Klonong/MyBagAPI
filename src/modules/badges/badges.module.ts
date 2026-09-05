import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';

@Module({
  imports: [AuthModule],
  controllers: [BadgesController],
  providers: [BadgesService],
})
export class BadgesModule {}
