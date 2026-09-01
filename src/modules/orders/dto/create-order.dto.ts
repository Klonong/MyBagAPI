import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsOptional()
  @IsIn(['standard', 'express'])
  deliveryMethod?: string;

  @IsOptional()
  @IsIn(['card', 'bank', 'wallet'])
  paymentMethod?: string;
}
