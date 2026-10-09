// نفس توحيد الحروف اللي بـ normalizeSearchText، لكن بلغة SQL عشان نطبّقه على
// الاسم المخزّن داخل الاستعلام. لازم الاثنين يتطابقون — فيه تست تكامل يثبت ذلك
export const NORMALIZED_NAME_SQL =
  "lower(translate(regexp_replace(name, '[ًٌٍَُِّْٰـ]', '', 'g'), 'أإآٱةىؤئ٠١٢٣٤٥٦٧٨٩', 'ااااهيوي0123456789'))"
