CREATE TABLE "merged_ranges" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "startRow" INTEGER NOT NULL,
    "startCol" INTEGER NOT NULL,
    "endRow" INTEGER NOT NULL,
    "endCol" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merged_ranges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "merged_ranges_coordinates_check" CHECK (
        "startRow" >= 0 AND "startCol" >= 0 AND
        "startRow" <= "endRow" AND "startCol" <= "endCol"
    )
);

CREATE UNIQUE INDEX "merged_ranges_sheetId_startRow_startCol_endRow_endCol_key"
ON "merged_ranges"("sheetId", "startRow", "startCol", "endRow", "endCol");

CREATE INDEX "merged_ranges_sheetId_idx" ON "merged_ranges"("sheetId");

ALTER TABLE "merged_ranges" ADD CONSTRAINT "merged_ranges_sheetId_fkey"
FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
