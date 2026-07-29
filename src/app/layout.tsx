import type { Metadata } from 'next'
import { Toaster } from 'sonner'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Wartungsplaner',
    template: '%s · Wartungsplaner',
  },
  description:
    'Verwaltung wiederkehrender IT-Prüf- und Wartungsaufgaben mit revisionssicherem Nachweis.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
