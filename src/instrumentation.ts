/**
 * Wird von Next.js einmalig beim Start des Servers ausgeführt.
 * Hier wird der tägliche Hintergrundjob registriert.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { registriereTaeglichenJob } = await import('@/server/cron')
  registriereTaeglichenJob()
}
