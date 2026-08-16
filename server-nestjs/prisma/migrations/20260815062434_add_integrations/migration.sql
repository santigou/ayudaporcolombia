-- CreateEnum
CREATE TYPE "PartnerAuthType" AS ENUM ('api_key', 'login');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "SyncEvent" AS ENUM ('point_created', 'point_updated');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'processing', 'delivered', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "Partner" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "outboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sendOnCreated" BOOLEAN NOT NULL DEFAULT true,
    "sendOnUpdated" BOOLEAN NOT NULL DEFAULT true,
    "outboundUrl" TEXT,
    "authType" "PartnerAuthType" NOT NULL DEFAULT 'api_key',
    "outboundHeaderName" TEXT,
    "outboundApiKeyValueEnc" TEXT,
    "loginUrl" TEXT,
    "loginEmailEnc" TEXT,
    "loginPasswordEnc" TEXT,
    "tokenJsonPath" TEXT,
    "tokenHeader" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerApiKey" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPointLink" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "pointId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerPointLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSyncLog" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "pointId" UUID,
    "externalId" TEXT,
    "direction" "SyncDirection" NOT NULL,
    "event" "SyncEvent" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "httpStatus" INTEGER,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_slug_key" ON "Partner"("slug");

-- CreateIndex
CREATE INDEX "Partner_outboundEnabled_idx" ON "Partner"("outboundEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerApiKey_keyHash_key" ON "PartnerApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "PartnerApiKey_partnerId_idx" ON "PartnerApiKey"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerPointLink_pointId_idx" ON "PartnerPointLink"("pointId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPointLink_partnerId_externalId_key" ON "PartnerPointLink"("partnerId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPointLink_partnerId_pointId_key" ON "PartnerPointLink"("partnerId", "pointId");

-- CreateIndex
CREATE INDEX "PartnerSyncLog_status_nextAttemptAt_idx" ON "PartnerSyncLog"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "PartnerSyncLog_partnerId_createdAt_idx" ON "PartnerSyncLog"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerSyncLog_pointId_idx" ON "PartnerSyncLog"("pointId");

-- AddForeignKey
ALTER TABLE "PartnerApiKey" ADD CONSTRAINT "PartnerApiKey_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPointLink" ADD CONSTRAINT "PartnerPointLink_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPointLink" ADD CONSTRAINT "PartnerPointLink_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSyncLog" ADD CONSTRAINT "PartnerSyncLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSyncLog" ADD CONSTRAINT "PartnerSyncLog_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE SET NULL ON UPDATE CASCADE;
