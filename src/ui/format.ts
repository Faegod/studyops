const clockFormatter = new Intl.NumberFormat('pt-BR', { minimumIntegerDigits: 2 })
export const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
export const fullDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

export function formatClock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return [Math.floor(seconds / 60), seconds % 60].map((value) => clockFormatter.format(value)).join(':')
}

export function formatStudyTime(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60000)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h${minutes % 60 ? ` ${minutes % 60}min` : ''}` : minutes ? `${minutes} min` : ms > 0 ? '<1 min' : '0 min'
}

export function startOfDay(date: number | Date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

export function nextDay(date: number | Date, days = 1) {
  const next = new Date(startOfDay(date))
  next.setDate(next.getDate() + days)
  return next.getTime()
}
