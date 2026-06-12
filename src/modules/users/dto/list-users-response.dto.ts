import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class ListUsersMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class ListUsersResponseDto {
  @ApiProperty({ type: UserResponseDto, isArray: true })
  items!: UserResponseDto[];

  @ApiProperty({ type: ListUsersMetaDto })
  meta!: ListUsersMetaDto;
}
