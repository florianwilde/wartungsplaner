-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('AUFGABEN', 'ABWEICHUNGEN', 'ESKALATION', 'WOCHENUEBERSICHT', 'TEST');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyByEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "aufgabenAktiv" BOOLEAN NOT NULL DEFAULT true,
    "abweichungenAktiv" BOOLEAN NOT NULL DEFAULT true,
    "abweichungVorlaufTage" INTEGER NOT NULL DEFAULT 7,
    "eskalationAktiv" BOOLEAN NOT NULL DEFAULT false,
    "eskalationAbTagen" INTEGER NOT NULL DEFAULT 7,
    "eskalationUserId" TEXT,
    "wochenuebersichtAktiv" BOOLEAN NOT NULL DEFAULT false,
    "wochenuebersichtTag" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentNotification" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "key" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SentNotification_sentAt_idx" ON "SentNotification"("sentAt");

-- CreateIndex
CREATE INDEX "SentNotification_recipient_idx" ON "SentNotification"("recipient");

-- CreateIndex
CREATE UNIQUE INDEX "SentNotification_kind_key_key" ON "SentNotification"("kind", "key");

-- AddForeignKey
ALTER TABLE "NotificationSetting" ADD CONSTRAINT "NotificationSetting_eskalationUserId_fkey" FOREIGN KEY ("eskalationUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
