import type {
  Criticality,
  ExecutionResult,
  FindingStatus,
  OccurrenceStatus,
  Severity,
} from '@/generated/prisma/client'

import { Badge } from '@/components/ui/badge'
import {
  ABWEICHUNG_STATUS_BEZEICHNUNG,
  ERGEBNIS_BEZEICHNUNG,
  KRITIKALITAET_BEZEICHNUNG,
  SCHWERE_BEZEICHNUNG,
  STATUS_BEZEICHNUNG,
} from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Ampel } from '@/lib/scheduling'

export function FaelligkeitsStatusBadge({ status }: { status: OccurrenceStatus }) {
  const variante = {
    OPEN: 'neutral',
    DONE: 'ok',
    OVERDUE: 'danger',
    SUSPENDED: 'secondary',
  } as const

  return <Badge variant={variante[status]}>{STATUS_BEZEICHNUNG[status]}</Badge>
}

export function AmpelBadge({ ampel }: { ampel: Ampel }) {
  if (ampel === 'ueberfaellig') return <Badge variant="danger">Überfällig</Badge>
  if (ampel === 'bald') return <Badge variant="warn">Bald fällig</Badge>
  return <Badge variant="neutral">Offen</Badge>
}

export function ErgebnisBadge({ ergebnis }: { ergebnis: ExecutionResult }) {
  const variante = {
    OK: 'ok',
    OK_WITH_REMARKS: 'warn',
    DEVIATION: 'danger',
  } as const

  return <Badge variant={variante[ergebnis]}>{ERGEBNIS_BEZEICHNUNG[ergebnis]}</Badge>
}

export function SchwereBadge({ schwere }: { schwere: Severity }) {
  const variante = {
    LOW: 'neutral',
    MEDIUM: 'warn',
    HIGH: 'danger',
    CRITICAL: 'danger',
  } as const

  return <Badge variant={variante[schwere]}>{SCHWERE_BEZEICHNUNG[schwere]}</Badge>
}

export function AbweichungStatusBadge({ status }: { status: FindingStatus }) {
  const variante = {
    OPEN: 'danger',
    IN_PROGRESS: 'warn',
    CLOSED: 'ok',
  } as const

  return (
    <Badge variant={variante[status]}>{ABWEICHUNG_STATUS_BEZEICHNUNG[status]}</Badge>
  )
}

export function KritikalitaetBadge({ kritikalitaet }: { kritikalitaet: Criticality }) {
  const variante = {
    LOW: 'neutral',
    MEDIUM: 'secondary',
    HIGH: 'danger',
  } as const

  return (
    <Badge variant={variante[kritikalitaet]}>
      {KRITIKALITAET_BEZEICHNUNG[kritikalitaet]}
    </Badge>
  )
}

/** Farbiger Punkt einer Kategorie. */
export function KategoriePunkt({
  farbe,
  className,
}: {
  farbe: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: farbe }}
    />
  )
}
