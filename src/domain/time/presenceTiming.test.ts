import { describe, it, expect } from 'vitest'
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_INTERVAL_SECONDS,
  MISSED_HEARTBEATS_BEFORE_OFFLINE,
  ONLINE_THRESHOLD_MS,
  isOnlineNow,
} from './presenceTiming'

describe('presenceTiming', () => {
  // الطرفان كانا رقمين منفصلين بملفين مختلفين. هالتست يثبّت إنهما وحدة واحدة:
  // لو غيّر أحد الثواني، الملي ثانية تتبعه بدل ما تبقى على القيمة القديمة
  it('gives the browser and the server the same heartbeat interval', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(HEARTBEAT_INTERVAL_SECONDS * 1000)
  })

  it('waits for more than one missed beat before calling someone offline', () => {
    expect(MISSED_HEARTBEATS_BEFORE_OFFLINE).toBeGreaterThan(1)
    expect(ONLINE_THRESHOLD_MS).toBe(HEARTBEAT_INTERVAL_MS * MISSED_HEARTBEATS_BEFORE_OFFLINE)
  })

  // القيم اللي كانت مكتوبة باليد قبل التوحيد — التوحيد ما غيّر السلوك
  it('keeps the values the app already ran on', () => {
    expect(HEARTBEAT_INTERVAL_SECONDS).toBe(30)
    expect(ONLINE_THRESHOLD_MS).toBe(2 * 60 * 1000)
  })
})

describe('isOnlineNow', () => {
  const NOW = new Date('2026-09-24T09:00:00Z')
  const ago = (ms: number) => new Date(NOW.getTime() - ms)

  it('is online with a heartbeat inside the threshold', () => {
    expect(isOnlineNow(ago(30_000), NOW)).toBe(true)
    expect(isOnlineNow(ago(ONLINE_THRESHOLD_MS - 1), NOW)).toBe(true)
  })

  it('is offline once the threshold has passed', () => {
    expect(isOnlineNow(ago(ONLINE_THRESHOLD_MS), NOW)).toBe(false)
    expect(isOnlineNow(ago(60 * 60_000), NOW)).toBe(false)
  })

  it('is offline for someone who has never been seen', () => {
    expect(isOnlineNow(null, NOW)).toBe(false)
  })
})
