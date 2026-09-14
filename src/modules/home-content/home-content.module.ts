import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HomeContentController } from './home-content.controller';
import { HomeContentService } from './home-content.service';

@Module({
  imports: [AuthModule],
  controllers: [HomeContentController],
  providers: [HomeContentService],
})
export class HomeContentModule {}
