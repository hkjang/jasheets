-- CreateTable
CREATE TABLE "charts" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 100,
    "y" INTEGER NOT NULL DEFAULT 100,
    "width" INTEGER NOT NULL DEFAULT 400,
    "height" INTEGER NOT NULL DEFAULT 300,
    "data" JSONB NOT NULL,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pivot_tables" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "name" TEXT,
    "config" JSONB NOT NULL,
    "sourceRange" TEXT,
    "targetCell" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pivot_tables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "charts_sheetId_idx" ON "charts"("sheetId");

-- CreateIndex
CREATE INDEX "pivot_tables_sheetId_idx" ON "pivot_tables"("sheetId");

-- AddForeignKey
ALTER TABLE "charts" ADD CONSTRAINT "charts_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pivot_tables" ADD CONSTRAINT "pivot_tables_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
