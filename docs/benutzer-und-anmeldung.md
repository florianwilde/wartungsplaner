[← Handbuch](README.md)

# Benutzer und Anmeldung

## Konten anlegen

Unter **Administration → Benutzer**. Es gibt keine Selbstregistrierung: Konten
legt ausschließlich die Administration an.

Beim Anlegen wird ein Startpasswort vergeben. Bei der ersten Anmeldung muss es
geändert werden.

## Konten deaktivieren statt löschen

Ein Konto, das im Audit-Log vorkommt, lässt sich **nicht löschen** – sonst
verlöre das Protokoll seinen Bezug: „Wer hat diese Prüfung durchgeführt?“ wäre
nicht mehr zu beantworten.

Stattdessen wird es **deaktiviert**. Die Anmeldung ist damit ausgeschlossen,
alle Einträge bleiben nachvollziehbar. Eine deaktivierte Person bleibt an ihren
bisherigen Aufgaben als verantwortlich eingetragen, bis jemand anderes
eingetragen wird.

## Passkeys

Ein Passkey (Windows Hello, Touch ID, Sicherheitsschlüssel) ersetzt das
Passwort. Er lässt sich nicht abphishen und nicht wiederverwenden.

**Einrichten:** Konto → *Passkeys* → *Passkey hinterlegen*. Bis zu zehn je
Konto, benennbar und einzeln entfernbar.

**Anmelden:** Auf der Anmeldeseite genügt der Passkey – die E-Mail-Adresse
muss nicht eingegeben werden. Die Anwendung gibt dabei keine Auskunft darüber,
ob ein Konto existiert.

Passkeys werden nur angeboten, wenn die Anwendung über **HTTPS** (oder
localhost) erreichbar ist. Andernfalls erscheint ein Hinweis statt einer
unverständlichen Browsermeldung.

Der letzte Passkey eines Kontos ohne Passwort lässt sich nicht entfernen –
sonst bliebe der Zugang verschlossen. Nach einem Geräteverlust kann die
Administration alle Passkeys eines Kontos zurücksetzen.

## Passkey-Pflicht

Für einzelne Rollen lässt sich ein hinterlegter Passkey verlangen –
einzustellen unter **Administration → System**. Wer keinen hat, wird bei der
nächsten Anmeldung zur Einrichtung geführt, bevor er weiterarbeiten kann.

Drei Ausnahmen sorgen dafür, dass dabei niemand ausgesperrt wird:

- **Ohne HTTPS** bietet kein Browser die Registrierung an. Die Pflicht bleibt
  dann wirkungslos und lässt sich gar nicht erst einschalten.
- **SSO-Konten** sind ausgenommen: Dort gibt es bereits ein Verfahren, und ein
  zweiter Faktor gehört in den Identity Provider.
- Beim Einschalten nennt die Anwendung, **wie viele Personen betroffen** wären,
  und weist ausdrücklich darauf hin, wenn Sie selbst dazugehören.

## Anmeldung über SSO

Ist ein OIDC-Provider konfiguriert, erscheint zusätzlich die Schaltfläche für
das Unternehmens-SSO. Beim ersten Anmelden wird das Konto angelegt oder – bei
gleicher E-Mail-Adresse – mit einem bestehenden verknüpft. Die Rolle vergibt
weiterhin die Administration.

Einrichtung siehe [README](../README.md#anmeldung-über-sso-oidc).

## Schutz vor Ausprobieren

Nach fünf Fehlversuchen innerhalb von 15 Minuten wird die Anmeldung für
15 Minuten gesperrt – auch bei anschließend richtigem Passwort. Gezählt wird
je Kombination aus E-Mail-Adresse und Herkunftsadresse. Jeder Versuch steht im
Audit-Log.

## Eigenes Konto

Unter **Konto** sehen Sie Ihre Angaben, ändern das Passwort, verwalten Passkeys
samt Zeitpunkt der letzten Verwendung und schalten die Benachrichtigungen ab.
