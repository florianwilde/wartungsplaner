-- AlterTable
ALTER TABLE "Finding" ADD COLUMN     "punktId" TEXT;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_punktId_fkey" FOREIGN KEY ("punktId") REFERENCES "PruefbogenPunkt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
