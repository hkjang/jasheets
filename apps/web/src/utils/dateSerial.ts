const MILLISECONDS_PER_DAY = 86_400_000;
const SERIAL_EPOCH = Date.UTC(1899, 11, 30);

export function dateToSerial(date: Date): number {
  return (date.getTime() - SERIAL_EPOCH) / MILLISECONDS_PER_DAY;
}

export function serialToDate(serial: number): Date {
  return new Date(SERIAL_EPOCH + serial * MILLISECONDS_PER_DAY);
}

export function datePartsToSerial(year: number, month: number, day: number): number {
  return (Date.UTC(year, month - 1, day) - SERIAL_EPOCH) / MILLISECONDS_PER_DAY;
}

export function timePartsToSerial(hour: number, minute: number, second: number): number {
  return (hour * 3600 + minute * 60 + second) / 86_400;
}

export function storedNumberToDate(value: number): Date {
  return Math.abs(value) >= 10_000_000_000 ? new Date(value) : serialToDate(value);
}
