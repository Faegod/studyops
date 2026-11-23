import { useMemo, useState } from 'react'
import { BookOpen, CircleHelp, FileText, FolderKanban, LibraryBig, Search } from 'lucide-react'
import type { CurriculumNode, Material, Note, Project, Review } from '../../domain/types'
import { Modal } from '../../ui/components'

type SearchDestination = 'trilha' | 'caderno' | 'biblioteca' | 'projetos' | 'revisoes'
type SearchEntry = { id: string; title: string; text: string; destination: SearchDestination }

const headings = {
  trilha: ['Trilha', BookOpen],
  caderno: ['Caderno', FileText],
  biblioteca: ['Biblioteca', LibraryBig],
  projetos: ['Projetos', FolderKanban],
  revisoes: ['Revisões', CircleHelp],
} as const

const normalize = (value: string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '')

export default function SearchModal({ nodes, notes, materials, projects, reviews, onClose, onOpen }: {
  nodes: CurriculumNode[]
  notes: Note[]
  materials: Material[]
  projects: Project[]
  reviews: Review[]
  onClose: () => void
  onOpen: (destination: SearchDestination, id: string) => void
}) {
  const [query, setQuery] = useState('')
  const index = useMemo<SearchEntry[]>(() => [
    ...nodes.map((item) => ({ id: item.id, title: item.title, text: [item.description, ...item.objectives].join(' '), destination: 'trilha' as const })),
    ...notes.map((item) => ({ id: item.id, title: item.title, text: [item.content, ...item.tags].join(' '), destination: 'caderno' as const })),
    ...materials.map((item) => ({ id: item.id, title: item.title, text: [item.source, item.subject, item.language, item.type].join(' '), destination: 'biblioteca' as const })),
    ...projects.map((item) => ({ id: item.id, title: item.title, text: [item.objective, item.notes, ...item.skills].join(' '), destination: 'projetos' as const })),
    ...reviews.map((item) => ({ id: item.id, title: item.question, text: item.answer, destination: 'revisoes' as const })),
  ], [nodes, notes, materials, projects, reviews])
  const words = normalize(query).trim().split(/\s+/).filter(Boolean)
  const results = words.length ? index.filter((item) => words.every((word) => normalize(`${item.title} ${item.text}`).includes(word))).slice(0, 30) : []
  return (
    <Modal title="Buscar no StudyOps" onClose={onClose}>
      <form className="global-search-form" onSubmit={(event) => {
        event.preventDefault()
        if (results[0]) onOpen(results[0].destination, results[0].id)
      }}>
        <Search size={18} />
        <input type="search" className="text-input" aria-label="Buscar em todos os estudos" placeholder="Tópicos, anotações, materiais…" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
      </form>
      {words.length ? results.length ? (
        <ul className="global-search-results">
          {results.map(({ id, title, destination }) => {
            const [label, Icon] = headings[destination]
            return <li key={`${destination}-${id}`}><button onClick={() => onOpen(destination, id)}><Icon size={16} /><strong>{title}</strong><span>{label}</span></button></li>
          })}
        </ul>
      ) : <p className="global-search-empty">Nenhum resultado para “{query}”.</p> : <p className="global-search-empty">Busque na trilha, no caderno, na biblioteca, nos projetos ou nas revisões.</p>}
    </Modal>
  )
}
