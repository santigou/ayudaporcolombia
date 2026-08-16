-- CreateTable
CREATE TABLE "PartnerMapping" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "direction" "SyncDirection" NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerMapping_partnerId_direction_isActive_idx" ON "PartnerMapping"("partnerId", "direction", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMapping_partnerId_direction_version_key" ON "PartnerMapping"("partnerId", "direction", "version");

-- AddForeignKey
ALTER TABLE "PartnerMapping" ADD CONSTRAINT "PartnerMapping_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
