ALTER TABLE "filter_profiles" ADD COLUMN "userId" TEXT;

UPDATE "filter_profiles" AS profile
SET "userId" = spreadsheet."ownerId"
FROM "sheets" AS sheet
JOIN "spreadsheets" AS spreadsheet ON spreadsheet."id" = sheet."spreadsheetId"
WHERE profile."sheetId" = sheet."id" AND profile."userId" IS NULL;

DELETE FROM "filter_profiles" WHERE "userId" IS NULL;

ALTER TABLE "filter_profiles" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX IF EXISTS "filter_profiles_sheetId_idx";
CREATE INDEX "filter_profiles_sheetId_userId_idx" ON "filter_profiles"("sheetId", "userId");

ALTER TABLE "filter_profiles"
ADD CONSTRAINT "filter_profiles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
