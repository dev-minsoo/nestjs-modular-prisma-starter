import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/pagination';
import { UserResponseDto } from './user-response.dto';

export class ListUsersResponseDto {
  @ApiProperty({ type: UserResponseDto, isArray: true })
  items!: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
