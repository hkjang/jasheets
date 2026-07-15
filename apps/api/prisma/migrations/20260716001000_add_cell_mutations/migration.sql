CREATE TABLE "cell_mutations" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cell_mutations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cell_mutations_sheetId_userId_idempotencyKey_key"
ON "cell_mutations"("sheetId", "userId", "idempotencyKey");

CREATE INDEX "cell_mutations_sheetId_createdAt_idx"
ON "cell_mutations"("sheetId", "createdAt");

ALTER TABLE "cell_mutations"
ADD CONSTRAINT "cell_mutations_sheetId_fkey"
FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
