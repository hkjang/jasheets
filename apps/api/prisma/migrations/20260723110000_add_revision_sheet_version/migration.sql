ALTER TABLE "revision_logs"
ADD COLUMN "sheetVersion" INTEGER;

CREATE INDEX "revision_logs_sheetId_sheetVersion_idx"
ON "revision_logs"("sheetId", "sheetVersion");
