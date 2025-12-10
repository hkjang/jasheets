-- CreateTable
CREATE TABLE "embed_configs" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "embedToken" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "showToolbar" BOOLEAN NOT NULL DEFAULT false,
    "showTabs" BOOLEAN NOT NULL DEFAULT true,
    "showGridlines" BOOLEAN NOT NULL DEFAULT true,
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embed_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "embed_configs_spreadsheetId_key" ON "embed_configs"("spreadsheetId");

-- CreateIndex
CREATE UNIQUE INDEX "embed_configs_embedToken_key" ON "embed_configs"("embedToken");

-- AddForeignKey
ALTER TABLE "embed_configs" ADD CONSTRAINT "embed_configs_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
