export function formatDurationHMS(totalSeconds: number, language: 'en' | 'ar' = 'en'): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (language === 'ar') return `${hours}س ${minutes}د ${secs}ث`
  return `${hours}h ${minutes}m ${secs}s`
}
