-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vertretungBis" DATE,
ADD COLUMN     "vertretungId" TEXT,
ADD COLUMN     "vertretungVon" DATE;

-- CreateIndex
CREATE INDEX "User_vertretungId_idx" ON "User"("vertretungId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vertretungId_fkey" FOREIGN KEY ("vertretungId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
