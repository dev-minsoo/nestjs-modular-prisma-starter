import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/pagination';
import { TodoResponseDto } from './todo-response.dto';

export class ListTodosResponseDto {
  @ApiProperty({ type: [TodoResponseDto] })
  items!: TodoResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
