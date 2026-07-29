import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Rendert die Prüfanleitung.
 *
 * Bewusst ohne `rehype-raw`: eingebettetes HTML wird nicht ausgeführt,
 * sondern als Text behandelt. Damit kann über eine Prüfanleitung kein
 * Skript in die Oberfläche gelangen.
 */
export function MarkdownAnzeige({ inhalt }: { inhalt: string }) {
  return (
    <div className="prosa text-sm">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {inhalt}
      </Markdown>
    </div>
  )
}
