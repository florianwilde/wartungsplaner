/**
 * Passkeys: Aufgabenverwaltung, Registrierung und Prüfung.
 *
 * Die kryptografische Arbeit übernimmt @simplewebauthn/server. Hier liegt die
 * Anbindung an Datenbank und Konfiguration.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/types'

import { prisma } from '@/lib/prisma'
import {
  MAX_PASSKEYS_JE_BENUTZER,
  challengeAblauf,
  istChallengeGueltig,
  rpIdAus,
  ursprungAus,
} from '@/lib/webauthn'

/** Konfigurierte Adresse der Anwendung. */
export function appUrl(): string {
  return (process.env.APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '')
}

function rpId(): string {
  return rpIdAus(appUrl())
}

function ursprung(): string {
  return ursprungAus(appUrl())
}

/** Anzeigename der Anwendung im Anmeldedialog des Betriebssystems. */
async function rpName(): Promise<string> {
  const branding = await prisma.branding
    .findUnique({ where: { id: 'singleton' }, select: { appName: true } })
    .catch(() => null)
  return branding?.appName?.trim() || 'Wartungsplaner'
}

// ---------------------------------------------------------------------------
// Aufgabenverwaltung (Challenges)
// ---------------------------------------------------------------------------

/** Legt eine Aufgabe an und liefert deren Kennung für das Cookie. */
async function merkeChallenge(
  challenge: string,
  absicht: 'REGISTRIERUNG' | 'ANMELDUNG',
  userId: string | null,
): Promise<string> {
  const jetzt = new Date()
  const eintrag = await prisma.webAuthnChallenge.create({
    data: {
      challenge,
      absicht,
      userId,
      expiresAt: challengeAblauf(jetzt),
    },
    select: { id: true },
  })

  // Gelegenheit zum Aufräumen: abgelaufene Aufgaben entfernen.
  await prisma.webAuthnChallenge
    .deleteMany({ where: { expiresAt: { lt: jetzt } } })
    .catch(() => undefined)

  return eintrag.id
}

/**
 * Holt eine Aufgabe und entfernt sie unmittelbar – jede Aufgabe darf nur ein
 * einziges Mal verwendet werden.
 */
async function verbraucheChallenge(
  id: string,
  absicht: 'REGISTRIERUNG' | 'ANMELDUNG',
): Promise<{ challenge: string; userId: string | null } | null> {
  const eintrag = await prisma.webAuthnChallenge.findUnique({ where: { id } })
  if (!eintrag) return null

  await prisma.webAuthnChallenge.delete({ where: { id } }).catch(() => undefined)

  if (eintrag.absicht !== absicht) return null
  if (!istChallengeGueltig(eintrag.expiresAt, new Date())) return null

  return { challenge: eintrag.challenge, userId: eintrag.userId }
}

// ---------------------------------------------------------------------------
// Registrierung
// ---------------------------------------------------------------------------

export type RegistrierungStart = {
  optionen: Awaited<ReturnType<typeof generateRegistrationOptions>>
  vorgangId: string
}

/**
 * Erzeugt die Optionen für die Registrierung eines neuen Passkeys.
 * Bereits vorhandene Schlüssel werden ausgeschlossen, damit dasselbe Gerät
 * nicht mehrfach registriert wird.
 */
export async function starteRegistrierung(
  benutzerId: string,
): Promise<RegistrierungStart> {
  const benutzer = await prisma.user.findUniqueOrThrow({
    where: { id: benutzerId },
    select: {
      id: true,
      name: true,
      email: true,
      passkeys: { select: { credentialId: true, transports: true } },
    },
  })

  if (benutzer.passkeys.length >= MAX_PASSKEYS_JE_BENUTZER) {
    throw new Error(
      `Es sind bereits ${MAX_PASSKEYS_JE_BENUTZER} Passkeys hinterlegt. Bitte entfernen Sie zuerst einen.`,
    )
  }

  const optionen = await generateRegistrationOptions({
    rpName: await rpName(),
    rpID: rpId(),
    // Kennung des Kontos, wie sie im Passkey hinterlegt wird
    userID: benutzer.id,
    userName: benutzer.email,
    userDisplayName: benutzer.name,
    // Verhindert, dass dasselbe Gerät zweimal registriert wird.
    excludeCredentials: benutzer.passkeys.map((p) => ({
      id: Buffer.from(p.credentialId, 'base64url'),
      type: 'public-key' as const,
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      // Auffindbare Schlüssel erlauben die Anmeldung ohne Eingabe der
      // E-Mail-Adresse.
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    attestationType: 'none',
  })

  const vorgangId = await merkeChallenge(
    optionen.challenge,
    'REGISTRIERUNG',
    benutzerId,
  )

  return { optionen, vorgangId }
}

/** Prüft die Antwort des Browsers und legt den Passkey an. */
export async function schliesseRegistrierungAb(
  benutzerId: string,
  vorgangId: string,
  antwort: RegistrationResponseJSON,
  name: string,
): Promise<{ id: string; name: string }> {
  const vorgang = await verbraucheChallenge(vorgangId, 'REGISTRIERUNG')
  if (!vorgang) {
    throw new Error('Der Vorgang ist abgelaufen. Bitte erneut versuchen.')
  }
  if (vorgang.userId !== benutzerId) {
    throw new Error('Der Vorgang gehört zu einem anderen Konto.')
  }

  const ergebnis = await verifyRegistrationResponse({
    response: antwort,
    expectedChallenge: vorgang.challenge,
    expectedOrigin: ursprung(),
    expectedRPID: rpId(),
    requireUserVerification: false,
  })

  if (!ergebnis.verified || !ergebnis.registrationInfo) {
    throw new Error('Der Passkey konnte nicht bestätigt werden.')
  }

  const info = ergebnis.registrationInfo
  const passkey = await prisma.passkey.create({
    data: {
      userId: benutzerId,
      credentialId: Buffer.from(info.credentialID).toString('base64url'),
      publicKey: Buffer.from(info.credentialPublicKey).toString('base64url'),
      counter: info.counter,
      transports: (antwort.response.transports ?? []) as string[],
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      name,
    },
    select: { id: true, name: true },
  })

  return passkey
}

// ---------------------------------------------------------------------------
// Anmeldung
// ---------------------------------------------------------------------------

export type AnmeldungStart = {
  optionen: Awaited<ReturnType<typeof generateAuthenticationOptions>>
  vorgangId: string
}

/**
 * Erzeugt die Optionen für die Anmeldung.
 *
 * Es wird bewusst keine Liste erlaubter Schlüssel mitgegeben: Der Browser
 * bietet dann alle für diese Anwendung hinterlegten Passkeys an, ohne dass
 * vorher eine E-Mail-Adresse eingegeben werden muss. Zugleich verrät die
 * Anwendung damit nichts über vorhandene Konten.
 */
export async function starteAnmeldung(): Promise<AnmeldungStart> {
  const optionen = await generateAuthenticationOptions({
    rpID: rpId(),
    userVerification: 'preferred',
  })

  const vorgangId = await merkeChallenge(optionen.challenge, 'ANMELDUNG', null)

  return { optionen, vorgangId }
}

export type AnmeldungErgebnis = {
  benutzerId: string
  passkeyId: string
  passkeyName: string
}

/**
 * Prüft die Antwort des Browsers und liefert den zugehörigen Benutzer.
 *
 * @throws mit deutschsprachigem Text, wenn die Prüfung scheitert.
 */
export async function pruefeAnmeldung(
  vorgangId: string,
  antwort: AuthenticationResponseJSON,
): Promise<AnmeldungErgebnis> {
  const vorgang = await verbraucheChallenge(vorgangId, 'ANMELDUNG')
  if (!vorgang) {
    throw new Error('Der Anmeldevorgang ist abgelaufen. Bitte erneut versuchen.')
  }

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: antwort.id },
    include: {
      user: { select: { id: true, active: true } },
    },
  })

  if (!passkey) {
    throw new Error('Dieser Passkey ist nicht hinterlegt.')
  }
  if (!passkey.user.active) {
    throw new Error('Das Konto ist deaktiviert.')
  }

  const ergebnis = await verifyAuthenticationResponse({
    response: antwort,
    expectedChallenge: vorgang.challenge,
    expectedOrigin: ursprung(),
    expectedRPID: rpId(),
    requireUserVerification: false,
    authenticator: {
      credentialID: new Uint8Array(Buffer.from(passkey.credentialId, 'base64url')),
      credentialPublicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
      counter: passkey.counter,
      transports: passkey.transports as AuthenticatorTransportFuture[],
    },
  })

  if (!ergebnis.verified) {
    throw new Error('Der Passkey konnte nicht bestätigt werden.')
  }

  // Der Zähler erkennt geklonte Schlüssel: Er darf nie zurückspringen.
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: ergebnis.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  })

  return {
    benutzerId: passkey.user.id,
    passkeyId: passkey.id,
    passkeyName: passkey.name,
  }
}

// ---------------------------------------------------------------------------
// Verwaltung
// ---------------------------------------------------------------------------

export async function ladePasskeys(benutzerId: string) {
  return prisma.passkey.findMany({
    where: { userId: benutzerId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
    },
  })
}

export async function zaehlePasskeys(benutzerId: string): Promise<number> {
  return prisma.passkey.count({ where: { userId: benutzerId } })
}
