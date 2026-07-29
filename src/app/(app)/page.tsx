import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { erforderlicherBenutzer } from '@/lib/session'

export default async function DashboardSeite() {
  const benutzer = await erforderlicherBenutzer()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Willkommen, {benutzer.name}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wird aufgebaut</CardTitle>
          <CardDescription>
            Die Kennzahlen und Fälligkeitslisten folgen in einem der nächsten
            Schritte.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  )
}
