import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateProductColorDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  hexCode?: string;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls!: string[];
}

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsInt()
  categoryId!: number;

  @IsOptional()
  @IsInt()
  badgeId?: number;

  @IsArray()
  @IsUrl({}, { each: true })
  productImageUrls!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductColorDto)
  colors!: CreateProductColorDto[];
}
