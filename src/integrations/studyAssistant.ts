import type { Note, Review } from '../domain/types'

export interface StudyAssistantContext {
  topic: string
  notes: Pick<Note, 'title' | 'content'>[]
}

export interface StudyAssistantProvider {
  explain(question: string, context: StudyAssistantContext, signal?: AbortSignal): Promise<string>
  suggestReview(context: StudyAssistantContext, signal?: AbortSignal): Promise<Pick<Review, 'question' | 'answer'>[]>
}
