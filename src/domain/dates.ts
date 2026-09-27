const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseISODate(value)
  return toISODate(date) === value
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayISO(now = new Date()): string {
  return toISODate(now)
}

export function currentTime(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  const nextYear = Math.floor(total / 12)
  const nextMonth = total - nextYear * 12 + 1
  return { year: nextYear, month: nextMonth }
}

export function monthOf(iso: string): { year: number; month: number; day: number } {
  const date = parseISODate(iso)
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

export function nextMonthOf(iso: string): { year: number; month: number } {
  const parts = monthOf(iso)
  return shiftMonth(parts.year, parts.month, 1)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function weekdayIndex(iso: string): number {
  return parseISODate(iso).getDay()
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[weekdayIndex(iso)] ?? ''
}

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? ''
}

export function monthShort(month: number): string {
  return MONTHS_SHORT[month - 1] ?? ''
}

export function formatDayHeading(iso: string): string {
  const date = parseISODate(iso)
  const weekday = (WEEKDAYS[date.getDay()] ?? '').toUpperCase()
  const month = (MONTHS_SHORT[date.getMonth()] ?? '').toUpperCase()
  return `${weekday} ${month} ${date.getDate()}`
}

export function formatFriendlyDate(iso: string, format: 'mdy' | 'dmy' = 'mdy'): string {
  const date = parseISODate(iso)
  const month = MONTHS[date.getMonth()]
  if (format === 'dmy') return `${date.getDate()} ${month} ${date.getFullYear()}`
  return `${month} ${date.getDate()}, ${date.getFullYear()}`
}

export function formatShortDate(iso: string): string {
  const date = parseISODate(iso)
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`
}

export function formatMonthYear(year: number, month: number): string {
  return `${monthName(month)} ${year}`
}

export function formatDisplayTime(hhmm: string): string {
  const [hourText, minuteText] = hhmm.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return hhmm
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:${pad(minute)}`
}

export function formatComposerTime(hhmm: string): string {
  const hour = Number(hhmm.split(':')[0])
  if (!Number.isFinite(hour)) return hhmm
  return `${formatDisplayTime(hhmm)} ${hour >= 12 ? 'pm' : 'am'}`
}

export function normalizeTime(value: string): string | null {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  const suffix = match[3]
  if (suffix === 'pm' && hour < 12) hour += 12
  if (suffix === 'am' && hour === 12) hour = 0
  if (!suffix && hour <= 12 && value.toLowerCase().includes('pm')) hour += 12
  if (hour > 23 || minute > 59) return null
  return `${pad(hour)}:${pad(minute)}`
}

export function hourOf(hhmm: string): number {
  const hour = Number(hhmm.split(':')[0])
  return Number.isFinite(hour) ? hour : -1
}

export function quarterOf(year: number, month: number): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const quarter = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4
  return { year, quarter }
}

export function monthsOfQuarter(quarter: 1 | 2 | 3 | 4): number[] {
  const start = (quarter - 1) * 3 + 1
  return [start, start + 1, start + 2]
}

export function quarterLabel(year: number, quarter: number): string {
  return `Q${quarter} ${year}`
}

export function quarterSpan(year: number, quarter: 1 | 2 | 3 | 4): string {
  const months = monthsOfQuarter(quarter)
  const first = monthShort(months[0] ?? 1).toUpperCase()
  const last = monthShort(months[2] ?? 1).toUpperCase()
  return `${first}–${last} ${year}`
}

export function isLastWeekOfMonth(iso: string): boolean {
  const { year, month, day } = monthOf(iso)
  return day > daysInMonth(year, month) - 7
}

export function dateInMonth(iso: string, year: number, month: number): boolean {
  const parts = monthOf(iso)
  return parts.year === year && parts.month === month
}

export function weekDates(iso: string, weekStartsOn: 0 | 1): string[] {
  const day = weekdayIndex(iso)
  const delta = weekStartsOn === 1 ? (day === 0 ? -6 : 1 - day) : -day
  const start = addDays(iso, delta)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`
}

export function clampMonth(month: number): number {
  if (month < 1) return 1
  if (month > 12) return 12
  return month
}

export function upcomingMonths(year: number, month: number, count = 12): Array<{ year: number; month: number; label: string }> {
  return Array.from({ length: count }, (_, index) => {
    const next = shiftMonth(year, month, index + 1)
    return { ...next, label: formatMonthYear(next.year, next.month) }
  })
}
