import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SavePivotTablesDto } from './pivot-table.dto';

const validPayload = {
  expectedVersion: 3,
  pivotTables: [
    {
      name: 'Sales pivot',
      sourceRange: 'A1:C10',
      targetCell: 'E1',
      config: {
        sourceRange: { startRow: 0, startCol: 0, endRow: 9, endCol: 2 },
        outputRange: { startRow: 0, startCol: 4, endRow: 5, endCol: 6 },
        rows: ['Region'],
        cols: ['Quarter'],
        values: [{ field: 'Sales', aggregation: 'SUM' }],
        filters: [{ field: 'Sales', operator: 'BETWEEN', values: [10, 20] }],
        rowSort: {
          direction: 'DESC',
          by: 'VALUE',
          valueField: 'Sales',
          aggregation: 'SUM',
        },
        rowGrandTotals: true,
        columnGrandTotals: false,
      },
    },
  ],
};

describe('SavePivotTablesDto', () => {
  it('accepts the bounded managed-pivot v2 contract', async () => {
    const dto = plainToInstance(SavePivotTablesDto, validPayload);

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toHaveLength(0);
  });

  it('requires a materialization target', async () => {
    const payload = structuredClone(validPayload);
    delete (payload.pivotTables[0] as { targetCell?: string }).targetCell;
    const errors = await validate(
      plainToInstance(SavePivotTablesDto, payload),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors).not.toHaveLength(0);
  });

  it('rejects unknown nested properties and unsupported operators', async () => {
    const payload = structuredClone(validPayload) as any;
    payload.pivotTables[0].config.unsafe = true;
    payload.pivotTables[0].config.filters[0].operator = 'EXECUTE';
    const errors = await validate(
      plainToInstance(SavePivotTablesDto, payload),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors).not.toHaveLength(0);
  });

  it('rejects oversized field and filter-value arrays', async () => {
    const payload = structuredClone(validPayload);
    payload.pivotTables[0].config.rows = Array.from(
      { length: 51 },
      (_, index) => `Field ${index}`,
    );
    payload.pivotTables[0].config.filters[0].values = Array.from(
      { length: 1001 },
      (_, index) => index,
    );
    const errors = await validate(
      plainToInstance(SavePivotTablesDto, payload),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors).not.toHaveLength(0);
  });
});
