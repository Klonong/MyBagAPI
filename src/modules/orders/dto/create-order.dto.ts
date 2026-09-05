import {
  IsArray,
  IsIn,
  IsOptional,
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
}
