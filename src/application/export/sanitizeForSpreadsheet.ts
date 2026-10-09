// حماية حقن الصيغ بـExcel/CSV: خلية تبدأ بـ= أو + أو - أو @ يقراها Excel
// كصيغة وينفّذها — اسم عميل مكتوب "=HYPERLINK(...)" يصير رابطًا يضغطه موظف.
// الفاصلة العليا بالأول تخليها نصًا عاديًا.
//
// كانت أربع نسخ متطابقة بايت ببايت بأربع ملفات تصدير. نسخة وحدة تنصلّح وثلاث
// ما يدري عنهن أحد — وهذا صار فعلاً مع formatExcelDateTime، نسختين اختلفتا.
// ضابط أمني بأربعة أماكن ينصلّح بمكان واحد
export const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@']

export function sanitizeForSpreadsheet(value: string): string {
  return FORMULA_TRIGGER_CHARS.includes(value[0]) ? `'${value}` : value
}
