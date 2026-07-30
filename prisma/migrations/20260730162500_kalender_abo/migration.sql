-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kalenderToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_kalenderToken_key" ON "User"("kalenderToken");

