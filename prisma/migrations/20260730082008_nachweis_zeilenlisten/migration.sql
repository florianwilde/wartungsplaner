-- AlterEnum
ALTER TYPE "PruefpunktArt" ADD VALUE 'LISTE';

-- CreateTable
CREATE TABLE "NachweisZeile" (
    "id" TEXT NOT NULL,
    "nachweisId" TEXT NOT NULL,
    "punktId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "zusatz" TEXT,
    "ergebnis" "PruefpunktErgebnis",
    "bemerkung" TEXT,

    CONSTRAINT "NachweisZeile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NachweisZeile_nachweisId_idx" ON "NachweisZeile"("nachweisId");

-- CreateIndex
CREATE INDEX "NachweisZeile_punktId_idx" ON "NachweisZeile"("punktId");

-- CreateIndex
CREATE UNIQUE INDEX "NachweisZeile_nachweisId_punktId_position_key" ON "NachweisZeile"("nachweisId", "punktId", "position");

-- AddForeignKey
ALTER TABLE "NachweisZeile" ADD CONSTRAINT "NachweisZeile_nachweisId_fkey" FOREIGN KEY ("nachweisId") REFERENCES "Nachweis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NachweisZeile" ADD CONSTRAINT "NachweisZeile_punktId_fkey" FOREIGN KEY ("punktId") REFERENCES "PruefbogenPunkt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
