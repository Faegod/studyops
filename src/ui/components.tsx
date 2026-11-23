import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function PageHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <dialog
      className="app-modal"
      ref={(element) => { if (element && !element.open) element.showModal() }}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      aria-label={title}
    >
      <div className="app-modal-inner">
        <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></header>
        {children}
      </div>
    </dialog>
  )
}
