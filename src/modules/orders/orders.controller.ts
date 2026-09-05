import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query() query: OrderQueryDto) {
    return this.ordersService.list(req.user.sub, query);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findOne(req.user.sub, id);
  }

  @Post('preview')
  preview(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.preview(req.user.sub, dto);
  }

  @Post('validate-coupon')
  validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.ordersService.validateCoupon(dto.code, dto.subtotal);
  }

  @Post('summary')
  createSummary(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.createSummary(req.user.sub, dto);
  }
}
