import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getPerson, createPerson, updatePerson, createPersonJSON, updatePersonJSON, deletePerson, getPersons, getFamilies, createFamily, deleteFamily, ocrDocument } from '../../api/persons'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import { validatePersonForm, parseApiError } from '../../utils/errorMessages'
import ConfirmModal from '../../components/ConfirmModal'
import AuthModal from '../../components/AuthModal'

// ── O'zbek viloyatlari va shaharlari ─────────────────────────────
const PLACES = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Andijon viloyati",
  "Farg'ona viloyati",
  "Namangan viloyati",
  "Samarqand viloyati",
  "Buxoro viloyati",
  "Qashqadaryo viloyati",
  "Surxondaryo viloyati",
  "Navoiy viloyati",
  "Xorazm viloyati",
  "Qoraqalpog'iston Respublikasi",
  "Jizzax viloyati",
  "Sirdaryo viloyati",
]

// ── Tug'ilgan joy autocomplete ────────────────────────────────────
function BirthPlaceInput({ value, onChange }) {
  const { isDark } = useThemeStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const ref = useRef(null)

  // Tashqi klikda yopish
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Parent qiymat o'zgarganda sinxronlash
  useEffect(() => { setQuery(value || '') }, [value])

  const filtered = useMemo(() => {
    if (!query.trim()) return PLACES
    const q = query.toLowerCase()
    return PLACES.filter(p => p.toLowerCase().includes(q))
  }, [query])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        className="form-input"
        placeholder="Toshkent, Andijon viloyati..."
        autoComplete="off"
        onChange={e => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: isDark ? '#1e293b' : 'white',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          borderRadius: 12, marginTop: 4, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map(place => (
            <div key={place}
              onMouseDown={e => {
                e.preventDefault()
                setQuery(place)
                onChange(place)
                setOpen(false)
              }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                color: isDark ? '#f1f5f9' : '#0f172a',
                display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: `1px solid ${isDark ? '#334155' : '#f8fafc'}`,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? '#334155' : '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 16 }}>📍</span>
              <span>{place}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PersonFormPage({ isAdmin: isAdminProp }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin: checkAdmin, user } = useAuthStore()
  // isAdmin: prop (admin route) yoki authStore (user route) — ikkalasini qamrab oladi
  const isAdmin = isAdminProp || checkAdmin()
  const isEdit = !!id
  const { isDark } = useThemeStore()

  const [guestModal, setGuestModal]         = useState(false)
  const [showAuthModal, setShowAuthModal]   = useState(false)
  useEffect(() => {
    if (!user) setGuestModal(true)
  }, [user])
  const formRef = useRef(null)

  const [form, setForm] = useState({
    first_name: '', last_name: '', middle_name: '',
    gender: 'male', child_number: '',
    birth_date: '', death_date: '', deceased: false,
    phone: '', birth_place: '', father: '', mother: '',
  })
  const [families, setFamilies]       = useState([])
  const [showFamForm, setShowFamForm] = useState(false)
  const [famForm, setFamForm]         = useState({ partner: '', wedding_date: '', divorce_date: '', note: '' })
  const [famLoading, setFamLoading]   = useState(false)
  // Yangi shaxs uchun: create-da turmush o'rtog'i
  const [newSpouse, setNewSpouse] = useState({ partner: '', wedding_date: '' })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [fieldErrors, setFieldErrors]   = useState({}) // inline xatolar
  const [deleteModal, setDeleteModal]   = useState(false)
  // Duplicate detection
  const [dupWarning, setDupWarning]       = useState([])   // o'xshash ismlar
  const [childNumWarning, setChildNumWarning] = useState(false) // bir xil child_number
  // 16. OCR
  const [ocrLoading, setOcrLoading]   = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)   // tesseract progress 0-100
  const [ocrSuggestions, setOcrSuggestions] = useState(null) // {full_name,birth_date,birth_place,gender,notes}
  const [showOcrModal, setShowOcrModal]     = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Duplicate detection ───────────────────────────────────────
  // Ism o'zgarganda o'xshash shaxslarni qidirish
  useEffect(() => {
    if (isEdit) { setDupWarning([]); return }
    const full = [form.last_name, form.first_name, form.middle_name].filter(Boolean).join(' ').toLowerCase().trim()
    if (full.length < 3) { setDupWarning([]); return }
    const similar = persons.filter(p => {
      const pName = p.full_name?.toLowerCase() || ''
      // Eng kamida 2 ta so'z mos kelsa ogohlantirish
      const words = full.split(' ').filter(w => w.length > 1)
      const matches = words.filter(w => pName.includes(w))
      return matches.length >= 2
    })
    setDupWarning(similar)
  }, [form.last_name, form.first_name, form.middle_name, persons, isEdit])

  // child_number takrorlanishini tekshirish (bir xil ota/ona ostida)
  useEffect(() => {
    if (isEdit || !form.child_number || (!form.father && !form.mother)) {
      setChildNumWarning(false); return
    }
    const num = parseInt(form.child_number)
    const dup = persons.some(p => {
      if (p.child_number !== num) return false
      const sameFather = form.father && p.father === parseInt(form.father)
      const sameMother = form.mother && p.mother === parseInt(form.mother)
      return sameFather || sameMother
    })
    setChildNumWarning(dup)
  }, [form.child_number, form.father, form.mother, persons, isEdit])

  const loadFamilies = () => {
    if (isEdit && id) {
      getFamilies({ person: id }).then(r => setFamilies(r.data)).catch(() => {})
    }
  }

  useEffect(() => {
    getPersons().then(r => setPersons(r.data))
    if (isEdit) {
      getPerson(id).then(r => {
        const d = r.data
        setForm({
          first_name: d.first_name||'', last_name: d.last_name||'',
          middle_name: d.middle_name||'', gender: d.gender||'male',
          child_number: d.child_number||'', birth_date: d.birth_date||'',
          death_date: d.death_date||'', deceased: d.deceased || !!d.death_date || false,
          phone: d.phone||'',
          birth_place: d.birth_place||'',
          father: d.father != null ? String(d.father) : '',
          mother: d.mother != null ? String(d.mother) : '',
        })
        if (d.photo) setPhotoPreview(d.photo)
      })
      loadFamilies()
    }
  }, [id])

  const handlePhoto = (file) => {
    if (file && file.type.startsWith('image/')) {
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  // ── 16. OCR: Backend Gemini Vision yoki Tesseract.js fallback ──
  const handleOcr = async (file) => {
    if (!file) return
    setOcrLoading(true)
    setOcrProgress(0)
    setOcrSuggestions(null)

    // 1) Backend Gemini Vision
    try {
      const r = await ocrDocument(file)
      if (r.data?.data) {
        setOcrSuggestions(r.data.data)
        setShowOcrModal(true)
        setOcrLoading(false)
        return
      }
    } catch (backendErr) {
      const status = backendErr?.response?.status
      // 503 = API key yo'q → Tesseract.js ga tush
      if (status !== 503) {
        toast.error('OCR xatosi: ' + (backendErr?.response?.data?.error || 'Noma\'lum xato'))
        setOcrLoading(false)
        return
      }
    }

    // 2) Tesseract.js fallback (browser-side, bepul)
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('uzb+rus+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text')
            setOcrProgress(Math.round(m.progress * 100))
        },
      })
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()

      // Oddiy regex parse
      const suggestions = parseOcrText(text)
      setOcrSuggestions({ ...suggestions, _raw: text })
      setShowOcrModal(true)
    } catch (e) {
      toast.error('OCR ishlamadi. Gemini API kalitini sozlamalardan kiriting.')
    } finally {
      setOcrLoading(false)
      setOcrProgress(0)
    }
  }

  // Tesseract matnidan maydonlarni ajratib olish
  const parseOcrText = (text) => {
    const result = {}

    // Ism: katta harf bilan boshlangan 2-4 so'z
    const nameMatch = text.match(/([А-ЯA-Z][а-яa-zА-ЯA-Z'-]+(?:\s+[А-ЯA-Z][а-яa-zА-ЯA-Z'-]+){1,3})/g)
    if (nameMatch) result.full_name = nameMatch[0]

    // Sana: DD.MM.YYYY yoki YYYY yil formatlar
    const dateMatch = text.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})/)
    if (dateMatch) result.birth_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
    else {
      const yearMatch = text.match(/(\d{4})\s*(?:yil|й\.р\.|г\.р\.|года рождения)/i)
      if (yearMatch) result.birth_date = `${yearMatch[1]}-01-01`
    }

    // Joy
    const placeMatch = text.match(/(?:tug'ilgan|туг|рожд[её]н[аы]?\s+в)\s*[:\-]?\s*(.{3,40})/i)
    if (placeMatch) result.birth_place = placeMatch[1].trim()

    return result
  }

  // OCR taklif qilingan maydonlarni formga qo'llash
  const applyOcrSuggestion = (field, value) => {
    if (field === 'full_name') {
      const parts = value.trim().split(/\s+/)
      set('last_name',   parts[0] || '')
      set('first_name',  parts[1] || '')
      set('middle_name', parts[2] || '')
    } else if (field === 'birth_date') {
      set('birth_date', value)
    } else if (field === 'birth_place') {
      set('birth_place', value)
    } else if (field === 'gender') {
      set('gender', value)
    }
  }

  // Inline field validatsiya
  const validateField = (key, value) => {
    const v = (value == null ? '' : String(value)).trim()
    if (key === 'last_name')    return v.length < 2 ? 'Familiya kamida 2 harf bo\'lishi kerak' : ''
    if (key === 'first_name')   return v.length < 2 ? 'Ism kamida 2 harf bo\'lishi kerak' : ''
    if (key === 'child_number') return !v ? 'Nechanchi farzand ekanligini kiriting' : (parseInt(v) < 1 ? 'Kamida 1 bo\'lishi kerak' : '')
    if (key === 'birth_date' && form.death_date && value) {
      return new Date(value) > new Date(form.death_date) ? 'Tug\'ilgan sana vafot sanasidan keyin bo\'lishi mumkin emas' : ''
    }
    if (key === 'death_date' && form.birth_date && value) {
      return new Date(value) < new Date(form.birth_date) ? 'Vafot sanasi tug\'ilgan sanadan oldin bo\'lishi mumkin emas' : ''
    }
    if (key === 'phone' && value) {
      const clean = value.replace(/\s/g, '')
      return /^\+?[\d\-()]{7,15}$/.test(clean) ? '' : 'Telefon formati noto\'g\'ri (masalan: +998 90 123 45 67)'
    }
    if (key === 'child_number' && value) {
      const n = parseInt(value)
      return (isNaN(n) || n < 1 || n > 99) ? 'Farzand raqami 1–99 orasida bo\'lishi kerak' : ''
    }
    return ''
  }

  const setField = (k, v) => {
    set(k, v)
    const err = validateField(k, v)
    setFieldErrors(fe => ({ ...fe, [k]: err }))
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()

    // Validation
    const newErrors = {}
    ;['last_name', 'first_name', 'child_number'].forEach(k => {
      const err = validateField(k, form[k])
      if (err) newErrors[k] = err
    })
    ;['birth_date', 'death_date', 'phone'].forEach(k => {
      const err = validateField(k, form[k])
      if (err) newErrors[k] = err
    })
    if (Object.keys(newErrors).length) {
      setFieldErrors(newErrors)
      toast.error('❌ Forma to\'ldirishda xatolar bor', { duration: 3000 })
      return
    }
    const validErr = validatePersonForm(form)
    if (validErr) { toast.error(`❌ ${validErr}`, { duration: 4000 }); return }

    const savingToast = toast.loading('⏳ Saqlanmoqda...')
    setLoading(true)
    try {
      let savedId = id ? parseInt(id) : null
      if (photo) {
        // ── Rasm yuklanganda: FormData ──
        const fd = new FormData()
        fd.append('first_name',  form.first_name)
        fd.append('last_name',   form.last_name)
        fd.append('middle_name', form.middle_name)
        fd.append('gender',      form.gender)
        fd.append('phone',       form.phone || '')
        fd.append('birth_place', form.birth_place || '')
        fd.append('deceased',    form.deceased ? 'true' : 'false')
        if (form.birth_date)    fd.append('birth_date',    form.birth_date)
        if (form.death_date)    fd.append('death_date',    form.death_date)
        if (form.child_number)  fd.append('child_number',  form.child_number)
        if (form.father !== '') fd.append('father', form.father)
        if (form.mother !== '') fd.append('mother', form.mother)
        fd.append('photo', photo)
        const progressConfig = {
          onUploadProgress: e => setUploadPct(Math.round((e.loaded * 100) / (e.total || 1)))
        }
        if (isEdit) await updatePerson(id, fd, progressConfig)
        else { const res = await createPerson(fd, progressConfig); savedId = res.data.id }
        setUploadPct(0)
      } else {
        // ── Rasm yo'q: JSON ─────────────────────────────────────────
        const payload = {
          first_name:   form.first_name,
          last_name:    form.last_name,
          middle_name:  form.middle_name,
          gender:       form.gender,
          phone:        form.phone || '',
          birth_place:  form.birth_place || '',
          deceased:     form.deceased,
          birth_date:   form.birth_date  || null,
          death_date:   form.deceased ? (form.death_date || null) : null,
          child_number: form.child_number ? parseInt(form.child_number) : null,
          father:       form.father !== '' ? parseInt(form.father) : null,
          mother:       form.mother !== '' ? parseInt(form.mother) : null,
        }
        if (isEdit) await updatePersonJSON(id, payload)
        else { const res = await createPersonJSON(payload); savedId = res.data.id }
      }

      // ── Yangi shaxs uchun: turmush o'rtog'i bog'lash ─────────────
      if (!isEdit && savedId && newSpouse.partner) {
        try {
          const partnerId = parseInt(newSpouse.partner)
          const partnerObj = persons.find(p => p.id === partnerId)
          const meGender = form.gender
          const partnerGender = partnerObj?.gender
          // Er kim, xotin kim?
          let husband, wife
          if (meGender === 'male') { husband = savedId; wife = partnerId }
          else if (meGender === 'female') { husband = partnerId; wife = savedId }
          else if (partnerGender === 'female') { husband = savedId; wife = partnerId }
          else { husband = savedId; wife = partnerId }

          await createFamily({
            husband,
            wife,
            wedding_date: newSpouse.wedding_date || null,
            divorce_date: null,
            note: '',
          })
        } catch (famErr) {
          toast.error('⚠️ Shaxs saqlandi, lekin turmush o\'rtog\'i bog\'lanmadi')
        }
      }

      toast.dismiss(savingToast)
      toast.success(isEdit ? '✅ Ma\'lumotlar yangilandi!' : '✅ Shaxs qo\'shildi!', { duration: 3000 })
      navigate(isAdmin ? '/admin/persons' : '/persons')
    } catch (err) {
      toast.dismiss(savingToast)
      // Barcha server xatolarini O'zbek tilida aniq ko'rsatamiz
      const msgs = parseApiError(err)
      msgs.forEach((msg, i) => {
        setTimeout(() => toast.error(`❌ ${msg}`, { duration: 5000 }), i * 350)
      })
    } finally {
      setLoading(false)
      setUploadPct(0)
    }
  }

  const handleDelete = () => setDeleteModal(true)

  const confirmDelete = () => {
    setDeleteModal(false)
    let cancelled = false
    const tid = setTimeout(async () => {
      if (cancelled) return
      try {
        await deletePerson(id)
        navigate(isAdmin ? '/admin/persons' : '/persons')
      } catch {
        toast.error('❌ O\'chirishda xato yuz berdi')
      }
    }, 5000)

    toast(
      (t) => (
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700 }}>🗑️ O'chirilmoqda...</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>5 soniya ichida bekor qilishingiz mumkin</div>
          </div>
          <button
            onClick={() => {
              cancelled = true
              clearTimeout(tid)
              toast.dismiss(t.id)
              toast.success('↩️ O\'chirish bekor qilindi!')
            }}
            style={{
              padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:700,
              background:'#fef3c7', color:'#92400e', border:'1.5px solid #fde68a',
              cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
            }}>
            ↩️ Bekor qilish
          </button>
        </div>
      ),
      { duration: 5000, id: 'delete-toast-' + id }
    )
  }

  const backPath = isAdmin ? '/admin/persons' : '/persons'
  const others = persons.filter(p => String(p.id) !== String(id))

  return (
    <>
    <ConfirmModal
      open={deleteModal}
      title="Shaxsni o'chirish"
      message={`"${form.last_name} ${form.first_name}" ni bazadan butunlay o'chirib tashlamoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.`}
      danger
      icon="🗑️"
      confirmLabel="Ha, o'chirish"
      cancelLabel="Bekor qilish"
      onConfirm={confirmDelete}
      onCancel={() => setDeleteModal(false)}
    />
    {showAuthModal && <AuthModal onClose={() => { setShowAuthModal(false); setGuestModal(false) }} />}
    {guestModal && !showAuthModal && (
      <div style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(2,8,23,0.7)', backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      }}>
        <div style={{
          background: isDark ? '#1e293b' : 'white',
          borderRadius:24, width:'100%', maxWidth:380,
          boxShadow:'0 20px 60px rgba(0,0,0,0.35)', overflow:'hidden',
        }}>
          <div style={{ padding:'20px 22px 16px', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'white' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🔐</div>
            <div style={{ fontSize:16, fontWeight:900 }}>Kirish talab qilinadi</div>
            <div style={{ fontSize:12, opacity:0.8, marginTop:4 }}>
              Bu sahifani ko'rish uchun tizimga kiring
            </div>
          </div>
          <div style={{ padding:'18px 22px 20px' }}>
            <div style={{ fontSize:13, color: isDark ? '#94a3b8' : '#64748b', marginBottom:16, lineHeight:1.5 }}>
              Shaxs ma'lumotlarini tahrirlash uchun <strong>login va parol</strong> bilan tizimga kirishingiz kerak.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={() => setShowAuthModal(true)}
                style={{ padding:'11px', borderRadius:12, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'white',
                  fontSize:14, fontWeight:800, boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>
                🔑 Tizimga kirish
              </button>
              <button onClick={() => navigate(-1)}
                style={{ padding:'10px', borderRadius:12, cursor:'pointer',
                  border: isDark ? '1.5px solid #334155' : '1.5px solid #e2e8f0',
                  background:'transparent', fontSize:13, fontWeight:600,
                  color: isDark ? '#94a3b8' : '#64748b' }}>
                ← Orqaga
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    <div className="h-screen flex flex-col overflow-hidden tree-bg pf-outer">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 shadow-sm flex-shrink-0 pf-topbar">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backPath)}
            className="btn btn-ghost text-sm px-3 py-1.5 rounded-lg">
            ← Orqaga
          </button>
          <div className="w-px h-5 bg-gray-200 pf-topbar-divider" />
          <div>
            <h1 className="text-base font-bold text-gray-800">
              {isEdit ? '✏️ Shaxsni tahrirlash' : '➕ Yangi shaxs qo\'shish'}
            </h1>
            <p className="text-xs text-gray-400">Barcha yulduzli (*) maydonlar majburiy</p>
          </div>
        </div>
        <div className="flex gap-2 pf-topbtns">
          {isEdit && (
            <button type="button" onClick={handleDelete} className="btn btn-danger text-sm">
              🗑️ O'chirish
            </button>
          )}
          <button type="button" onClick={() => { setForm({ first_name:'',last_name:'',middle_name:'',gender:'male',child_number:'',birth_date:'',death_date:'',phone:'',birth_place:'',father:'',mother:'' }); setPhotoPreview(null); setPhoto(null); setNewSpouse({ partner:'', wedding_date:'' }) }}
            className="btn btn-ghost text-sm pf-btn-clear">
            🔄 Tozalash
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="btn btn-success text-sm">
            {loading ? '⏳ Saqlanmoqda...' : '💾 Saqlash'}
          </button>
        </div>
      </div>

      {/* Form body - no scroll */}
      <style>{`
        /* Mobile save bar: desktop da yashiriladi */
        .pf-mobile-savebar { display: none; }

        @media (max-width: 640px) {
          /* ── Sticky save bar ── */
          .pf-mobile-savebar { display: flex !important; }

          /* ── Outer scroll ── */
          .pf-outer  { height: auto !important; min-height: 100vh; overflow: visible !important; display: flex; flex-direction: column; }
          .pf-form   { overflow: visible !important; height: auto !important; flex: unset !important; }
          .pf-layout { grid-template-columns: 1fr !important; }

          /* ── Top bar: faqat sarlavha + Saqlash ── */
          .pf-topbar         { padding: 7px 12px !important; gap: 6px !important; }
          .pf-topbar h1      { font-size: 12px !important; }
          .pf-topbar p       { display: none !important; }
          .pf-topbar-divider { display: none !important; }
          .pf-topbtns        { gap: 4px !important; }
          .pf-topbtns button { padding: 5px 9px !important; font-size: 11px !important; border-radius: 8px !important; }
          .pf-btn-clear      { display: none !important; }

          /* ── Left panel: gorizontal, ixcham ── */
          .pf-left {
            border-right: none !important;
            border-bottom: 1px solid rgba(148,163,184,0.2) !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important;
            padding: 10px 12px !important;
            gap: 12px !important;
            flex-wrap: nowrap !important;
          }
          /* Avatar: kichik */
          .pf-left .w-28       { width: 60px !important; height: 60px !important; border-radius: 12px !important; }
          .pf-left .text-4xl   { font-size: 22px !important; }
          /* Rasm yuklash matni: ixcham */
          .pf-left .text-center { text-align: left !important; }
          .pf-left .text-center .text-xs.font-medium { font-size: 10px !important; }
          .pf-left .text-center .text-xs.text-gray-400 { display: none !important; }
          .pf-left .text-gray-300 { display: none !important; }
          /* OCR: yashirish */
          .pf-left-ocr { display: none !important; }
          /* Jins label */
          .pf-left .mt-2 { margin-top: 0 !important; flex: 1; }
          .pf-left .mt-2 .text-xs { font-size: 10px !important; margin-bottom: 4px !important; }
          /* Jins tugmalari: gorizontal */
          .pf-left .space-y-2 {
            display: flex !important;
            flex-direction: row !important;
            gap: 6px !important;
          }
          .pf-left .space-y-2 button {
            flex: 1;
            padding: 6px 4px !important;
            font-size: 11px !important;
          }

          /* ── Right panel ── */
          .pf-right {
            overflow: visible !important;
            padding: 12px !important;
            padding-bottom: 100px !important;
            gap: 10px !important;
          }

          /* ── Form inputs kichikroq ── */
          .pf-right .form-input,
          .pf-right input,
          .pf-right select {
            padding: 7px 10px !important;
            font-size: 12px !important;
            border-radius: 8px !important;
          }

          /* ── Section labels ── */
          .pf-section-label,
          .pf-right .text-xs.font-bold {
            font-size: 9px !important;
            margin-bottom: 6px !important;
          }
          .pf-right .form-label,
          .pf-right label.form-label {
            font-size: 9px !important;
            margin-bottom: 3px !important;
          }

          /* ── Field grids ── */
          .pf-grid3 { grid-template-columns: 1fr !important; gap: 8px !important; }
          .pf-grid4 { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .pf-grid2 { grid-template-columns: 1fr !important; gap: 8px !important; }

          /* ── Ota-onasi, turmush ── */
          .pf-grid2 .form-input { font-size: 11px !important; }

          /* ── Hints: 1 ustun ── */
          .pf-hints { grid-template-columns: 1fr !important; gap: 6px !important; padding: 10px !important; }
          .pf-hints .text-xs { font-size: 10px !important; }

          /* ── Oila formi ── */
          .pf-famgrid { grid-template-columns: 1fr !important; gap: 6px !important; }

          /* ── Duplicate warning ── */
          .pf-right [style*="borderRadius: 12"] .text-xs { font-size: 10px !important; }
        }
      `}</style>
      {/* ── 16. OCR taklif modali ── */}
      {showOcrModal && ocrSuggestions && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(2,8,23,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
        onClick={() => setShowOcrModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: isDark ? '#1e293b' : 'white', borderRadius: 24, width: '100%', maxWidth: 440,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}>
            {/* Header */}
            <div style={{
              padding: '18px 20px 14px',
              background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
              color: 'white',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>📄</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>Hujjatdan topilgan ma'lumotlar</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
                    Qo'llash uchun maydonni tanlang
                  </div>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'full_name',   label: '👤 To\'liq ism',         icon: '👤' },
                { key: 'birth_date',  label: '🎂 Tug\'ilgan sana',     icon: '🎂' },
                { key: 'birth_place', label: '📍 Tug\'ilgan joy',      icon: '📍' },
                { key: 'gender',      label: '⚧ Jins',                 icon: '⚧' },
              ].map(({ key, label }) => {
                const val = ocrSuggestions[key]
                if (!val) return null
                return (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 14,
                    background: isDark ? '#0f172a' : '#f8fafc',
                    border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {key === 'gender' ? (val === 'male' ? '👨 Erkak' : '👩 Ayol') : val}
                      </div>
                    </div>
                    <button
                      onClick={() => { applyOcrSuggestion(key, val); toast.success(`✅ ${label} qo'llandi`); }}
                      style={{
                        padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: 'white',
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                        boxShadow: '0 3px 10px rgba(99,102,241,0.3)',
                      }}>
                      ✓ Qo'lla
                    </button>
                  </div>
                )
              })}

              {/* Apply all */}
              <button
                onClick={() => {
                  Object.entries(ocrSuggestions).forEach(([k, v]) => {
                    if (v && k !== 'notes' && k !== '_raw') applyOcrSuggestion(k, v)
                  })
                  toast.success('✅ Barcha maydonlar qo\'llandi!')
                  setShowOcrModal(false)
                }}
                style={{
                  padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white',
                  fontSize: 13, fontWeight: 800, marginTop: 4,
                  boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                }}>
                ✨ Barchasini qo'llash
              </button>

              {/* Notes from AI */}
              {ocrSuggestions.notes && (
                <div style={{ fontSize: 11.5, color: isDark ? '#fde68a' : '#64748b', padding: '8px 12px',
                  background: isDark ? 'rgba(120,53,15,0.3)' : '#fefce8', borderRadius: 10, border: `1px solid ${isDark ? '#b45309' : '#fde68a'}` }}>
                  💡 {ocrSuggestions.notes}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '0 18px 16px' }}>
              <button onClick={() => setShowOcrModal(false)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 12,
                  border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  background: isDark ? '#1e293b' : 'white',
                  fontSize: 12, fontWeight: 600,
                  color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer',
                }}>
                ✕ Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      <form id="person-form" ref={formRef} onSubmit={handleSubmit} noValidate
        className="flex-1 overflow-auto grid pf-layout pf-form"
        style={{ gridTemplateColumns: '200px 1fr', gap: 0 }}>

        {/* LEFT: Photo upload */}
        <div className="p-4 bg-white border-r border-gray-100 flex flex-col items-center justify-start gap-3 pt-6 pf-left">
          {/* Avatar */}
          <div
            onClick={() => document.getElementById('photo-input').click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handlePhoto(e.dataTransfer.files[0]) }}
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <div className={`w-28 h-28 rounded-2xl overflow-hidden flex items-center justify-center transition-all ${isDragging ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
              style={{
                background: photoPreview ? 'transparent' : (form.gender === 'male' ? 'linear-gradient(135deg,#dbeafe,#eff6ff)' : 'linear-gradient(135deg,#fce7f3,#fdf2f8)'),
                border: `2px dashed ${photoPreview ? 'transparent' : '#cbd5e1'}`
              }}>
              {photoPreview
                ? <img src={photoPreview} className="w-full h-full object-cover" alt="" />
                : <div className="text-center p-3">
                    <div className="text-4xl">{form.gender === 'male' ? '👨' : '👩'}</div>
                    <div className="text-xs text-gray-400 mt-1">Rasm yuklash</div>
                  </div>
              }
            </div>
            <input id="photo-input" type="file" accept="image/*" className="hidden"
              onChange={e => handlePhoto(e.target.files[0])} />
            <div className="text-center">
              <div className="text-xs font-medium text-blue-600">📷 Rasm yuklash</div>
              <div className="text-xs text-gray-400">yoki tortib tashlang</div>
              <div className="text-xs text-gray-300 mt-1">JPG, PNG, WebP</div>
            </div>
          </div>

          {photoPreview && (
            <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); setUploadPct(0) }}
              className="text-xs text-red-400 hover:text-red-600">✕ Rasmni o'chirish</button>
          )}

          {/* 16. OCR button */}
          <div className="pf-left-ocr" style={{ width: '100%', marginTop: 4 }}>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '7px 10px', borderRadius: 10, cursor: 'pointer',
              border: '1.5px dashed #a78bfa',
              background: ocrLoading ? '#f5f3ff' : 'transparent',
              color: '#7c3aed', fontSize: 11.5, fontWeight: 700,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!ocrLoading) { e.currentTarget.style.background='#f5f3ff'; e.currentTarget.style.borderStyle='solid' } }}
            onMouseLeave={e => { if (!ocrLoading) { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderStyle='dashed' } }}
            >
              <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleOcr(e.target.files[0]); e.target.value = '' }}
                disabled={ocrLoading} />
              {ocrLoading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span>
                  {ocrProgress > 0 ? `${ocrProgress}%` : 'O\'qilmoqda...'}
                </>
              ) : (
                <>📄 Hujjatdan o'qish</>
              )}
            </label>
            <div style={{ fontSize: 9.5, color: '#94a3b8', textAlign: 'center', marginTop: 3 }}>
              Metrika, pasport, guvohnoma
            </div>
          </div>

          {/* Upload progress bar */}
          {uploadPct > 0 && uploadPct < 100 && (
            <div style={{ width:'100%', marginTop:4 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#6366f1', marginBottom:3, textAlign:'center' }}>
                📤 Yuklanmoqda... {uploadPct}%
              </div>
              <div style={{ height:6, borderRadius:3, background:'#e2e8f0', overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:3, transition:'width 0.2s',
                  width:`${uploadPct}%`,
                  background:'linear-gradient(90deg,#6366f1,#7c3aed)',
                  boxShadow:'0 0 8px rgba(99,102,241,0.5)',
                }} />
              </div>
            </div>
          )}
          {uploadPct === 100 && (
            <div style={{ fontSize:11, color:'#10b981', fontWeight:700, textAlign:'center' }}>
              ✅ Rasm yuklandi!
            </div>
          )}

          {/* Gender buttons - vertical in left panel */}
          <div className="w-full mt-2">
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Jins *</div>
            <div className="space-y-2">
              <button type="button" onClick={() => set('gender', 'male')}
                className={`gender-btn male w-full ${form.gender === 'male' ? 'selected' : ''}`}>
                👨 Erkak
              </button>
              <button type="button" onClick={() => set('gender', 'female')}
                className={`gender-btn female w-full ${form.gender === 'female' ? 'selected' : ''}`}>
                👩 Ayol
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Fields */}
        <div className="p-5 grid pf-right" style={{ gridTemplateRows: 'auto auto auto auto auto', gap: '14px', alignContent: 'start' }}>

          {/* Row 1: Name fields */}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">👤 Shaxs ma'lumotlari</div>
            <div className="grid grid-cols-3 gap-3 pf-grid3">
              <Field label="Familiya *" error={fieldErrors.last_name}>
                <input type="text" value={form.last_name} onChange={e => setField('last_name', e.target.value)}
                  className="form-input" placeholder="Dilmonov" required
                  style={fieldErrors.last_name ? { borderColor: '#ef4444', background: isDark ? '#450a0a' : '#fef2f2' } : {}} />
              </Field>
              <Field label="Ism *" error={fieldErrors.first_name}>
                <input type="text" value={form.first_name} onChange={e => setField('first_name', e.target.value)}
                  className="form-input" placeholder="Nursulton" required
                  style={fieldErrors.first_name ? { borderColor: '#ef4444', background: isDark ? '#450a0a' : '#fef2f2' } : {}} />
              </Field>
              <Field label="Otasining ismi">
                <input type="text" value={form.middle_name} onChange={e => set('middle_name', e.target.value)}
                  className="form-input" placeholder="Elyorovich" />
              </Field>
            </div>

            {/* Duplicate name warning */}
            {dupWarning.length > 0 && (
              <div style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 12,
                background: isDark ? 'rgba(120,53,15,0.35)' : '#fef3c7',
                border: `1.5px solid ${isDark ? '#b45309' : '#f59e0b'}`,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? '#fcd34d' : '#92400e', marginBottom: 4 }}>
                    Shunga o'xshash shaxslar topildi!
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {dupWarning.slice(0, 5).map(p => (
                      <span key={p.id} style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: isDark ? '#78350f' : '#fde68a', color: isDark ? '#fde68a' : '#78350f', border: '1px solid #f59e0b',
                      }}>
                        {p.full_name}{p.birth_date ? ` (${new Date(p.birth_date+'T00:00:00').getFullYear()})` : ''}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#fcd34d' : '#92400e', marginTop: 5 }}>
                    Agar bu boshqa shaxs bo'lsa davom etishingiz mumkin.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Dates + child number + phone */}
          <div>
            {/* Vafot etgan toggle */}
            <div style={{ marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => {
                  const next = !form.deceased
                  set('deceased', next)
                  if (!next) set('death_date', '')
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                  border: `2px solid ${form.deceased ? '#6b7280' : (isDark ? '#334155' : '#e2e8f0')}`,
                  background: form.deceased
                    ? (isDark ? 'rgba(107,114,128,0.2)' : '#f3f4f6')
                    : 'transparent',
                  color: form.deceased ? (isDark ? '#d1d5db' : '#374151') : (isDark ? '#64748b' : '#94a3b8'),
                  fontSize: 13, fontWeight: 700,
                  transition: 'all 0.18s',
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: form.deceased ? '#6b7280' : 'transparent',
                  border: `2px solid ${form.deceased ? '#6b7280' : (isDark ? '#475569' : '#cbd5e1')}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.18s', flexShrink: 0,
                }}>
                  {form.deceased && <span style={{ color: 'white', fontSize: 10, fontWeight: 900 }}>✓</span>}
                </span>
                🌿 Vafot etgan
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 pf-grid4">
              <Field label="📅 Tug'ilgan sana" error={fieldErrors.birth_date}>
                <input type="date" value={form.birth_date} onChange={e => setField('birth_date', e.target.value)}
                  className="form-input"
                  style={fieldErrors.birth_date ? { borderColor: '#ef4444', background: isDark ? '#450a0a' : '#fef2f2' } : {}} />
              </Field>

              {/* Vafot etgan sana — faqat deceased=true bo'lsa */}
              {form.deceased && (
                <Field label="🌿 Vafot etgan sana (ixtiyoriy)" error={fieldErrors.death_date}>
                  <input type="date" value={form.death_date} onChange={e => setField('death_date', e.target.value)}
                    className="form-input"
                    style={fieldErrors.death_date ? { borderColor: '#ef4444', background: isDark ? '#450a0a' : '#fef2f2' } : {}} />
                </Field>
              )}

              <Field label="🔢 Nechanchi farzand *" error={fieldErrors.child_number || (childNumWarning ? 'Bu raqamli farzand allaqachon kiritilgan!' : '')}>
                <input type="number" min="1" max="99" value={form.child_number}
                  onChange={e => setField('child_number', e.target.value)}
                  className="form-input" placeholder="1"
                  style={(fieldErrors.child_number || childNumWarning) ? { borderColor: '#ef4444', background: isDark ? '#450a0a' : '#fef2f2' } : {}} />
              </Field>
              <Field label="📞 Telefon" error={fieldErrors.phone}>
                <input type="tel" value={form.phone}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '')
                    const n = digits.startsWith('998') ? digits : ('998' + digits).slice(0, 12)
                    let r = '+998'
                    if (n.length > 3)  r += ' ' + n.slice(3, 5)
                    if (n.length > 5)  r += ' ' + n.slice(5, 8)
                    if (n.length > 8)  r += '-' + n.slice(8, 10)
                    if (n.length > 10) r += '-' + n.slice(10, 12)
                    setField('phone', digits.length ? r : '')
                  }}
                  className="form-input" placeholder="+998 XX XXX-XX-XX"
                  style={fieldErrors.phone ? { borderColor: '#ef4444', background: isDark ? '#450a0a' : '#fef2f2' } : {}} />
              </Field>
              <Field label="📍 Tug'ilgan joy">
                <BirthPlaceInput value={form.birth_place} onChange={v => set('birth_place', v)} />
              </Field>
            </div>
          </div>

          {/* Row 3: Ota-ona */}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">👨‍👩‍👦 Ota-onasi</div>
            <div className="grid grid-cols-2 gap-3 pf-grid2">
              {[
                ['father', '👨 Otasi', 'male'],
                ['mother', '👩 Onasi', 'female'],
              ].map(([key, label, genderFilter]) => (
                <Field key={key} label={label}>
                  <select value={form[key]} onChange={e => set(key, e.target.value)} className="form-input">
                    <option value="">— Tanlanmagan —</option>
                    {others
                      .filter(p => !genderFilter || p.gender === genderFilter)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}{p.birth_date ? ` (${new Date(p.birth_date).getFullYear()})` : ''}
                        </option>
                      ))}
                  </select>
                </Field>
              ))}
            </div>
          </div>

          {/* Row 4a: Yangi shaxs uchun turmush o'rtog'i */}
          {!isEdit && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">💍 Turmush o'rtog'i</div>
              <div className="grid grid-cols-2 gap-3 pf-grid2">
                <Field label="💍 Turmush o'rtog'i (ixtiyoriy)">
                  <select value={newSpouse.partner}
                    onChange={e => setNewSpouse(s => ({ ...s, partner: e.target.value }))}
                    className="form-input">
                    <option value="">— Tanlanmagan —</option>
                    {others.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}{p.birth_date ? ` (${new Date(p.birth_date).getFullYear()})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="📅 To'y sanasi (ixtiyoriy)">
                  <input type="date" value={newSpouse.wedding_date}
                    onChange={e => setNewSpouse(s => ({ ...s, wedding_date: e.target.value }))}
                    className="form-input" />
                </Field>
              </div>
            </div>
          )}

          {/* Row 4b: Oila boshqaruvi (faqat tahrirlashda) */}
          {isEdit && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>💍 OILA (TURMUSH O'RTOG'I)</span>
                <button type="button" onClick={() => setShowFamForm(v => !v)}
                  className="text-xs px-3 py-1 rounded-lg font-semibold transition"
                  style={{ background: showFamForm ? (isDark ? 'rgba(127,29,29,0.4)' : '#fee2e2') : (isDark ? 'rgba(5,46,22,0.4)' : '#ecfdf5'), color: showFamForm ? (isDark ? '#fca5a5' : '#dc2626') : (isDark ? '#86efac' : '#16a34a'), border: `1px solid ${showFamForm ? (isDark ? '#991b1b' : '#fca5a5') : (isDark ? '#166534' : '#86efac')}` }}>
                  {showFamForm ? '✕ Yopish' : '➕ Oila qo\'shish'}
                </button>
              </div>

              {/* Yangi oila formi */}
              {showFamForm && (
                <div className="p-3 rounded-xl mb-3" style={{
                  background: isDark ? 'rgba(5,46,22,0.5)' : '#f0fdf4',
                  border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`,
                }}>
                  <div className="grid grid-cols-2 gap-2 mb-2 pf-famgrid">
                    <Field label="💍 Turmush o'rtog'i *">
                      <select value={famForm.partner} onChange={e => setFamForm(f => ({...f, partner: e.target.value}))} className="form-input">
                        <option value="">— Tanlang —</option>
                        {others.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}{p.birth_date ? ` (${new Date(p.birth_date).getFullYear()})` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="📅 To'y sanasi">
                      <input type="date" value={famForm.wedding_date} onChange={e => setFamForm(f => ({...f, wedding_date: e.target.value}))} className="form-input" />
                    </Field>
                    <Field label="💔 Ajralish sanasi">
                      <input type="date" value={famForm.divorce_date} onChange={e => setFamForm(f => ({...f, divorce_date: e.target.value}))} className="form-input" />
                    </Field>
                    <Field label="📝 Izoh">
                      <input type="text" value={famForm.note} onChange={e => setFamForm(f => ({...f, note: e.target.value}))} className="form-input" placeholder="Ixtiyoriy..." />
                    </Field>
                  </div>
                  <button type="button" disabled={famLoading || !famForm.partner}
                    onClick={async () => {
                      if (!famForm.partner) { toast.error('Turmush o\'rtog\'ini tanlang'); return }
                      setFamLoading(true)
                      try {
                        const pid = parseInt(id)
                        const partner = parseInt(famForm.partner)
                        const me = persons.find(p => p.id === pid) || { gender: form.gender }
                        const payload = {
                          husband: (form.gender === 'male' || me.gender === 'male') ? pid : partner,
                          wife:    (form.gender === 'male' || me.gender === 'male') ? partner : pid,
                          wedding_date: famForm.wedding_date || null,
                          divorce_date: famForm.divorce_date || null,
                          note: famForm.note,
                        }
                        await createFamily(payload)
                        toast.success('✅ Oila qo\'shildi!')
                        setFamForm({ partner: '', wedding_date: '', divorce_date: '', note: '' })
                        setShowFamForm(false)
                        loadFamilies()
                      } catch (err) {
                        const msg = err?.response?.data
                        toast.error(`❌ ${JSON.stringify(msg) || 'Xato'}`)
                      } finally { setFamLoading(false) }
                    }}
                    className="btn btn-success text-xs w-full">
                    {famLoading ? '⏳...' : '💾 Oilani saqlash'}
                  </button>
                </div>
              )}

              {/* Mavjud oilalar */}
              {families.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-3 rounded-xl" style={{ border: `1px dashed ${isDark ? '#334155' : '#e2e8f0'}` }}>
                  Hozircha oila ma'lumoti kiritilmagan
                </div>
              ) : (
                <div className="space-y-2">
                  {families.map((fam, fi) => {
                    const isHusband = fam.husband === parseInt(id)
                    const partner   = isHusband ? { id: fam.wife, name: fam.wife_name, photo: fam.wife_photo } : { id: fam.husband, name: fam.husband_name, photo: fam.husband_photo }
                    return (
                      <div key={fam.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                        style={{
                          background: fam.is_divorced
                            ? (isDark ? 'rgba(127,29,29,0.35)' : '#fef2f2')
                            : (isDark ? 'rgba(5,46,22,0.35)' : '#f0fdf4'),
                          border: `1px solid ${fam.is_divorced
                            ? (isDark ? '#991b1b' : '#fca5a5')
                            : (isDark ? '#166534' : '#bbf7d0')}`,
                        }}>
                        <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-lg flex-shrink-0"
                          style={{ background: isDark ? '#1e1b4b' : '#e0e7ff' }}>
                          {(partner.photo_url || partner.photo) ? <img src={partner.photo_url || partner.photo} className="w-full h-full object-cover" alt="" /> : '👤'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-gray-700 truncate">{fi+1}. {partner.name}</div>
                          <div className="text-xs text-gray-400">
                            {fam.wedding_date ? `💍 ${fam.wedding_date}` : 'Sana noma\'lum'}
                            {fam.is_divorced && <span className="ml-2 text-red-400">· Ajralgan</span>}
                          </div>
                        </div>
                        <button type="button" onClick={async () => {
                          if (!confirm(`"${partner.name}" bilan oilani o'chirasizmi?`)) return
                          await deleteFamily(fam.id)
                          toast.success('🗑️ O\'chirildi')
                          loadFamilies()
                        }} className="text-red-400 hover:text-red-600 text-sm px-2">🗑️</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Hints */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl pf-hints" style={{
            background: isDark ? 'rgba(5,46,22,0.5)' : '#f0fdf4',
            border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`,
          }}>
            <div className="text-xs" style={{ color: isDark ? '#86efac' : '#15803d' }}>
              <strong>💡 Maslahat:</strong> Ota yoki onani tanlash uchun avval ularni bazaga kiritgan bo'lishingiz kerak.
            </div>
            <div className="text-xs" style={{ color: isDark ? '#86efac' : '#15803d' }}>
              <strong>💍 Ko'p oila:</strong> Bir nechta nikoh bo'lsa, "Oila qo'shish" tugmasini bosing — har birini alohida kiritish mumkin.
            </div>
          </div>
        </div>
      </form>
    </div>

    {/* Mobile sticky save bar */}
    <div className="pf-mobile-savebar" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      padding: '10px 14px 14px',
      background: isDark
        ? 'rgba(15,23,42,0.95)'
        : 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      display: 'flex', gap: 8,
    }}>
      <button type="button" onClick={() => navigate(backPath)}
        style={{
          padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          background: 'transparent', fontSize: 13, fontWeight: 700,
          color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer', flexShrink: 0,
        }}>
        ← Orqaga
      </button>
      {isEdit && (
        <button type="button" onClick={handleDelete}
          style={{
            padding: '10px 12px', borderRadius: 10, border: 'none',
            background: isDark ? 'rgba(127,29,29,0.4)' : '#fee2e2',
            color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}>
          🗑️
        </button>
      )}
      <button type="button" onClick={handleSubmit} disabled={loading}
        style={{
          flex: 1, padding: '11px', borderRadius: 10, border: 'none',
          background: loading ? '#a5b4fc' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          color: 'white', fontSize: 14, fontWeight: 800,
          cursor: loading ? 'default' : 'pointer',
          boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
        }}>
        {loading ? '⏳ Saqlanmoqda...' : '💾 Saqlash'}
      </button>
    </div>
    </>
  )
}

function Field({ label, children, error }) {
  return (
    <div>
      <label className="form-label mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
      {error && (
        <div style={{
          marginTop: 4, fontSize: 11.5, fontWeight: 600, color: '#dc2626',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span>⚠</span> {error}
        </div>
      )}
    </div>
  )
}
