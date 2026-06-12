import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'minsoo@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'strong-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
