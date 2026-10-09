import { field, type ServiceFormSchema } from '../applicationFieldSchema'

export const toeflSchema: ServiceFormSchema = {
  serviceCode: 'toefl',
  documents: [
    { id: 'passport-copy', label: 'Passport copy', labelAr: 'نسخة جواز السفر', required: true },
  ],
  fields: [
    field({
      id: 'email',
      type: 'email',
      label: 'Email',
      labelAr: 'البريد الإلكتروني',
      required: true,
    }),
    field({ id: 'address', type: 'text', label: 'Address', labelAr: 'العنوان', required: true }),
    field({
      id: 'preferred-date',
      type: 'date',
      label: 'Preferred date of test',
      labelAr: 'التاريخ المفضل للاختبار',
      required: false,
    }),
    field({
      id: 'registered-toefl-before',
      type: 'radio',
      label: 'Registered for TOEFL before?',
      labelAr: 'هل سبق وسجلت في توفل من قبل؟',
      required: false,
      defaultValue: 'No',
    }),
    field({
      id: 'applied-university-before',
      type: 'radio',
      label: 'Applied to a university with us before?',
      labelAr: 'هل تقدمت لجامعة معنا من قبل؟',
      required: false,
      defaultValue: 'No',
    }),
    field({
      id: 'wants-to-pay-now',
      type: 'radio',
      label: 'Do you want to pay now?',
      labelAr: 'هل ترغب بالدفع الآن؟',
      required: false,
      defaultValue: 'No',
    }),
  ],
}
