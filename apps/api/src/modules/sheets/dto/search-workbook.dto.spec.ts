import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchWorkbookDto } from './search-workbook.dto';

describe('SearchWorkbookDto', () => {
  it('parses bounded paging and boolean query parameters', async () => {
    const dto = plainToInstance(SearchWorkbookDto, {
      query: 'revenue',
      mode: 'formulas',
      limit: '100',
      matchCase: 'true',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({
      mode: 'formulas',
      limit: 100,
      matchCase: true,
    });
  });

  it('rejects oversized pages and ambiguous boolean values', async () => {
    const dto = plainToInstance(SearchWorkbookDto, {
      query: 'revenue',
      limit: '101',
      matchCase: '1',
    });
    const errors = await validate(dto);

    expect(errors.map(({ property }) => property).sort()).toEqual([
      'limit',
      'matchCase',
    ]);
  });
});
