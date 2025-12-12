-- CreateEnum
CREATE TYPE "SheetPermissionRole" AS ENUM ('VIEWER', 'COMMENTER', 'EDITOR');

-- CreateEnum
CREATE TYPE "SheetViewMode" AS ENUM ('EDIT', 'VIEW', 'ANALYSIS', 'PRESENTATION');

-- CreateTable
CREATE TABLE "sheet_permissions" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "role" "SheetPermissionRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_logs" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetRange" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_rules" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "ranges" TEXT[],
    "conditions" JSONB NOT NULL,
    "format" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_sheet_references" (
    "id" TEXT NOT NULL,
    "sourceSheetId" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "targetSheetId" TEXT NOT NULL,
    "targetCell" TEXT NOT NULL,
    "formula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_sheet_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_automations" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheet_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_profiles" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "sortings" JSONB,
    "hiddenCols" INTEGER[],
    "hiddenRows" INTEGER[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_snapshots" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL,
    "parentId" TEXT,
    "isBranch" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_commands" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "script" TEXT NOT NULL,
    "shortcuts" TEXT[],
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_views" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceSheets" JSONB NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sheet_permissions_sheetId_userId_key" ON "sheet_permissions"("sheetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "sheet_permissions_sheetId_email_key" ON "sheet_permissions"("sheetId", "email");

-- CreateIndex
CREATE INDEX "revision_logs_sheetId_createdAt_idx" ON "revision_logs"("sheetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "conditional_rules_sheetId_idx" ON "conditional_rules"("sheetId");

-- CreateIndex
CREATE INDEX "cross_sheet_references_sourceSheetId_idx" ON "cross_sheet_references"("sourceSheetId");

-- CreateIndex
CREATE INDEX "cross_sheet_references_targetSheetId_idx" ON "cross_sheet_references"("targetSheetId");

-- CreateIndex
CREATE INDEX "sheet_automations_sheetId_idx" ON "sheet_automations"("sheetId");

-- CreateIndex
CREATE INDEX "filter_profiles_sheetId_idx" ON "filter_profiles"("sheetId");

-- CreateIndex
CREATE INDEX "sheet_snapshots_sheetId_idx" ON "sheet_snapshots"("sheetId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_commands_spreadsheetId_name_key" ON "custom_commands"("spreadsheetId", "name");

-- CreateIndex
CREATE INDEX "master_views_spreadsheetId_idx" ON "master_views"("spreadsheetId");

-- AddForeignKey
ALTER TABLE "sheet_permissions" ADD CONSTRAINT "sheet_permissions_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_permissions" ADD CONSTRAINT "sheet_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_logs" ADD CONSTRAINT "revision_logs_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_logs" ADD CONSTRAINT "revision_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_rules" ADD CONSTRAINT "conditional_rules_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_sheet_references" ADD CONSTRAINT "cross_sheet_references_sourceSheetId_fkey" FOREIGN KEY ("sourceSheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_sheet_references" ADD CONSTRAINT "cross_sheet_references_targetSheetId_fkey" FOREIGN KEY ("targetSheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_automations" ADD CONSTRAINT "sheet_automations_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_profiles" ADD CONSTRAINT "filter_profiles_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_snapshots" ADD CONSTRAINT "sheet_snapshots_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_snapshots" ADD CONSTRAINT "sheet_snapshots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_commands" ADD CONSTRAINT "custom_commands_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_views" ADD CONSTRAINT "master_views_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
