import { STANDARD_BILDMARKE, STANDARD_LOGO, type Branding } from '@/lib/branding'
import { cn } from '@/lib/utils'

/**
 * Zeigt das konfigurierte Logo.
 *
 * Ist unter `/admin/erscheinungsbild` eine eigene Datei hinterlegt, wird
 * diese ausgeliefert, sonst das mitgelieferte Standardlogo. Die Einbindung
 * erfolgt immer über `<img>` – dadurch werden Skripte in hochgeladenen
 * SVG-Dateien nicht ausgeführt.
 *
 * Liegt zusätzlich ein Logo für dunklen Hintergrund vor, werden beide
 * ausgeliefert und per CSS umgeschaltet. Das ist bewusst so gelöst: Ein
 * Wechsel des Farbschemas käme sonst erst nach einem erneuten Rendern an.
 */
export function Markenzeichen({
  branding,
  variante = 'wortmarke',
  className,
}: {
  branding: Branding
  /** "wortmarke" = Logo mit Schriftzug, "bildmarke" = nur das Signet */
  variante?: 'wortmarke' | 'bildmarke'
  className?: string
}) {
  const beschriftung = branding.organisation || branding.appName
  const gemeinsam = cn('w-auto object-contain', className)

  if (branding.logoPath && branding.logoDarkPath) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/branding/logo"
          alt={beschriftung}
          className={cn(gemeinsam, 'block dark:hidden')}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/branding/logo-dunkel"
          alt={beschriftung}
          className={cn(gemeinsam, 'hidden dark:block')}
        />
      </>
    )
  }

  const quelle = branding.logoPath
    ? '/api/branding/logo'
    : variante === 'bildmarke'
      ? STANDARD_BILDMARKE
      : STANDARD_LOGO

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={quelle} alt={beschriftung} className={gemeinsam} />
  )
}

/**
 * Logo mit Anwendungsnamen – für die Kopfzeile des angemeldeten Bereichs.
 * Bei eigenem Logo wird dieses gezeigt, sonst Bildmarke plus Schriftzug.
 */
export function MarkenzeichenKompakt({
  branding,
  className,
}: {
  branding: Branding
  className?: string
}) {
  if (branding.logoPath) {
    return (
      <span className={cn('flex items-center', className)}>
        <Markenzeichen branding={branding} className="h-7 max-w-40" />
      </span>
    )
  }

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={STANDARD_BILDMARKE} alt="" aria-hidden className="size-7" />
      <span className="text-sm font-semibold tracking-tight">{branding.appName}</span>
    </span>
  )
}
