-- AlterTable
ALTER TABLE "User" DROP COLUMN "sitzungenUngueltigAb",
ADD COLUMN     "sitzungsstand" INTEGER NOT NULL DEFAULT 0;

