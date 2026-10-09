// عتبة اليومين: تحت منها الساعات مفيدة ("٦ ساعات")، وفوقها الرقم يصير كبير
// وما أحد يقرأ "٦٤٥ ساعة" كـ٢٧ يوم بدون ما يحسبها بنفسه
const DAYS_THRESHOLD_HOURS = 48

export interface TurnaroundDisplay {
  value: number
  unit: 'hours' | 'days'
}

export function formatTurnaround(hours: number): TurnaroundDisplay {
  const safeHours = Math.max(0, hours)
  if (safeHours < DAYS_THRESHOLD_HOURS) {
    return { value: Math.round(safeHours), unit: 'hours' }
  }
  return { value: Math.round(safeHours / 24), unit: 'days' }
}
