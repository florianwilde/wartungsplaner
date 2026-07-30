-- CreateTable
CREATE TABLE "SicherheitsEinstellung" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "passkeyPflichtRollen" "Role"[] DEFAULT ARRAY[]::"Role"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SicherheitsEinstellung_pkey" PRIMARY KEY ("id")
);
