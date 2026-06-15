import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TodoResponseDto {
  @ApiProperty({ example: 'b00c71d8-255d-4aef-9638-e9d4a5b083b6' })
  id!: string;

  @ApiProperty({ example: 'Read the NestJS docs' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Focus on modules, providers, and controllers.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ example: false })
  completed!: boolean;

  @ApiProperty({ example: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524' })
  ownerId!: string;

  @ApiProperty({ example: '2026-06-16T05:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-06-16T05:00:00.000Z' })
  updatedAt!: Date;
}
