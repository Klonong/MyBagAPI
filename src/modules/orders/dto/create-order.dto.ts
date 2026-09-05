import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  cartItemIds!: string[];

  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsOptional()
  @IsIn(['standard', 'express'])
  deliveryMethod?: string;

  @IsOptional()
  @IsIn(['card', 'bank', 'wallet'])
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
