import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'minsoo@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Minsoo Kim', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'strong-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
