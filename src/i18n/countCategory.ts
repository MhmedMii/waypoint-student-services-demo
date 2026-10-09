export type CountCategory = 'one' | 'two' | 'few' | 'many'

// العربي يصرّف المعدود على أربع صيغ، مو اثنتين زي الإنجليزي: مفرد، مثنى،
// جمع قلة (٣–١٠)، ثم يرجع للمفرد المنصوب من ١١ وفوق — "١١ شخصًا" مو
// "١١ أشخاص". الصفر ياخذ الجمع: "٠ أشخاص"
export function countCategory(count: number): CountCategory {
  if (count === 1) return 'one'
  if (count === 2) return 'two'
  if (count >= 3 && count <= 10) return 'few'
  if (count === 0) return 'few'
  return 'many'
}
