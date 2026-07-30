-- CreateTable
CREATE TABLE "IntegritaetsLauf" (
    "id" TEXT NOT NULL,
    "gestartetAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dauerMs" INTEGER NOT NULL,
    "ausgeloestById" TEXT,
    "geprueft" INTEGER NOT NULL,
    "fehlend" INTEGER NOT NULL,
    "abweichend" INTEGER NOT NULL,
    "verwaist" INTEGER NOT NULL,
    "unlesbar" INTEGER NOT NULL,
    "befundeJson" JSONB,

    CONSTRAINT "IntegritaetsLauf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegritaetsLauf_gestartetAm_idx" ON "IntegritaetsLauf"("gestartetAm");

-- AddForeignKey
ALTER TABLE "IntegritaetsLauf" ADD CONSTRAINT "IntegritaetsLauf_ausgeloestById_fkey" FOREIGN KEY ("ausgeloestById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
