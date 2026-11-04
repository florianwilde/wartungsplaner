/**
 * Grundbestand für eine frische Installation.
 *
 * Angelegt wird ausschließlich das erste Verwaltungskonto – sonst nichts.
 * Ein neu ausgerollter Wartungsplaner ist leer: keine Kategorien, keine
 * Aufgaben, keine Referenzen. Das ist Absicht. Wer eine fremde
 * Aufgabenliste vorgesetzt bekommt, räumt sie entweder auf oder lebt mit
 * Prüfungen, die nie jemand beschlossen hat – und beides ist schlechter
 * als ein leeres Blatt.
 *
 * Einen fertigen Ausgangsbestand nach ISO 27001 und TISAX gibt es zum
 * Einspielen unter `beispiele/pruefplan/`; die Reihenfolge steht in der
 * dortigen LIESMICH.md. Eingespielt wird über
 * *Verwaltung → Import und Export*.
 *
 * Das Skript ist wiederholbar: Ein zweiter Lauf ändert nichts, insbesondere
 * wird ein bereits geändertes Passwort nicht zurückgesetzt.
 *
 * Ausführen:  npm run db:seed
 */
import { erzeugePrismaClient } from '../src/lib/prisma-basis'
import bcrypt from 'bcryptjs'

const prisma = erzeugePrismaClient()

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Start!1234'

async function main() {
  const vorhanden = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  })

  if (vorhanden) {
    console.log(`Konto ${ADMIN_EMAIL} besteht bereits – nichts zu tun.`)
    return
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
  await prisma.user.create({
    data: {
      name: 'Administrator',
      email: ADMIN_EMAIL,
      passwordHash,
      authProvider: 'LOCAL',
      role: 'ADMIN',
      active: true,
      // Erzwingt den Wechsel beim ersten Anmelden. Ein Startpasswort, das
      // in einer öffentlichen Anleitung steht, ist keines.
      mustChangePassword: true,
    },
  })

  console.log(`Verwaltungskonto angelegt: ${ADMIN_EMAIL}`)
  console.log('Das Startpasswort muss beim ersten Anmelden geändert werden.')
  console.log('')
  console.log('Der Bestand ist leer. Ein Ausgangsbestand nach ISO 27001 und')
  console.log('TISAX liegt unter beispiele/pruefplan/ zum Einspielen bereit.')
}

main()
  .catch((error) => {
    console.error('Seed fehlgeschlagen:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
