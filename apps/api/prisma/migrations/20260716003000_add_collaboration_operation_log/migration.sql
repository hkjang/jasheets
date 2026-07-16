CREATE TABLE "collaboration_operations" (
    "id" BIGSERIAL NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collaboration_operations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "collaboration_operations_spreadsheetId_id_idx"
ON "collaboration_operations"("spreadsheetId", "id");

CREATE INDEX "collaboration_operations_sheetId_id_idx"
ON "collaboration_operations"("sheetId", "id");

ALTER TABLE "collaboration_operations" ADD CONSTRAINT "collaboration_operations_spreadsheetId_fkey"
FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaboration_operations" ADD CONSTRAINT "collaboration_operations_sheetId_fkey"
FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaboration_operations" ADD CONSTRAINT "collaboration_operations_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
