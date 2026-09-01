import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsInt()
  colorId?: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}
