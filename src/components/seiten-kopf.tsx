export function SeitenKopf({
  titel,
  beschreibung,
  aktionen,
}: {
  titel: string
  beschreibung?: string
  aktionen?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
        {beschreibung ? (
          <p className="mt-1 text-sm text-muted-foreground">{beschreibung}</p>
        ) : null}
      </div>
      {aktionen ? (
        <div className="kein-druck flex shrink-0 flex-wrap items-center gap-2">
          {aktionen}
        </div>
      ) : null}
    </div>
  )
}

export function LeerHinweis({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </p>
  )
}
