-- CreateEnum
CREATE TYPE "PruefpunktArt" AS ENUM ('BEWERTUNG', 'TEXT', 'ZAHL', 'DATUM', 'ENTSCHEIDUNG');

-- CreateEnum
CREATE TYPE "PruefpunktErgebnis" AS ENUM ('ERFUELLT', 'NICHT_ERFUELLT', 'ENTFAELLT', 'BELASSEN', 'ENTZIEHEN', 'AENDERN');

-- CreateEnum
CREATE TYPE "NachweisStatus" AS ENUM ('ENTWURF', 'VORGELEGT', 'GEGENGEZEICHNET', 'ZURUECKGEWIESEN');

-- CreateTable
CREATE TABLE "PruefbogenVorlage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "taskId" TEXT,
    "vierAugen" BOOLEAN NOT NULL DEFAULT false,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PruefbogenVorlage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PruefbogenPunkt" (
    "id" TEXT NOT NULL,
    "vorlageId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "frage" TEXT NOT NULL,
    "hinweis" TEXT,
    "art" "PruefpunktArt" NOT NULL DEFAULT 'BEWERTUNG',
    "pflicht" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PruefbogenPunkt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nachweis" (
    "id" TEXT NOT NULL,
    "vorlageId" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "status" "NachweisStatus" NOT NULL DEFAULT 'ENTWURF',
    "bemerkung" TEXT,
    "erfasstById" TEXT NOT NULL,
    "erfasstAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vorgelegtAm" TIMESTAMP(3),
    "geprueftById" TEXT,
    "geprueftAm" TIMESTAMP(3),
    "ablehnungsgrund" TEXT,
    "attachmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nachweis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NachweisAntwort" (
    "id" TEXT NOT NULL,
    "nachweisId" TEXT NOT NULL,
    "punktId" TEXT NOT NULL,
    "ergebnis" "PruefpunktErgebnis",
    "wert" TEXT,
    "bemerkung" TEXT,

    CONSTRAINT "NachweisAntwort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PruefbogenVorlage_name_key" ON "PruefbogenVorlage"("name");

-- CreateIndex
CREATE INDEX "PruefbogenVorlage_taskId_idx" ON "PruefbogenVorlage"("taskId");

-- CreateIndex
CREATE INDEX "PruefbogenPunkt_vorlageId_idx" ON "PruefbogenPunkt"("vorlageId");

-- CreateIndex
CREATE UNIQUE INDEX "PruefbogenPunkt_vorlageId_position_key" ON "PruefbogenPunkt"("vorlageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Nachweis_attachmentId_key" ON "Nachweis"("attachmentId");

-- CreateIndex
CREATE INDEX "Nachweis_occurrenceId_idx" ON "Nachweis"("occurrenceId");

-- CreateIndex
CREATE INDEX "Nachweis_status_idx" ON "Nachweis"("status");

-- CreateIndex
CREATE INDEX "NachweisAntwort_nachweisId_idx" ON "NachweisAntwort"("nachweisId");

-- CreateIndex
CREATE UNIQUE INDEX "NachweisAntwort_nachweisId_punktId_key" ON "NachweisAntwort"("nachweisId", "punktId");

-- AddForeignKey
ALTER TABLE "PruefbogenVorlage" ADD CONSTRAINT "PruefbogenVorlage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PruefbogenPunkt" ADD CONSTRAINT "PruefbogenPunkt_vorlageId_fkey" FOREIGN KEY ("vorlageId") REFERENCES "PruefbogenVorlage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nachweis" ADD CONSTRAINT "Nachweis_vorlageId_fkey" FOREIGN KEY ("vorlageId") REFERENCES "PruefbogenVorlage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nachweis" ADD CONSTRAINT "Nachweis_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nachweis" ADD CONSTRAINT "Nachweis_erfasstById_fkey" FOREIGN KEY ("erfasstById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nachweis" ADD CONSTRAINT "Nachweis_geprueftById_fkey" FOREIGN KEY ("geprueftById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nachweis" ADD CONSTRAINT "Nachweis_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NachweisAntwort" ADD CONSTRAINT "NachweisAntwort_nachweisId_fkey" FOREIGN KEY ("nachweisId") REFERENCES "Nachweis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NachweisAntwort" ADD CONSTRAINT "NachweisAntwort_punktId_fkey" FOREIGN KEY ("punktId") REFERENCES "PruefbogenPunkt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
