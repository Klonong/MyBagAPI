import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateHomeContentDto } from './dto/home-content.dto';
import { HomeContentService } from './home-content.service';

@Controller('home-content')
export class HomeContentController {
  constructor(private readonly homeContentService: HomeContentService) {}

  /** Public — the storefront reads this on every home page render. */
  @Get()
  get() {
    return this.homeContentService.get();
  }

  @Put()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  update(@Body() dto: UpdateHomeContentDto) {
    return this.homeContentService.update(dto.content);
  }
}
