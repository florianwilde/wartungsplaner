-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "archiviertAm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "aufbewahrungMonate" INTEGER;

-- CreateTable
CREATE TABLE "AufbewahrungsEinstellung" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "aktiv" BOOLEAN NOT NULL DEFAULT false,
    "standardMonate" INTEGER NOT NULL DEFAULT 120,
    "letzterLaufAm" TIMESTAMP(3),
    "letzteAnzahl" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AufbewahrungsEinstellung_pkey" PRIMARY KEY ("id")
);
