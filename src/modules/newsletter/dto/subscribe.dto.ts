import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubscribeDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  /** Which surface the signup came from, e.g. "footer" or "home". */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;
}
