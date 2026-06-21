import { useEffect, useState } from 'react'
import { getPersons, updatePerson } from '../../api/persons'
import toast from 'react-hot-toast'

export default function AdminLink() {
  const [persons, setPersons] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ father: '', mother: '', spouse: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => { getPersons().then(r => setPersons(r.data)) }, [])

  const selectPerson = (p) => {
    setSelected(p)
    setForm({
      father: p.father_id != null ? String(p.father_id) : '',
      mother: p.mother_id != null ? String(p.mother_id) : '',
      spouse: p.spouse_id != null ? String(p.spouse_id) : '',
    })
  }

  const handleSave = async () => {
    if (!selected) return
    setLoading(true)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
    await updatePerson(selected.id, fd)
    toast.success('✅ Bog\'lanish saqlandi!')
    getPersons().then(r => setPersons(r.data))
    setLoading(false)
  }

  const others = persons.filter(p => p.id !== selected?.id)

  return (
    <div className="p-6 page-enter">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-800">🔗 Ota-ona bog'lash</h1>
        <p className="text-xs text-gray-400 mt-0.5">Shaxsni tanlang va ota-ona/juftini bog'lang</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Person list */}
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="text-sm font-bold text-gray-700">👥 Shaxsni tanlang</div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 450 }}>
            {persons.map(p => (
              <div key={p.id} onClick={() => selectPerson(p)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 transition ${selected?.id === p.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: p.gender === 'male' ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'linear-gradient(135deg,#ec4899,#db2777)' }}>
                  {p.photo ? <img src={p.photo} className="w-full h-full object-cover" alt="" /> : (p.gender === 'male' ? '👨' : '👩')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-700 text-sm truncate">{p.full_name}</div>
                  <div className="text-xs text-gray-400">{p.birth_date ? new Date(p.birth_date).getFullYear() : '?'}</div>
                </div>
                {selected?.id === p.id && <span className="text-blue-500 text-sm">✓</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Link form */}
        <div className="admin-card p-5">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
              <div className="text-5xl mb-3">🔗</div>
              <div className="font-medium">Shaxsni tanlang</div>
              <div className="text-xs mt-1">Chap tomondagi ro'yxatdan tanlang</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg,#eff6ff,#f0f9ff)' }}>
                <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center text-white text-lg font-bold"
                  style={{ background: selected.gender === 'male' ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'linear-gradient(135deg,#ec4899,#db2777)' }}>
                  {selected.photo ? <img src={selected.photo} className="w-full h-full object-cover" alt="" /> : (selected.gender === 'male' ? '👨' : '👩')}
                </div>
                <div>
                  <div className="font-bold text-gray-800">{selected.full_name}</div>
                  <div className="text-xs text-gray-500">{selected.birth_date ? new Date(selected.birth_date).getFullYear() : '?'}</div>
                </div>
              </div>

              {[
                ['father', '👨 Otasi', 'male'],
                ['mother', '👩 Onasi', 'female'],
                ['spouse', "💍 Turmush o'rtog'i", null],
              ].map(([key, label, gFilter]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="form-input">
                    <option value="">— Tanlanmagan —</option>
                    {others.filter(p => !gFilter || p.gender === gFilter).map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} {p.birth_date ? `(${new Date(p.birth_date).getFullYear()})` : ''}</option>
                    ))}
                  </select>
                </div>
              ))}

              <button onClick={handleSave} disabled={loading} className="btn btn-success w-full justify-center mt-2">
                {loading ? '⏳ Saqlanmoqda...' : '💾 Bog\'lanishni saqlash'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
