# Prüfplan nach ISO/IEC 27001:2022 und TISAX (VDA ISA 6)

Ein einspielbarer Ausgangsbestand: **6 Kategorien**, **49 Audit-Referenzen**,
**30 wiederkehrende Prüfungen** mit Intervall, Fristen und Prüfanleitung
sowie **9 Prüfbögen** für die Prüfungen, bei denen eine strukturierte Liste
trägt.

Gedacht als Startpunkt, nicht als fertiges ISMS. Was hier steht, entspricht
marktüblicher Praxis und typischer Prüfererwartung – **verbindlich ist Ihre
eigene risikobasierte Festlegung.** Beide Normen schreiben meist keine festen
Intervalle vor, sondern verlangen „geplante Abstände".

---

## Vor dem Einspielen: zwei Dinge anpassen

**1. Die verantwortliche Person.** In `3-aufgaben.csv` steht in jeder Zeile
`admin@example.com`. Ersetzen Sie das durch echte E-Mail-Adressen aus Ihrer
Benutzerverwaltung – am einfachsten mit Suchen und Ersetzen. Steht dort eine
unbekannte Adresse, weist der Import die Datei ab und nennt die Zeile.

**2. Die Startdaten.** Sie liegen zwischen August 2026 und Juli 2027 und sind
über das Jahr verteilt, damit nicht zwanzig Jahresprüfungen am selben Tag
fällig werden. Passen Sie sie an Ihren Kalender an – etwa das interne Audit
auf den Monat vor Ihrem Überwachungsaudit.

## Reihenfolge

Die Dateien bauen aufeinander auf. In dieser Reihenfolge einspielen:

| Schritt | Datei | Bereich im Import |
| --- | --- | --- |
| 1 | `1-kategorien.csv` | Kategorien |
| 2 | `2-audit-referenzen.csv` | Audit-Referenzen |
| 3 | `3-aufgaben.csv` | Aufgaben |
| 4 | `4-pruefboegen.csv` | Prüfbögen |

Jeder Schritt zeigt zuerst eine Vorschau. Erst nach Ihrer Bestätigung wird
geschrieben; ein einziger fehlerhafter Datensatz verhindert den ganzen Lauf.

> **Warum die Reihenfolge zählt:** Der Aufgabenimport legt unbekannte
> Audit-Referenzen stillschweigend an – allerdings ohne Bezeichnung. Spielen
> Sie zuerst Datei 2 ein, bekommen die Referenzen ihre vollständigen Angaben.

## Was enthalten ist

| Kategorie | Prüfungen |
| --- | ---: |
| Governance & Managementsystem | 7 |
| Zugriffs- & Identitätsmanagement | 4 |
| IT-Betrieb & technische Sicherheit | 8 |
| Personal & Awareness | 3 |
| Notfall- & Kontinuitätsmanagement | 5 |
| Lieferanten & Dritte | 3 |

Intervalle: 1 monatlich, 3 quartalsweise, 1 halbjährlich, 25 jährlich.

### Die neun Prüfbögen

| Bogen | Zur Aufgabe | Punkte | Gegenzeichnung |
| --- | --- | ---: | --- |
| Restore-Test | Backup-Restore-Test | 9 | ja |
| Rezertifizierung Zugriffsberechtigungen | Rezertifizierung aller Zugriffsberechtigungen | 7 | ja |
| Privilegierte Konten | Review privilegierter und administrativer Konten | 7 | ja |
| Firewall-Regelwerk | Firewall- und Netzwerkregel-Review | 9 | ja |
| Patchstand | Patchmanagement-Kontrolle | 6 | nein |
| Zutrittsrechte | Prüfung physischer Zutrittsrechte | 7 | ja |
| Notfallübung | Notfallübung / BCM-Test | 9 | ja |
| Disaster Recovery | Test der IKT-Bereitschaft | 8 | ja |
| Lieferantenbewertung | Lieferantenbewertung und Review der Dienstleistersicherheit | 10 | nein |

Vier davon nutzen eine **Zeilenliste**: Bei Rezertifizierungen,
privilegierten Konten, Firewall-Regeln und Zutrittsrechten wird der Auszug
aus dem System als CSV übernommen, und je Zeile fällt eine Entscheidung –
belassen, entziehen oder ändern. Genau das erwartet ein Prüfer: einen
Nachweis je Eintrag, nicht die Aussage, dass geprüft wurde.

Die **Gegenzeichnung** ist überall dort verlangt, wo eine zweite Person
einen Unterschied macht. Beim monatlichen Patchstand und der
Lieferantenbewertung wäre sie nur Aufwand.

Jede Aufgabe bringt eine **Prüfanleitung in Markdown** mit: was der Prüfer
erwartet, wie vorzugehen ist und welcher Nachweis entsteht. Sie erscheint auf
der Seite der Aufgabe und lässt sich dort weiter anpassen.

## Zu den Audit-Referenzen

Zwei Rahmenwerke, zugeordnet über Rahmenwerk **und** Kurzzeichen:

- **ISO 27001** – Kapitelnummern (`9.2`) und Anhang-A-Maßnahmen (`A.8.13`)
- **VDA ISA 6** – Nummern des Katalogs (`1.6`, `4.2.1`)

Zusammenfassungen wie `A.5.31–5.36` stehen so, wie der Prüfplan sie führt.
Wollen Sie feiner filtern, legen Sie die einzelnen Maßnahmen an und ordnen sie
den Aufgaben zu.

> **Die Bezeichnungen sind Arbeitstitel** aus dem Prüfplan, nicht der amtliche
> Wortlaut der Normen. Wer den genauen Wortlaut braucht, trägt ihn aus dem
> Normtext nach – die Kurzzeichen bleiben dabei unverändert.

## Was fehlt

**Prüfbögen für die übrigen 21 Prüfungen.** Beigelegt sind die neun, bei
denen eine strukturierte Liste trägt. Für ein Management Review oder eine
Awareness-Schulung ist ein Prüfbogen der falsche Weg – dort entsteht der
Nachweis als Protokoll oder Teilnehmerliste, die man anhängt.

**Ihre Systeme in den Zeilenlisten.** Die vier Bögen mit Zeilenliste sind
vorbereitet, aber leer: Die Zeilen kommen bei jeder Durchführung frisch aus
dem Auszug Ihres Systems.

**Ihre Zuständigkeiten und Schutzbedarfe.** Kritikalität und Nachweispflicht
sind vorbelegt, aber pauschal. Bei sehr hohem Schutzbedarf erwartet TISAX
kürzere Intervalle – etwa Restore-Tests kritischer Systeme quartalsweise
statt jährlich.

---

*Grundlage: ISO/IEC 27001:2022 und VDA ISA Katalog Version 6. Stand Juli 2026.*
