import type { Metadata } from 'next'

import { erforderlicheRolle } from '@/lib/session'
import { holeBranding } from '@/server/branding'
import { ErscheinungsbildFormular } from './erscheinungsbild-formular'

export const metadata: Metadata = { title: 'Erscheinungsbild' }
export const dynamic = 'force-dynamic'

export default async function ErscheinungsbildSeite() {
  await erforderlicheRolle('ADMIN')
  const branding = await holeBranding()

  return (
    <ErscheinungsbildFormular
      werte={{
        appName: branding.appName,
        organisation: branding.organisation,
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        reportFooter: branding.reportFooter ?? '',
        hatLogo: Boolean(branding.logoPath),
        hatLogoDunkel: Boolean(branding.logoDarkPath),
        hatFavicon: Boolean(branding.faviconPath),
      }}
    />
  )
}
