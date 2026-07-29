import { STANDARD_BILDMARKE, STANDARD_LOGO, type Branding } from '@/lib/branding'
import { cn } from '@/lib/utils'

/**
 * Zeigt das konfigurierte Logo.
 *
 * Ist unter `/admin/erscheinungsbild` eine eigene Datei hinterlegt, wird
 * diese ausgeliefert, sonst das mitgelieferte Standardlogo. Die Einbindung
 * erfolgt immer über `<img>` – dadurch werden Skripte in hochgeladenen
 * SVG-Dateien nicht ausgeführt.
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
  const eigenesLogo = branding.logoPath ? '/api/branding/logo' : null
  const quelle =
    eigenesLogo ??
    (variante === 'bildmarke' ? STANDARD_BILDMARKE : STANDARD_LOGO)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={quelle}
      alt={branding.organisation || branding.appName}
      className={cn('w-auto object-contain', className)}
    />
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
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      {branding.logoPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/api/branding/logo"
          alt={branding.organisation || branding.appName}
          className="h-7 w-auto max-w-40 object-contain"
        />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={STANDARD_BILDMARKE} alt="" aria-hidden className="size-7" />
          <span className="text-sm font-semibold tracking-tight">
            {branding.appName}
          </span>
        </>
      )}
    </span>
  )
}
