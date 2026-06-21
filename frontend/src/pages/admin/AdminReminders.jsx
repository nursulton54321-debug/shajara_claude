import { useEffect, useState, useCallback } from 'react'
import { getReminders, getReminderStats, createReminder, updateReminder, deleteReminder, autoCreateReminders } from '../../api/reminders'
import { getPersons } from '../../api/persons'
import toast from 'react-hot-toast'
import { fmtDate } from '../../utils/date'

const TYPE_OPTIONS = [
  { value: 'birthday',     label: "Tug'ilgan kun",         icon: '🎂', color: '#10b981' },
  { value: 'wedding',      label: "To'y / Nikoh",          icon: '💍', color: '#f43f5e' },
  { value: 'school_start', label: "O'qishga kirish",       icon: '🎒', color: '#6366f1' },
  { value: 'school_end',   label: "O'qishni tugatish",     icon: '🎓', color: '#8b5cf6' },
  { value: 'work_start',   label: "Ishga kirish",          icon: '💼', color: '#0ea5e9' },
  { value: 'work_end',     label: "Ishdan ketish",         icon: '🏠', color: '#64748b' },
  { value: 'military',     label: "Harbiy xizmat",         icon: '🎖️', color: '#d97706' },
  { value: 'hajj',         label: "Haj / Umra",            icon: '🕌', color: '#059669' },
  { value: 'award',        label: "Mukofot / Unvon",       icon: '🏆', color: '#f59e0b' },
  { value: 'move',         label: "Ko'chib o'tish",        icon: '🏡', color: '#ec4899' },
  { value: 'illness',      label: "Kasallik / Davolanish", icon: '🏥', color: '#ef4444' },
  { value: 'travel',       label: "Sayohat",               icon: '✈️', color: '#06b6d4' },
  { value: 'death',        label: "Vafot etgan kun",       icon: '🌿', color: '#6b7280' },
  { value: 'memorial',     label: "Xotira kuni",           icon: '🕯️', color: '#94a3b8' },
  { value: 'other',        label: "Boshqa",                icon: '📌', color: '#a855f7' },
]

const MONTHS = ['','Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']

const DAYS_COLOR = (d) => {
  if (d === 0) return { bg: '#fef9c3', color: '#a16207', text: 'Bugun!' }
  if (d <= 7)  return { bg: '#fef3c7', color: '#d97706', text: `${d} kun qoldi` }
  if (d <= 30) return { bg: '#fffbeb', color: '#f59e0b', text: `${d} kun qoldi` }
  return { bg: '#f8fafc', color: '#94a3b8', text: `${d} kun qoldi` }
}

// ── Modal ──────────────────────────────────────────────────
function ReminderModal({ onClose, onSave, persons, initial }) {
  const [form, setForm] = useState({
    person: '', type: 'birthday', date: '', note: '', is_active: true,
    ...initial,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.person) { toast.error('Shaxsni tanlang!'); return }
    if (!form.date)   { toast.error('Sanani kiriting!'); return }
    await onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-[scaleIn_0.2s_ease_both]"
        style={{ animation: 'scaleIn 0.2s ease both' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
          <h2 className="text-white font-bold text-sm">
            {initial ? '✏️ Eslatmani tahrirlash' : '➕ Yangi eslatma qo\'shish'}
          </h2>
          <button onClick={onClose} className="text-white hover:text-purple-200 text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Person */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              👤 Shaxs
            </label>
            <select value={form.person} onChange={e => set('person', e.target.value)} className="form-input">
              <option value="">-- Shaxsni tanlang --</option>
              {persons.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              🏷️ Eslatma turi
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(({ value, label, icon }) => (
                <button key={value} type="button"
                  onClick={() => set('type', value)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-medium transition ${
                    form.type === value
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <span className="text-base">{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              📅 Sana
            </label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="form-input" required />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              📝 Eslatma matni
            </label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)}
              rows={2} className="form-input resize-none"
              placeholder="Eslatma matni..." />
          </div>

          {/* Active */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600" />
            <span className="text-sm text-gray-700 font-medium">✅ Eslatma berilsin</span>
          </label>

          <button type="submit"
            className="btn btn-success w-full justify-center py-3">
            💾 Saqlash
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export default function AdminReminders() {
  const [reminders, setReminders] = useState([])
  const [stats, setStats]         = useState(null)
  const [persons, setPersons]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)

  // Filters
  const [filterType,  setFilterType]  = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear,  setFilterYear]  = useState('')
  const [filterActive,setFilterActive]= useState('')
  const [sort, setSort] = useState('nearest')

  const load = useCallback(async () => {
    setLoading(true)
    const params = { sort }
    if (filterType)   params.type   = filterType
    if (filterMonth)  params.month  = filterMonth
    if (filterYear)   params.year   = filterYear
    if (filterActive) params.active = filterActive
    const [rRes, sRes] = await Promise.all([getReminders(params), getReminderStats()])
    setReminders(rRes.data)
    setStats(sRes.data)
    setLoading(false)
  }, [filterType, filterMonth, filterYear, filterActive, sort])

  useEffect(() => { load() }, [load])
  useEffect(() => { getPersons().then(r => setPersons(r.data)) }, [])

  const handleSave = async (form) => {
    try {
      if (editing) {
        await updateReminder(editing.id, form)
        toast.success('✅ Yangilandi!')
      } else {
        await createReminder(form)
        toast.success('✅ Eslatma qo\'shildi!')
      }
      setShowModal(false); setEditing(null); load()
    } catch { toast.error('❌ Xato yuz berdi!') }
  }

  const handleDelete = async (id) => {
    if (!confirm('O\'chirib tashlamoqchimisiz?')) return
    await deleteReminder(id)
    toast.success('🗑️ O\'chirildi')
    load()
  }

  const handleAuto = async () => {
    if (!confirm('Barcha shaxslarning tug\'ilgan va vafot sanalaridan avtomatik eslatma yaratilsinmi?')) return
    const res = await autoCreateReminders()
    toast.success(`✅ ${res.data.message}`)
    load()
  }

  const resetFilters = () => {
    setFilterType(''); setFilterMonth(''); setFilterYear(''); setFilterActive(''); setSort('nearest')
  }

  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="p-6 page-enter space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🔔 Eslatmalar boshqaruvi</h1>
          <p className="text-xs text-gray-400 mt-0.5">Muhim sanalar va eslatmalar</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="btn btn-success text-sm">
            ➕ Yangi eslatma
          </button>
          <button onClick={handleAuto} className="btn btn-primary text-sm">
            🔄 Avtomatik yaratish
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
          {[
            ['Jami eslatmalar', stats.total,      '🔔', '#3b82f6'],
            ['Aktiv eslatmalar',stats.active,     '✅', '#10b981'],
            ['Kelgusi 30 kun',  stats.next_30_days,'📅','#f59e0b'],
            ['Shu oy',          stats.this_month, '🗓️', '#8b5cf6'],
          ].map(([label, value, icon, color]) => (
            <div key={label} className="admin-card p-4 card-enter flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: color + '18' }}>{icon}</div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{value ?? '—'}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">🔽</span>
          <span className="text-sm font-bold text-gray-700">Filtrlar</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">🏷️ Eslatma turi</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="form-input text-xs">
              <option value="">Barcha turlar</option>
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">📅 Oy</label>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="form-input text-xs">
              <option value="">Barcha oylar</option>
              {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">📆 Yil</label>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="form-input text-xs">
              <option value="">Barcha yillar</option>
              {years.slice(0, 80).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">📊 Saralash</label>
            <select value={sort} onChange={e => setSort(e.target.value)} className="form-input text-xs">
              <option value="nearest">Eng yaqin sana</option>
              <option value="date_asc">Sana (o'sish)</option>
              <option value="date_desc">Sana (kamayish)</option>
              <option value="name">Ism bo'yicha</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={load} className="btn btn-primary text-xs flex-1 justify-center">
              🔍 Filtrlash
            </button>
            <button onClick={resetFilters} className="btn btn-ghost text-xs px-3">
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <span>📋</span>
            <span className="text-sm font-bold text-gray-700">Eslatmalar ro'yxati</span>
          </div>
          <span className="text-xs text-gray-400">Jami: {reminders.length} ta</span>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-3xl animate-bounce mb-2">🔔</div>
            <div className="text-sm text-gray-400">Yuklanmoqda...</div>
          </div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📭</div>
            <div className="font-medium text-gray-500">Eslatmalar yo'q</div>
            <div className="text-xs text-gray-400 mt-1">Yangi eslatma qo'shing yoki filtrlarni o'zgartiring</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Rasm</th>
                <th>Shaxs</th>
                <th>Eslatma turi</th>
                <th>Sana</th>
                <th>Matn</th>
                <th>Holati</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r, i) => {
                const dc = DAYS_COLOR(r.days_until ?? 999)
                const typeOpt = TYPE_OPTIONS.find(t => t.value === r.type)
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">{i+1}</span>
                    </td>
                    <td>
                      <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-white text-sm font-bold"
                        style={{ background: r.person_gender === 'male' ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'linear-gradient(135deg,#ec4899,#db2777)' }}>
                        {r.person_photo
                          ? <img src={r.person_photo} className="w-full h-full object-cover" alt="" />
                          : r.person_name?.[0]}
                      </div>
                    </td>
                    <td>
                      <span className="font-semibold text-gray-700 text-sm">{r.person_name}</span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: '#f0f0ff', color: '#4f46e5' }}>
                        {typeOpt?.icon} {r.type_display}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-gray-700">
                        {fmtDate(r.date)}
                      </div>
                      {r.days_until != null && (
                        <div className="text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block"
                          style={{ background: dc.bg, color: dc.color, fontWeight: 600 }}>
                          📅 {dc.text}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="text-xs text-gray-500 max-w-48 truncate block">
                        {r.note ? <><span className="text-gray-300 mr-1">|</span>{r.note}</> : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${r.is_active ? 'badge-alive' : 'badge-dead'}`}>
                        {r.is_active ? '✅ Aktiv' : '❌ Nofaol'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditing(r); setShowModal(true) }}
                          title="Tahrirlash"
                          className="w-7 h-7 rounded-lg hover:bg-amber-50 text-amber-500 flex items-center justify-center transition text-xs">✏️</button>
                        <button onClick={() => handleDelete(r.id)}
                          title="O'chirish"
                          className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center transition text-xs">🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ReminderModal
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={handleSave}
          persons={persons}
          initial={editing ? {
            person: editing.person,
            type: editing.type,
            date: editing.date,
            note: editing.note,
            is_active: editing.is_active,
          } : null}
        />
      )}
    </div>
  )
}
