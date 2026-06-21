/**
 * Django xato javoblarini O'zbek tiliga tarjima qilish
 * va foydalanuvchiga aniq ko'rsatma berish
 */

// Django field nomlari → O'zbek
const FIELD_NAMES = {
  first_name:   'Ism',
  last_name:    'Familiya',
  middle_name:  "Otasining ismi",
  gender:       'Jins',
  birth_date:   "Tug'ilgan sana",
  death_date:   'Vafot etgan sana',
  birth_place:  "Tug'ilgan joy",
  phone:        'Telefon',
  child_number: 'Farzand raqami',
  father:       'Otasi',
  mother:       'Onasi',
  photo:        'Rasm',
  email:        'Email',
  username:     'Foydalanuvchi nomi',
  password:     'Parol',
  password2:    'Parol tasdiqi',
  non_field_errors: '',
}

// Django xato matnlari → O'zbek ko'rsatma
const ERROR_PATTERNS = [
  // Majburiy
  { match: /this field (may not be blank|is required)/i,
    out: (field) => `${field} to'ldirilishi shart` },
  { match: /this field may not be null/i,
    out: (field) => `${field} bo'sh bo'lmasligi kerak` },

  // Uzunlik
  { match: /ensure this field has no more than (\d+) char/i,
    out: (field, m) => `${field} ${m[1]} ta belgidan oshmasligi kerak` },
  { match: /ensure this field has at least (\d+) char/i,
    out: (field, m) => `${field} kamida ${m[1]} ta belgi bo'lishi kerak` },

  // Unique
  { match: /already exists|unique/i,
    out: (field) => `Bunday ${field} allaqachon mavjud` },

  // Raqam
  { match: /a valid integer is required/i,
    out: (field) => `${field} butun son bo'lishi kerak` },
  { match: /ensure this value is (greater|less) than/i,
    out: (field) => `${field} qiymati noto'g'ri` },

  // Sana
  { match: /date has wrong format|invalid date/i,
    out: (field) => `${field} sanasi noto'g'ri formatda (MM.KK.YYYY bo'lishi kerak)` },
  { match: /death_date.*after.*birth|tug'ilgan.*oldin/i,
    out: () => "Vafot sanasi tug'ilgan sanadan keyin bo'lishi kerak" },

  // Fayl
  { match: /upload a valid image/i,
    out: () => "Rasm fayli noto'g'ri. JPG, PNG yoki WebP yuklang" },
  { match: /file too large|max.*size/i,
    out: () => "Rasm hajmi juda katta. 10 MB dan kichik fayl yuklang" },

  // Auth
  { match: /no active account found/i,
    out: () => "Foydalanuvchi topilmadi yoki parol noto'g'ri" },
  { match: /token.*invalid|token.*expired/i,
    out: () => "Sessiya muddati tugagan. Qayta kiring" },

  // Tarmoq
  { match: /network error/i,
    out: () => "Internet aloqasini tekshiring" },
]

// Bitta xato matnini tarjima qilish
function translateMsg(msg, fieldLabel) {
  for (const pat of ERROR_PATTERNS) {
    const m = String(msg).match(pat.match)
    if (m) return pat.out(fieldLabel, m)
  }
  return `${fieldLabel ? fieldLabel + ': ' : ''}${msg}`
}

/**
 * Asosiy funksiya — DRF xato obyektidan foydalanuvchi uchun matn olish
 * @param {any} err - axios error
 * @returns {string[]} - xato xabarlari massivi
 */
export function parseApiError(err) {
  // Tarmoq xatosi
  if (!err?.response) {
    return ["Internet aloqasini tekshiring yoki server ishlamayapti"]
  }

  const status = err.response.status
  const data   = err.response.data

  // HTTP status bo'yicha umumiy xabarlar
  if (status === 401) return ["Iltimos, qayta kiring — sessiyangiz tugagan"]
  if (status === 403) return ["Bu amalni bajarish uchun ruxsatingiz yo'q"]
  if (status === 404) return ["Ma'lumot topilmadi"]
  if (status === 429) return ["Juda ko'p so'rov yubordingiz. Biroz kuting"]
  if (status >= 500)  return ["Serverda ichki xato. Iltimos, keyinroq urinib ko'ring"]

  if (!data) return ["Noma'lum xato yuz berdi"]

  const messages = []

  if (typeof data === 'string') {
    messages.push(data)
  } else if (typeof data === 'object') {
    // { detail: "..." }
    if (data.detail) {
      messages.push(translateMsg(data.detail, ''))
    }

    // { field: ["error1", "error2"], ... }
    Object.entries(data).forEach(([key, val]) => {
      if (key === 'detail') return
      const fieldLabel = FIELD_NAMES[key] || key
      const errors = Array.isArray(val) ? val : [val]
      errors.forEach(e => {
        const msg = typeof e === 'string' ? e : JSON.stringify(e)
        messages.push(translateMsg(msg, fieldLabel))
      })
    })
  }

  return messages.length ? messages : ["Noma'lum xato yuz berdi"]
}

/**
 * Eng birinchi xatoni string sifatida qaytaradi (toast uchun)
 */
export function firstApiError(err) {
  return parseApiError(err)[0]
}

/**
 * PersonFormPage uchun client-side validatsiya
 * @returns {string|null} - xato xabari yoki null
 */
export function validatePersonForm(form) {
  const f = (label, val, min, max) => {
    const v = (val == null ? '' : String(val)).trim()
    if (!v) return `${label} to'ldirilishi shart ✏️`
    if (min && v.length < min) return `${label} kamida ${min} ta harf bo'lishi kerak`
    if (max && v.length > max) return `${label} ${max} ta belgidan oshmasligi kerak`
    return null
  }

  // Majburiy maydonlar
  const lastErr  = f('Familiya', form.last_name,  2, 100)
  if (lastErr)  return lastErr
  const firstErr = f('Ism',      form.first_name, 2, 100)
  if (firstErr) return firstErr

  // Sana tekshiruvi
  if (form.birth_date && form.death_date) {
    const b = new Date(form.birth_date)
    const d = new Date(form.death_date)
    if (d < b) return "Vafot sanasi tug'ilgan sanadan oldin bo'lishi mumkin emas 📅"
  }

  // Telefon formati (ixtiyoriy)
  if (form.phone && form.phone.trim()) {
    const clean = form.phone.replace(/\s/g, '')
    if (!/^\+?[\d\-()]{7,15}$/.test(clean))
      return "Telefon raqami noto'g'ri formatda (masalan: +998 90 123 45 67) 📞"
  }

  // Farzand raqami
  if (form.child_number !== '' && form.child_number !== null && form.child_number !== undefined) {
    const n = parseInt(form.child_number)
    if (isNaN(n) || n < 1 || n > 99)
      return "Farzand raqami 1 dan 99 gacha bo'lishi kerak 🔢"
  }

  return null
}
