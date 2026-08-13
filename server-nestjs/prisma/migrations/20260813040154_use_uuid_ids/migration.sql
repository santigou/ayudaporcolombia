/*
  Warnings:

  - The primary key for the `Attachment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Contact` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `HelpType` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Location` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ModeratorRequest` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `reviewedById` column on the `ModeratorRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Point` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `helpTypeId` column on the `Point` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `createdById` column on the `Point` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `PointLocation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PointSupply` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PointUpdate` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Supply` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Validation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Verification` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `Attachment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pointId` on the `Attachment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Contact` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pointId` on the `Contact` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `HelpType` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Location` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ModeratorRequest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `ModeratorRequest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Point` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pointId` on the `PointLocation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `locationId` on the `PointLocation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pointId` on the `PointSupply` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `supplyId` on the `PointSupply` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `PointUpdate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pointId` on the `PointUpdate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdById` on the `PointUpdate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Supply` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pointId` on the `Validation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `Validation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Verification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pointId` on the `Verification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `moderatorId` on the `Verification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_pointId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_pointId_fkey";

-- DropForeignKey
ALTER TABLE "ModeratorRequest" DROP CONSTRAINT "ModeratorRequest_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "ModeratorRequest" DROP CONSTRAINT "ModeratorRequest_userId_fkey";

-- DropForeignKey
ALTER TABLE "Point" DROP CONSTRAINT "Point_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Point" DROP CONSTRAINT "Point_helpTypeId_fkey";

-- DropForeignKey
ALTER TABLE "PointLocation" DROP CONSTRAINT "PointLocation_locationId_fkey";

-- DropForeignKey
ALTER TABLE "PointLocation" DROP CONSTRAINT "PointLocation_pointId_fkey";

-- DropForeignKey
ALTER TABLE "PointSupply" DROP CONSTRAINT "PointSupply_pointId_fkey";

-- DropForeignKey
ALTER TABLE "PointSupply" DROP CONSTRAINT "PointSupply_supplyId_fkey";

-- DropForeignKey
ALTER TABLE "PointUpdate" DROP CONSTRAINT "PointUpdate_createdById_fkey";

-- DropForeignKey
ALTER TABLE "PointUpdate" DROP CONSTRAINT "PointUpdate_pointId_fkey";

-- DropForeignKey
ALTER TABLE "Validation" DROP CONSTRAINT "Validation_pointId_fkey";

-- DropForeignKey
ALTER TABLE "Validation" DROP CONSTRAINT "Validation_userId_fkey";

-- DropForeignKey
ALTER TABLE "Verification" DROP CONSTRAINT "Verification_moderatorId_fkey";

-- DropForeignKey
ALTER TABLE "Verification" DROP CONSTRAINT "Verification_pointId_fkey";

-- AlterTable
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "pointId",
ADD COLUMN     "pointId" UUID NOT NULL,
ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "pointId",
ADD COLUMN     "pointId" UUID NOT NULL,
ADD CONSTRAINT "Contact_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "HelpType" DROP CONSTRAINT "HelpType_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "HelpType_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Location" DROP CONSTRAINT "Location_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Location_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ModeratorRequest" DROP CONSTRAINT "ModeratorRequest_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL,
DROP COLUMN "reviewedById",
ADD COLUMN     "reviewedById" UUID,
ADD CONSTRAINT "ModeratorRequest_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Point" DROP CONSTRAINT "Point_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "helpTypeId",
ADD COLUMN     "helpTypeId" UUID,
DROP COLUMN "createdById",
ADD COLUMN     "createdById" UUID,
ADD CONSTRAINT "Point_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PointLocation" DROP CONSTRAINT "PointLocation_pkey",
DROP COLUMN "pointId",
ADD COLUMN     "pointId" UUID NOT NULL,
DROP COLUMN "locationId",
ADD COLUMN     "locationId" UUID NOT NULL,
ADD CONSTRAINT "PointLocation_pkey" PRIMARY KEY ("pointId", "locationId", "locationType");

-- AlterTable
ALTER TABLE "PointSupply" DROP CONSTRAINT "PointSupply_pkey",
DROP COLUMN "pointId",
ADD COLUMN     "pointId" UUID NOT NULL,
DROP COLUMN "supplyId",
ADD COLUMN     "supplyId" UUID NOT NULL,
ADD CONSTRAINT "PointSupply_pkey" PRIMARY KEY ("pointId", "supplyId");

-- AlterTable
ALTER TABLE "PointUpdate" DROP CONSTRAINT "PointUpdate_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "pointId",
ADD COLUMN     "pointId" UUID NOT NULL,
DROP COLUMN "createdById",
ADD COLUMN     "createdById" UUID NOT NULL,
ADD CONSTRAINT "PointUpdate_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Supply" DROP CONSTRAINT "Supply_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Supply_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Validation" DROP CONSTRAINT "Validation_pkey",
DROP COLUMN "pointId",
ADD COLUMN     "pointId" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL,
ADD CONSTRAINT "Validation_pkey" PRIMARY KEY ("pointId", "userId");

-- AlterTable
ALTER TABLE "Verification" DROP CONSTRAINT "Verification_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "pointId",
ADD COLUMN     "pointId" UUID NOT NULL,
DROP COLUMN "moderatorId",
ADD COLUMN     "moderatorId" UUID NOT NULL,
ADD CONSTRAINT "Verification_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "Attachment_pointId_idx" ON "Attachment"("pointId");

-- CreateIndex
CREATE INDEX "Contact_pointId_idx" ON "Contact"("pointId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeratorRequest_userId_key" ON "ModeratorRequest"("userId");

-- CreateIndex
CREATE INDEX "Point_helpTypeId_idx" ON "Point"("helpTypeId");

-- CreateIndex
CREATE INDEX "PointLocation_locationId_idx" ON "PointLocation"("locationId");

-- CreateIndex
CREATE INDEX "PointUpdate_pointId_createdAt_idx" ON "PointUpdate"("pointId", "createdAt");

-- CreateIndex
CREATE INDEX "Verification_pointId_createdAt_idx" ON "Verification"("pointId", "createdAt");

-- CreateIndex
CREATE INDEX "Verification_moderatorId_idx" ON "Verification"("moderatorId");

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
