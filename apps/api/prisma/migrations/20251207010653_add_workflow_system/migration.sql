-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('SPREADSHEET', 'SHEET', 'RANGE', 'CELL', 'CELL_GROUP');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CELL_CHANGE', 'MULTI_CELL_CHANGE', 'FORMULA_RECALC', 'ROW_INSERT', 'ROW_DELETE', 'COL_INSERT', 'COL_DELETE');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FlowRole" AS ENUM ('VIEWER', 'EDITOR', 'OWNER');

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryBackoff" TEXT NOT NULL DEFAULT 'exponential',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_executions" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response" JSONB,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_queue" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letter_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rules" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetType" "TargetType" NOT NULL DEFAULT 'SHEET',
    "sheetId" TEXT,
    "cellRange" TEXT,
    "cellCoordinates" JSONB,
    "eventTypes" "EventType"[],
    "filterConditions" JSONB,
    "batchMode" BOOLEAN NOT NULL DEFAULT false,
    "batchWindow" INTEGER,
    "webhookId" TEXT,
    "flowId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "eventRuleId" TEXT,
    "spreadsheetId" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "cellCoordinate" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "changedBy" TEXT,
    "changeMethod" TEXT,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flows" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_versions" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "snapshot" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_executions" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "triggerData" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "flow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_executions" (
    "id" TEXT NOT NULL,
    "flowExecutionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "inputData" JSONB,
    "outputData" JSONB,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "node_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_permissions" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FlowRole" NOT NULL,

    CONSTRAINT "flow_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_executions_webhookId_executedAt_idx" ON "webhook_executions"("webhookId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "event_logs_spreadsheetId_createdAt_idx" ON "event_logs"("spreadsheetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "event_logs_transactionId_idx" ON "event_logs"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_versions_flowId_version_key" ON "flow_versions"("flowId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "flow_executions_transactionId_key" ON "flow_executions"("transactionId");

-- CreateIndex
CREATE INDEX "flow_executions_flowId_startedAt_idx" ON "flow_executions"("flowId", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "flow_permissions_flowId_userId_key" ON "flow_permissions"("flowId", "userId");

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_executions" ADD CONSTRAINT "webhook_executions_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rules" ADD CONSTRAINT "event_rules_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rules" ADD CONSTRAINT "event_rules_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rules" ADD CONSTRAINT "event_rules_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_eventRuleId_fkey" FOREIGN KEY ("eventRuleId") REFERENCES "event_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_spreadsheetId_fkey" FOREIGN KEY ("spreadsheetId") REFERENCES "spreadsheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_versions" ADD CONSTRAINT "flow_versions_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_executions" ADD CONSTRAINT "node_executions_flowExecutionId_fkey" FOREIGN KEY ("flowExecutionId") REFERENCES "flow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_permissions" ADD CONSTRAINT "flow_permissions_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_permissions" ADD CONSTRAINT "flow_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
