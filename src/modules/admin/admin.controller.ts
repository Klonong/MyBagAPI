import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AdminOrderQueryDto,
  CustomerQueryDto,
  UpdateCustomerStatusDto,
  UpdateOrderStatusDto,
  UpdateSettingsDto,
} from './dto/admin.dto';
import {
  CreateDiscountDto,
  DiscountQueryDto,
  UpdateDiscountDto,
} from './dto/discount.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('discounts')
  listDiscounts(@Query() query: DiscountQueryDto) {
    return this.adminService.listDiscounts(query);
  }

  @Post('discounts')
  createDiscount(@Body() dto: CreateDiscountDto) {
    return this.adminService.createDiscount(dto);
  }

  @Patch('discounts/:id')
  updateDiscount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.adminService.updateDiscount(id, dto);
  }

  @Delete('discounts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDiscount(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteDiscount(id);
  }

  @Get('orders')
  listOrders(@Query() query: AdminOrderQueryDto) {
    return this.adminService.listOrders(query);
  }

  @Get('orders/:id')
  getOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getOrder(id);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(id, dto);
  }

  @Get('customers')
  listCustomers(@Query() query: CustomerQueryDto) {
    return this.adminService.listCustomers(query);
  }

  @Get('customers/:id')
  getCustomer(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getCustomer(id);
  }

  @Patch('customers/:id/status')
  updateCustomerStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    return this.adminService.updateCustomerStatus(id, dto);
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.adminService.updateSettings(dto);
  }
}
