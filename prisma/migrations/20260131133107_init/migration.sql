-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR', 'SSLC_MARKSHEET', 'CATEGORY_CERTIFICATE', 'RESERVATION_CERTIFICATE', 'SPORTS_CERTIFICATE', 'KALOLSAVAM_CERTIFICATE', 'SCHOLARSHIP_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('VERIFIED', 'REJECTED', 'NOTES_ADDED');

-- CreateEnum
CREATE TYPE "ExploreContentType" AS ENUM ('BLOG', 'VIDEO');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPLICATION_SUBMITTED', 'APPLICATION_VERIFIED', 'APPLICATION_REJECTED', 'GENERAL');

-- CreateEnum
CREATE TYPE "SeedDataType" AS ENUM ('SCHOOL', 'COMBINATION', 'CATEGORY', 'DISTRICT', 'TALUK', 'PANCHAYAT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStepData" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "examCode" TEXT,
    "examName" TEXT,
    "registerNumber" TEXT,
    "passingMonth" INTEGER,
    "passingYear" INTEGER,
    "schoolCode" TEXT,
    "schoolName" TEXT,
    "passedBoardExam" BOOLEAN,
    "applicantName" TEXT,
    "aadhaarNumber" TEXT,
    "gender" TEXT,
    "category" TEXT,
    "categoryCode" TEXT,
    "ewsEligible" BOOLEAN,
    "caste" TEXT,
    "religion" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "motherName" TEXT,
    "fatherName" TEXT,
    "guardianName" TEXT,
    "oec" BOOLEAN,
    "linguisticMinority" BOOLEAN,
    "linguisticLanguage" TEXT,
    "differentlyAbled" BOOLEAN,
    "differentlyAbledPercentage" DOUBLE PRECISION,
    "nativeState" TEXT,
    "nativeStateCode" TEXT,
    "nativeDistrict" TEXT,
    "nativeDistrictCode" TEXT,
    "nativeTaluk" TEXT,
    "nativeTalukCode" TEXT,
    "nativePanchayat" TEXT,
    "nativePanchayatCode" TEXT,
    "permanentAddress" TEXT,
    "communicationAddress" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "graceMarks" BOOLEAN,
    "ncc" BOOLEAN,
    "scouts" BOOLEAN,
    "spc" BOOLEAN,
    "defenceDependent" BOOLEAN,
    "littleKitesGrade" TEXT,
    "sportsStateCount" INTEGER,
    "sportsDistrictFirst" INTEGER,
    "sportsDistrictSecond" INTEGER,
    "sportsDistrictThird" INTEGER,
    "sportsDistrictParticipation" INTEGER,
    "kalolsavamStateCount" INTEGER,
    "kalolsavamDistrictA" INTEGER,
    "kalolsavamDistrictB" INTEGER,
    "kalolsavamDistrictC" INTEGER,
    "kalolsavamDistrictParticipation" INTEGER,
    "ntse" BOOLEAN,
    "nmms" BOOLEAN,
    "uss" BOOLEAN,
    "lss" BOOLEAN,
    "scienceFairGrade" TEXT,
    "mathsFairGrade" TEXT,
    "itFairGrade" TEXT,
    "workExperienceGrade" TEXT,
    "clubs" TEXT,
    "sslcAttempts" INTEGER,
    "previousAttempts" TEXT,
    "subjectGrades" TEXT,
    "applicantSignature" TEXT,
    "parentSignature" TEXT,
    "disclaimerAccepted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationStepData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preference" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "preferenceNumber" INTEGER NOT NULL,
    "schoolCode" TEXT NOT NULL,
    "combinationCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedPDF" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedPDF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "AdminActionType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExploreContent" (
    "id" TEXT NOT NULL,
    "type" "ExploreContentType" NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleMl" TEXT,
    "contentEn" TEXT NOT NULL,
    "contentMl" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "category" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExploreContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedData" (
    "id" TEXT NOT NULL,
    "type" "SeedDataType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameMl" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeedData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_key" ON "Application"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationStepData_applicationId_key" ON "ApplicationStepData"("applicationId");

-- CreateIndex
CREATE INDEX "Preference_applicationId_idx" ON "Preference"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Preference_applicationId_preferenceNumber_key" ON "Preference"("applicationId", "preferenceNumber");

-- CreateIndex
CREATE INDEX "Document_applicationId_idx" ON "Document"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPDF_applicationId_key" ON "GeneratedPDF"("applicationId");

-- CreateIndex
CREATE INDEX "AdminAction_applicationId_idx" ON "AdminAction"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "ExploreContent_published_type_idx" ON "ExploreContent"("published", "type");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "SeedData_type_idx" ON "SeedData"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SeedData_type_code_key" ON "SeedData"("type", "code");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStepData" ADD CONSTRAINT "ApplicationStepData_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPDF" ADD CONSTRAINT "GeneratedPDF_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
