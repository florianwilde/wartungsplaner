-- CreateTable
CREATE TABLE "Branding" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "appName" TEXT NOT NULL DEFAULT 'Wartungsplaner',
    "organisation" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#1B7CB5',
    "accentColor" TEXT NOT NULL DEFAULT '#2F9BD8',
    "logoPath" TEXT,
    "logoDarkPath" TEXT,
    "faviconPath" TEXT,
    "reportFooter" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Branding_pkey" PRIMARY KEY ("id")
);
