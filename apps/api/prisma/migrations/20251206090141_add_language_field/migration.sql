-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'ko',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'light';

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_spreadsheetId_key" ON "favorites"("userId", "spreadsheetId");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
