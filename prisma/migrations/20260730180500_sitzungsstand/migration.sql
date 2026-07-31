-- Sitzungsstand: zaehlt hoch, sobald alle Sitzungen eines Kontos ungueltig
-- werden sollen (Abmelden). Der Wert steckt im Sitzungs-Token; weicht er ab,
-- ist das Token wertlos.
ALTER TABLE "User" ADD COLUMN "sitzungsstand" INTEGER NOT NULL DEFAULT 0;

-- Aufraeumen einer Zwischenfassung, die es nur auf Entwicklungsrechnern gab:
-- Dort stand kurzzeitig ein Zeitstempel statt des Zaehlers. "IF EXISTS", weil
-- die Spalte in keiner ausgelieferten Fassung vorkommt und der Befehl sonst
-- auf jedem anderen Bestand scheitert.
ALTER TABLE "User" DROP COLUMN IF EXISTS "sitzungenUngueltigAb";
