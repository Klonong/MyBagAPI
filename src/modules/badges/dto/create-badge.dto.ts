import { IsString, MaxLength } from 'class-validator';

export class CreateBadgeDto {
  @IsString()
  @MaxLength(255)
  name!: string;
}
