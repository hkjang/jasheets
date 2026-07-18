import { IsIn, IsInt, Max, Min } from 'class-validator';

export class StructuralChangeDto {
  @IsIn(['row', 'column'])
  axis: 'row' | 'column';

  @IsIn(['insert', 'delete'])
  type: 'insert' | 'delete';

  @IsInt()
  @Min(0)
  @Max(999999)
  index: number;
}
