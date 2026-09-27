import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysInMonth,
  formatDayHeading,
  formatDisplayTime,
  monthsOfQuarter,
  quarterOf,
  shiftMonth,
  todayISO,
  weekDates,
} from './dates.ts'

describe('dates', () => {
  it('formats a local calendar date without UTC shifting', () => {
    const date = new Date(2026, 8, 25, 23, 30)
    expect(todayISO(date)).toBe('2026-09-25')
  })

  it('adds days across a month boundary', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('knows quarter months', () => {
    expect(quarterOf(2026, 9)).toEqual({ year: 2026, quarter: 3 })
    expect(quarterOf(2026, 10)).toEqual({ year: 2026, quarter: 4 })
    expect(monthsOfQuarter(4)).toEqual([10, 11, 12])
  })

  it('shifts months across the year', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
  })

  it('counts February correctly', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 10)).toBe(31)
  })

  it('formats journal headings and times', () => {
    expect(formatDayHeading('2026-10-05')).toBe('MONDAY OCT 5')
    expect(formatDisplayTime('07:15')).toBe('7:15')
    expect(formatDisplayTime('14:40')).toBe('2:40')
    expect(formatDisplayTime('00:05')).toBe('12:05')
  })

  it('starts the week on Monday when asked', () => {
    expect(weekDates('2026-09-25', 1)[0]).toBe('2026-09-21')
    expect(weekDates('2026-09-25', 0)[0]).toBe('2026-09-20')
  })
})
