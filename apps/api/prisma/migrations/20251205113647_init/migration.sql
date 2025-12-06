-- CreateEnum
CREATE TYPE "PermissionRole" AS ENUM ('VIEWER', 'COMMENTER', 'EDITOR', 'OWNER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spreadsheets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spreadsheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheets" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "index" INTEGER NOT NULL DEFAULT 0,
    "rowCount" INTEGER NOT NULL DEFAULT 1000,
    "colCount" INTEGER NOT NULL DEFAULT 26,
    "frozenRows" INTEGER NOT NULL DEFAULT 0,
    "frozenCols" INTEGER NOT NULL DEFAULT 0,
    "defaultRowHeight" INTEGER NOT NULL DEFAULT 25,
    "defaultColWidth" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cells" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "value" JSONB,
    "formula" TEXT,
    "format" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "row_meta" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "height" INTEGER,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "row_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "col_meta" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "col" INTEGER NOT NULL,
    "width" INTEGER,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "col_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "role" "PermissionRole" NOT NULL,
    "inviteToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "name" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "spreadsheets_publicToken_key" ON "spreadsheets"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "sheets_spreadsheetId_index_key" ON "sheets"("spreadsheetId", "index");

-- CreateIndex
CREATE INDEX "cells_sheetId_idx" ON "cells"("sheetId");

-- CreateIndex
CREATE UNIQUE INDEX "cells_sheetId_row_col_key" ON "cells"("sheetId", "row", "col");

-- CreateIndex
CREATE UNIQUE INDEX "row_meta_sheetId_row_key" ON "row_meta"("sheetId", "row");

-- CreateIndex
CREATE UNIQUE INDEX "col_meta_sheetId_col_key" ON "col_meta"("sheetId", "col");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_inviteToken_key" ON "permissions"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_spreadsheetId_userId_key" ON "permissions"("spreadsheetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_spreadsheetId_email_key" ON "permissions"("spreadsheetId", "email");

-- CreateIndex
CREATE INDEX "versions_spreadsheetId_createdAt_idx" ON "versions"("spreadsheetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "comments_sheetId_row_col_idx" ON "comments"("sheetId", "row", "col");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spreadsheets" ADD CONSTRAINT "spreadsheets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cells" ADD CONSTRAINT "cells_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "row_meta" ADD CONSTRAINT "row_meta_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "col_meta" ADD CONSTRAINT "col_meta_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions" ADD CONSTRAINT "versions_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions" ADD CONSTRAINT "versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
