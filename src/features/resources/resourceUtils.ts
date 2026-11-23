export function splitEntries(value: string) {
  return [...new Set(value.split(/[,\n]/).map((part) => part.trim()).filter(Boolean))]
}

export function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
}

export function parseWebUrl(value: string): URL | undefined {
  try {
    const url = new URL(value.trim())
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url
  } catch {
    return undefined
  }
}

export function addDays(date: number, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result.getTime()
}

export function toDateInput(value: number) {
  const date = new Date(value)
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return [year, month, day].join('-')
}

export function fromDateInput(value: string) {
  return new Date(value + 'T00:00:00').getTime()
}
