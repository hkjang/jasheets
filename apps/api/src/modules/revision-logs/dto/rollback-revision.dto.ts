import { IsInt, IsString, Matches, Min } from 'class-validator';

export class RollbackRevisionDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  idempotencyKey!: string;
}
