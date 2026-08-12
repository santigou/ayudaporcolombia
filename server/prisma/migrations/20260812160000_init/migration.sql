-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'moderator');

-- CreateEnum
CREATE TYPE "PointType" AS ENUM ('need_help', 'offer_help');

-- CreateEnum
CREATE TYPE "PointStatus" AS ENUM ('pending', 'active', 'resolved', 'rejected', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "PointLocationType" AS ENUM ('location', 'origin', 'destination');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('phone', 'whatsapp', 'instagram', 'email', 'other');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('image', 'video', 'document');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('confirmed', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeratorRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModeratorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Point" (
    "id" TEXT NOT NULL,
    "type" "PointType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "helpTypeId" TEXT,
    "status" "PointStatus" NOT NULL DEFAULT 'pending',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "HelpType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLocation" (
    "pointId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "locationType" "PointLocationType" NOT NULL,

    CONSTRAINT "PointLocation_pkey" PRIMARY KEY ("pointId","locationId","locationType")
);

-- CreateTable
CREATE TABLE "Supply" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Supply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointSupply" (
    "pointId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "targetQuantity" DECIMAL(65,30),
    "receivedQuantity" DECIMAL(65,30),
    "unit" TEXT,

    CONSTRAINT "PointSupply_pkey" PRIMARY KEY ("pointId","supplyId")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Validation" (
    "pointId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Validation_pkey" PRIMARY KEY ("pointId","userId")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointUpdate" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ModeratorRequest_userId_key" ON "ModeratorRequest"("userId");

-- CreateIndex
CREATE INDEX "ModeratorRequest_status_idx" ON "ModeratorRequest"("status");

-- CreateIndex
CREATE INDEX "Point_type_status_idx" ON "Point"("type", "status");

-- CreateIndex
CREATE INDEX "Point_verificationStatus_idx" ON "Point"("verificationStatus");

-- CreateIndex
CREATE INDEX "Point_helpTypeId_idx" ON "Point"("helpTypeId");

-- CreateIndex
CREATE INDEX "Point_createdAt_idx" ON "Point"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HelpType_name_key" ON "HelpType"("name");

-- CreateIndex
CREATE INDEX "PointLocation_locationId_idx" ON "PointLocation"("locationId");

-- CreateIndex
CREATE INDEX "PointLocation_locationType_idx" ON "PointLocation"("locationType");

-- CreateIndex
CREATE UNIQUE INDEX "Supply_name_key" ON "Supply"("name");

-- CreateIndex
CREATE INDEX "Contact_pointId_idx" ON "Contact"("pointId");

-- CreateIndex
CREATE INDEX "Validation_status_idx" ON "Validation"("status");

-- CreateIndex
CREATE INDEX "Verification_pointId_createdAt_idx" ON "Verification"("pointId", "createdAt");

-- CreateIndex
CREATE INDEX "Verification_moderatorId_idx" ON "Verification"("moderatorId");

-- CreateIndex
CREATE INDEX "PointUpdate_pointId_createdAt_idx" ON "PointUpdate"("pointId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_pointId_idx" ON "Attachment"("pointId");

-- AddForeignKey
ALTER TABLE "ModeratorRequest" ADD CONSTRAINT "ModeratorRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorRequest" ADD CONSTRAINT "ModeratorRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Point" ADD CONSTRAINT "Point_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Point" ADD CONSTRAINT "Point_helpTypeId_fkey" FOREIGN KEY ("helpTypeId") REFERENCES "HelpType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLocation" ADD CONSTRAINT "PointLocation_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLocation" ADD CONSTRAINT "PointLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointSupply" ADD CONSTRAINT "PointSupply_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointSupply" ADD CONSTRAINT "PointSupply_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "Supply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointUpdate" ADD CONSTRAINT "PointUpdate_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointUpdate" ADD CONSTRAINT "PointUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

