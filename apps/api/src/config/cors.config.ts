const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

export function getCorsOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured?.length ? configured : DEVELOPMENT_ORIGINS;
}

export const websocketCors = {
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin || getCorsOrigins().includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin is not allowed'));
  },
  credentials: true,
};
