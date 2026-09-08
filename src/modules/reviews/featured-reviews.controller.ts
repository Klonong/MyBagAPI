import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

/**
 * Public, catalogue-wide reviews used by the storefront testimonial wall.
 * Kept on its own controller because ReviewsController is nested under
 * /products/:productId.
 */
@Controller('reviews')
export class FeaturedReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('featured')
  featured(
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit: number,
  ) {
    return this.reviewsService.featured(limit);
  }
}
