CREATE TABLE "collaboration_snapshots" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collaboration_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaboration_snapshots_sheetId_sequence_key"
ON "collaboration_snapshots"("sheetId", "sequence");
CREATE INDEX "collaboration_snapshots_sheetId_sequence_idx"
ON "collaboration_snapshots"("sheetId", "sequence" DESC);

ALTER TABLE "collaboration_snapshots" ADD CONSTRAINT "collaboration_snapshots_spreadsheetId_fkey"
FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_snapshots" ADD CONSTRAINT "collaboration_snapshots_sheetId_fkey"
FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
