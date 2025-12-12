-- CreateEnum
CREATE TYPE "UDFApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AIModelType" AS ENUM ('FORMULA_SUGGEST', 'SHEET_GENERATE', 'DATA_ANALYSIS', 'CHAT_ASSISTANT');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('OPENAI', 'GEMINI', 'ANTHROPIC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PromptCategory" AS ENUM ('SHEET_CREATION', 'FORMULA_GENERATION', 'DATA_ANALYSIS', 'CHART_SUGGESTION', 'AUTOMATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "QuotaTargetType" AS ENUM ('USER', 'SHEET', 'SPREADSHEET');

-- CreateEnum
CREATE TYPE "MacroApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('VIEW', 'EDIT', 'COLLABORATION');

-- CreateTable
CREATE TABLE "permission_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_locks" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "lockedById" TEXT NOT NULL,
    "reason" TEXT,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "sheet_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_format_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "allowedColors" TEXT[],
    "allowedFormulas" TEXT[],
    "blockedFormulas" TEXT[],
    "maxRulesPerSheet" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_format_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "udf_approvals" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "parameters" JSONB,
    "requesterId" TEXT NOT NULL,
    "status" "UDFApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "riskLevel" "RiskLevel",
    "riskDetails" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "udf_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelType" "AIModelType" NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PromptCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "variables" TEXT[],
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pivot_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "maxPivotsPerSheet" INTEGER NOT NULL DEFAULT 10,
    "maxPivotsPerUser" INTEGER NOT NULL DEFAULT 50,
    "allowedAggregates" TEXT[],
    "maxRowsForPivot" INTEGER NOT NULL DEFAULT 100000,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pivot_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotas" (
    "id" TEXT NOT NULL,
    "targetType" "QuotaTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "maxRows" INTEGER NOT NULL DEFAULT 100000,
    "maxColumns" INTEGER NOT NULL DEFAULT 1000,
    "maxCells" INTEGER NOT NULL DEFAULT 10000000,
    "maxFileSize" INTEGER NOT NULL DEFAULT 104857600,
    "usedRows" INTEGER NOT NULL DEFAULT 0,
    "usedColumns" INTEGER NOT NULL DEFAULT 0,
    "usedCells" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "macro_approvals" (
    "id" TEXT NOT NULL,
    "commandId" TEXT,
    "spreadsheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "description" TEXT,
    "requesterId" TEXT NOT NULL,
    "status" "MacroApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "lintResults" JSONB,
    "riskLevel" "RiskLevel",
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "macro_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_sessions" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "sheetId" TEXT,
    "userId" TEXT NOT NULL,
    "sessionType" "SessionType" NOT NULL DEFAULT 'EDIT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "sheet_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshot_retention_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxSnapshotsPerSheet" INTEGER NOT NULL DEFAULT 50,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "autoDeleteEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snapshot_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permission_policies_name_key" ON "permission_policies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sheet_locks_sheetId_key" ON "sheet_locks"("sheetId");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_format_policies_name_key" ON "conditional_format_policies"("name");

-- CreateIndex
CREATE INDEX "udf_approvals_spreadsheetId_idx" ON "udf_approvals"("spreadsheetId");

-- CreateIndex
CREATE INDEX "udf_approvals_status_idx" ON "udf_approvals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_configs_name_key" ON "ai_model_configs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_name_key" ON "prompt_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "quotas_targetType_targetId_key" ON "quotas"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "macro_approvals_spreadsheetId_idx" ON "macro_approvals"("spreadsheetId");

-- CreateIndex
CREATE INDEX "macro_approvals_status_idx" ON "macro_approvals"("status");

-- CreateIndex
CREATE INDEX "api_usage_spreadsheetId_timestamp_idx" ON "api_usage"("spreadsheetId", "timestamp");

-- CreateIndex
CREATE INDEX "api_usage_userId_timestamp_idx" ON "api_usage"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "api_usage_endpoint_timestamp_idx" ON "api_usage"("endpoint", "timestamp");

-- CreateIndex
CREATE INDEX "sheet_sessions_spreadsheetId_lastActiveAt_idx" ON "sheet_sessions"("spreadsheetId", "lastActiveAt");

-- CreateIndex
CREATE INDEX "sheet_sessions_userId_lastActiveAt_idx" ON "sheet_sessions"("userId", "lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "snapshot_retention_policies_name_key" ON "snapshot_retention_policies"("name");
