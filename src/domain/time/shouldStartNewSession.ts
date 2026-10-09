// إذا الفجوة بين آخر نبضة والحين أطول من الحد المسموح، نعتبرها جلسة أونلاين جديدة
export function shouldStartNewSession(
  previousEndedAt: Date | null,
  now: Date,
  thresholdMs: number
): boolean {
  if (previousEndedAt === null) return true
  return now.getTime() - previousEndedAt.getTime() > thresholdMs
}
