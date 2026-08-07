'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardPaste, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { formatiereDateigroesse } from '@/lib/labels'
import {
  ACCEPT_ATTRIBUT,
  ERLAUBTE_ENDUNGEN_TEXT,
  nameFuerEinfuegung,
  pruefeDatei,
} from '@/lib/uploads'

/**
 * Die zuletzt eingehängte Eingabe bekommt das Einfügen.
 *
 * Auf dem Dashboard stehen viele Erledigen-Dialoge nebeneinander; geöffnet
 * ist immer nur einer, aber verlassen wollen wir uns darauf nicht. Wer
 * zuletzt erschienen ist, ist auch der sichtbare.
 */
const angemeldet: ((dateien: File[]) => void)[] = []

/**
 * Dateiauswahl mit Einfügen aus der Zwischenablage.
 *
 * Seit die Nachweise Belege aufnehmen, ist der Screenshot der häufigste –
 * und der Umweg über „Speichern unter“ und den Explorer der lästigste Teil
 * daran. Eingefügte und abgelegte Dateien landen im echten Dateifeld, damit
 * das Formular unverändert bleibt: Der Server bekommt sie wie ausgewählte
 * Dateien.
 */
export function DateiEingabe({
  id,
  name,
  required = false,
  hinweis,
  onAnzahl,
  feldRef,
  leerenSignal = 0,
}: {
  id: string
  /** Feldname im Formular; ohne ihn werden die Dateien einzeln verschickt. */
  name?: string
  required?: boolean
  /** Zusatzzeile unter dem Feld. */
  hinweis?: string
  onAnzahl?: (anzahl: number) => void
  /** Zugriff auf das echte Feld, wenn der Aufrufer selbst hochlädt. */
  feldRef?: React.RefObject<HTMLInputElement | null>
  /** Jede Änderung leert die Liste – nach einem erfolgreichen Upload. */
  leerenSignal?: number
}) {
  const eigenesFeld = useRef<HTMLInputElement>(null)
  const feld = feldRef ?? eigenesFeld
  const [dateien, setDateien] = useState<File[]>([])
  const [ueberDemFeld, setUeberDemFeld] = useState(false)

  /** Schreibt die Liste in das echte Dateifeld – daher kommt der Upload. */
  const uebernimm = useCallback(
    (neue: File[]) => {
      const transfer = new DataTransfer()
      for (const datei of neue) transfer.items.add(datei)
      // Das echte Dateifeld ist die Schnittstelle zum Browser, nicht der
      // Zustand der Komponente: Der Upload liest ausschließlich von dort.
      // eslint-disable-next-line react-hooks/immutability
      if (feld.current) feld.current.files = transfer.files
      setDateien(neue)
      onAnzahl?.(neue.length)
    },
    [feld, onAnzahl],
  )

  /** Prüft die gleichen Regeln wie der Server und meldet Abweisungen. */
  const ergaenze = useCallback(
    (zugang: File[]) => {
      if (zugang.length === 0) return
      const angenommen: File[] = []

      for (const datei of zugang) {
        const pruefung = pruefeDatei(datei.name, datei.size, datei.type)
        if (!pruefung.ok) {
          toast.error(pruefung.fehler)
          continue
        }
        angenommen.push(datei)
      }
      if (angenommen.length === 0) return

      setDateien((bisher) => {
        // Zweimal dasselbe Bild einfügen ist fast immer ein Versehen.
        const vorhanden = new Set(bisher.map((d) => `${d.name}:${d.size}`))
        const neue = [
          ...bisher,
          ...angenommen.filter((d) => !vorhanden.has(`${d.name}:${d.size}`)),
        ]

        const transfer = new DataTransfer()
        for (const datei of neue) transfer.items.add(datei)
        // Das echte Dateifeld ist die Schnittstelle zum Browser, nicht der
      // Zustand der Komponente: Der Upload liest ausschließlich von dort.
       
      if (feld.current) feld.current.files = transfer.files
        onAnzahl?.(neue.length)
        return neue
      })
    },
    [feld, onAnzahl],
  )

  const einfuegen = useCallback(
    (aus: File[]) => {
      const benannt: File[] = []
      for (const datei of aus) {
        const name = nameFuerEinfuegung(datei.type, new Date(), datei.name)
        if (!name) {
          toast.error(
            `Aus der Zwischenablage lässt sich dieser Inhalt nicht übernehmen. Erlaubt sind: ${ERLAUBTE_ENDUNGEN_TEXT}.`,
          )
          continue
        }
        benannt.push(new File([datei], name, { type: datei.type }))
      }
      if (benannt.length > 0) {
        ergaenze(benannt)
        toast.success(
          benannt.length === 1
            ? `„${benannt[0].name}“ eingefügt.`
            : `${benannt.length} Dateien eingefügt.`,
        )
      }
    },
    [ergaenze],
  )

  // Einfügen gilt für die ganze Seite: Wer einen Screenshot in der Ablage
  // hat, drückt Strg+V, ohne vorher irgendwohin zu klicken. Reine
  // Texteinfügungen bringen keine Dateien mit und stören daher nicht.
  useEffect(() => {
    angemeldet.push(einfuegen)
    const aufDasEinfuegen = (ereignis: ClipboardEvent) => {
      const aus = Array.from(ereignis.clipboardData?.files ?? [])
      if (aus.length === 0) return
      if (angemeldet[angemeldet.length - 1] !== einfuegen) return
      ereignis.preventDefault()
      einfuegen(aus)
    }

    document.addEventListener('paste', aufDasEinfuegen)
    return () => {
      document.removeEventListener('paste', aufDasEinfuegen)
      const index = angemeldet.indexOf(einfuegen)
      if (index >= 0) angemeldet.splice(index, 1)
    }
  }, [einfuegen])

  // Nach einem erfolgreichen Upload beginnt der Aufrufer von vorn.
  useEffect(() => {
    if (leerenSignal === 0) return
    // eslint-disable-next-line react-hooks/immutability
    if (feld.current) feld.current.value = ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateien([])
    onAnzahl?.(0)
    // Absicht: nur auf das Signal reagieren, nicht auf jede neue Funktion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leerenSignal])

  const entferne = (index: number) =>
    uebernimm(dateien.filter((_, i) => i !== index))

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setUeberDemFeld(true)
        }}
        onDragLeave={() => setUeberDemFeld(false)}
        onDrop={(e) => {
          e.preventDefault()
          setUeberDemFeld(false)
          ergaenze(Array.from(e.dataTransfer.files))
        }}
        className={`rounded-md border border-dashed p-3 transition-colors ${
          ueberDemFeld ? 'border-primary bg-primary/5' : 'border-border'
        }`}
      >
        <input
          id={id}
          ref={feld}
          name={name}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUT}
          required={required && dateien.length === 0}
          onChange={(e) => {
            // Die Auswahl des Browsers ersetzt die Liste nicht, sie ergänzt
            // sie – sonst ginge ein eingefügter Screenshot verloren.
            const gewaehlt = Array.from(e.target.files ?? [])
            const bereitsDrin = new Set(dateien.map((d) => `${d.name}:${d.size}`))
            ergaenze(gewaehlt.filter((d) => !bereitsDrin.has(`${d.name}:${d.size}`)))
          }}
          className="block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ClipboardPaste className="size-3.5" />
            Screenshot mit Strg+V einfügen
          </span>
          <span className="flex items-center gap-1.5">
            <Upload className="size-3.5" />
            oder Dateien hierher ziehen
          </span>
        </p>

        {hinweis ? (
          <p className="mt-1 text-xs text-muted-foreground">{hinweis}</p>
        ) : null}
      </div>

      {dateien.length > 0 ? (
        <ul className="space-y-1">
          {dateien.map((datei, index) => (
            <li
              key={`${datei.name}-${datei.size}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate">
                {datei.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatiereDateigroesse(datei.size)}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => entferne(index)}
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Entfernen</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
