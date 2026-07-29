-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportTyp" TEXT NOT NULL,
    "istStandard" BOOLEAN NOT NULL DEFAULT false,
    "ausrichtung" TEXT NOT NULL DEFAULT 'hoch',
    "spalten" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mitDeckblatt" BOOLEAN NOT NULL DEFAULT false,
    "deckblattUntertitel" TEXT,
    "einleitung" TEXT,
    "schluss" TEXT,
    "mitUnterschriften" BOOLEAN NOT NULL DEFAULT false,
    "unterschriftLinks" TEXT,
    "unterschriftRechts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportTemplate_reportTyp_idx" ON "ReportTemplate"("reportTyp");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_reportTyp_name_key" ON "ReportTemplate"("reportTyp", "name");
