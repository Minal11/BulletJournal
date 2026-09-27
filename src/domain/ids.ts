export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function monthLogId(year: number, month: number): string {
  return `month-${year}-${month}`
}

export function reflectionId(year: number, month: number): string {
  return `reflection-${year}-${month}`
}

export function reviewId(year: number, quarter: number): string {
  return `review-${year}-q${quarter}`
}
