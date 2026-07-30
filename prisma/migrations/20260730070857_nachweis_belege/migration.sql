-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "nachweisId" TEXT,
ADD COLUMN     "punktId" TEXT,
ALTER COLUMN "executionId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Attachment_nachweisId_idx" ON "Attachment"("nachweisId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_nachweisId_fkey" FOREIGN KEY ("nachweisId") REFERENCES "Nachweis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_punktId_fkey" FOREIGN KEY ("punktId") REFERENCES "PruefbogenPunkt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
