import { serialToDate } from '@jasheets/formula-engine';

export {
  datePartsToSerial,
  dateToSerial,
  serialToDate,
  timePartsToSerial,
} from '@jasheets/formula-engine';

export function storedNumberToDate(value: number): Date {
  return Math.abs(value) >= 10_000_000_000 ? new Date(value) : serialToDate(value);
}
