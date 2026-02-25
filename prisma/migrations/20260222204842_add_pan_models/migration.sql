-- CreateEnum
CREATE TYPE "PanApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "PanDocumentPurpose" AS ENUM ('PAN_POI', 'PAN_POA', 'PAN_DOB', 'PAN_PHOTO', 'PAN_SIGNATURE');

-- CreateTable
CREATE TABLE "PanApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PanApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "stepData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "PanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanDocument" (
    "id" TEXT NOT NULL,
    "panApplicationId" TEXT NOT NULL,
    "purpose" "PanDocumentPurpose" NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedPanPdf" (
    "id" TEXT NOT NULL,
    "panApplicationId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedPanPdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PanApplication_userId_key" ON "PanApplication"("userId");

-- CreateIndex
CREATE INDEX "PanApplication_userId_idx" ON "PanApplication"("userId");

-- CreateIndex
CREATE INDEX "PanDocument_panApplicationId_idx" ON "PanDocument"("panApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPanPdf_panApplicationId_key" ON "GeneratedPanPdf"("panApplicationId");

-- AddForeignKey
ALTER TABLE "PanApplication" ADD CONSTRAINT "PanApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanDocument" ADD CONSTRAINT "PanDocument_panApplicationId_fkey" FOREIGN KEY ("panApplicationId") REFERENCES "PanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPanPdf" ADD CONSTRAINT "GeneratedPanPdf_panApplicationId_fkey" FOREIGN KEY ("panApplicationId") REFERENCES "PanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
