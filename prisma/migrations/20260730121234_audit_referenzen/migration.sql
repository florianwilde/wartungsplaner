-- CreateTable
CREATE TABLE "AuditReferenz" (
    "id" TEXT NOT NULL,
    "kuerzel" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "rahmenwerk" TEXT,
    "beschreibung" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditReferenz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAuditReferenz" (
    "taskId" TEXT NOT NULL,
    "referenzId" TEXT NOT NULL,

    CONSTRAINT "TaskAuditReferenz_pkey" PRIMARY KEY ("taskId","referenzId")
);

-- CreateIndex
CREATE INDEX "AuditReferenz_aktiv_idx" ON "AuditReferenz"("aktiv");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReferenz_rahmenwerk_kuerzel_key" ON "AuditReferenz"("rahmenwerk", "kuerzel");

-- CreateIndex
CREATE INDEX "TaskAuditReferenz_referenzId_idx" ON "TaskAuditReferenz"("referenzId");

-- AddForeignKey
ALTER TABLE "TaskAuditReferenz" ADD CONSTRAINT "TaskAuditReferenz_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAuditReferenz" ADD CONSTRAINT "TaskAuditReferenz_referenzId_fkey" FOREIGN KEY ("referenzId") REFERENCES "AuditReferenz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Bestehende Freitexte übernehmen
--
-- Die Audit-Referenz war bisher ein Freitextfeld an der Aufgabe. Beim Update
-- soll nichts verlorengehen: Jeder vorhandene Text wird zu einem Stammsatz,
-- und die Aufgaben werden ihm zugeordnet. Gleiche Texte ergeben denselben
-- Stammsatz, sodass aus zehn Aufgaben mit "ISO 27001 A.8.13" eine Referenz
-- mit zehn Zuordnungen wird - genau der Zustand, den man haben will.
--
-- Die Aufteilung in Rahmenwerk und Kurzzeichen wird bewusst NICHT geraten.
-- Der vollstaendige Text kommt ins Kurzzeichen; das Ordnen nach Rahmenwerken
-- ist eine fachliche Entscheidung und gehoert in die Verwaltung, nicht in
-- eine Migration.
-- ---------------------------------------------------------------------------

INSERT INTO "AuditReferenz" ("id", "kuerzel", "bezeichnung", "aktiv", "sortOrder", "createdAt", "updatedAt")
SELECT
  md5('audit-referenz:' || btrim("auditReference")),
  btrim("auditReference"),
  btrim("auditReference"),
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Task"
WHERE "auditReference" IS NOT NULL
  AND btrim("auditReference") <> ''
GROUP BY btrim("auditReference");

INSERT INTO "TaskAuditReferenz" ("taskId", "referenzId")
SELECT
  "id",
  md5('audit-referenz:' || btrim("auditReference"))
FROM "Task"
WHERE "auditReference" IS NOT NULL
  AND btrim("auditReference") <> '';
