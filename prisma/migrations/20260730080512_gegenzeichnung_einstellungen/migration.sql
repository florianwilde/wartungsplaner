-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'GEGENZEICHNUNG';
ALTER TYPE "NotificationKind" ADD VALUE 'ZURUECKWEISUNG';

-- AlterTable
ALTER TABLE "NotificationSetting" ADD COLUMN     "gegenzeichnungAbTagen" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "gegenzeichnungAktiv" BOOLEAN NOT NULL DEFAULT true;
