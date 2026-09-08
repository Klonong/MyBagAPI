import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FeaturedReviewsController } from './featured-reviews.controller';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [AuthModule],
  controllers: [FeaturedReviewsController, ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
