import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPersons, deletePerson } from '../../api/persons'
import toast from 'react-hot-toast'
import { fmtDate } from '../../utils/date'
import AnimCount from '../../components/AnimCount'

// ── Saralash ─────────────────────────────────────────────────
function sortPersons(list, key, dir) {
  const arr = [...list]
  const asc = dir === 'asc'
  arr.sort((a, b) => {
    let va, vb
    switch (key) {
      case 'name':
        va = a.full_name || ''; vb = b.full_name || ''
        return asc ? va.localeCompare(vb, 'uz') : vb.localeCompare(va, 'uz')
      case 'age':
        va = a.birth_date ? new Date(a.birth_date).getFullYear() : (asc ? 9999 : 0)
        vb = b.birth_date ? new Date(b.birth_date).getFullYear() : (asc ? 9999 : 0)
        return asc ? va - vb : vb - va
      case 'birth':
        va = a.birth_date || (asc ? 'z' : '')
        vb = b.birth_date || (asc ? 'z' : '')
        return asc ? va.localeCompare(vb) : vb.localeCompare(va)
      case 'death':
        va = a.death_date || (asc ? 'z' : '')
        vb = b.death_date || (asc ? 'z' : '')
        return asc ? va.localeCompare(vb) : vb.localeCompare(va)
      case 'child':
        va = a.child_number || (asc ? 999 : 0)
        vb = b.child_number || (asc ? 999 : 0)
        return asc ? va - vb : vb - va
      default: return 0
    }
  })
  return arr
}

// Ustun sarlavhasi + sort arrow
function Th({ label, sortKey, current, dir, onSort, style }) {
  const active = current === sortKey
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      onClick={() => onSort(sortKey)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <span style={{ fontSize: 10, opacity: active ? 1 : 0.3, color: active ? '#6366f1' : 'inherit' }}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  )
}

// ── Person detail modal ──────────────────────────────────────
function PersonViewModal({ person, onClose, onEdit, onDelete }) {
  if (!person) return null

  const isMale     = person.gender === 'male'
  const isDeceased = !!person.death_date
  const photoSrc   = person.photo_url || person.photo || null

  // Yosh hisoblash: vafot etgan bo'lsa vafotidagi yoshi
  const ageLabel = (() => {
    if (!person.birth_date) return null
    if (isDeceased && person.age_at_death != null) {
      return `${person.age_at_death} yoshida vafot etgan`
    }
    return person.age != null ? `${person.age} yosh` : null
  })()

  const InfoRow = ({ label, value, icon, children }) => {
    if (!value && !children) return null
    return (
      <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
        <span className="text-sm w-5 flex-shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-0.5">{label}</div>
          {value && <div className="text-sm font-medium text-gray-700">{value}</div>}
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ animation: 'scaleIn .2s ease both', maxHeight: '90vh' }}>

        {/* Header gradient + avatar overlay */}
        <div className="relative flex-shrink-0"
          style={{
            background: isDeceased
              ? 'linear-gradient(135deg,#6b7280,#4b5563)'
              : isMale
                ? 'linear-gradient(135deg,#3b82f6,#6366f1)'
                : 'linear-gradient(135deg,#ec4899,#db2777)',
            paddingBottom: 44,
            paddingTop: 14,
          }}>
          <div className="flex items-center justify-between px-4">
            {isDeceased
              ? <span className="text-xs bg-white/25 text-white px-2.5 py-1 rounded-full font-semibold">🌿 Vafot etgan</span>
              : <span className="text-xs bg-white/25 text-white px-2.5 py-1 rounded-full font-semibold">💚 Tirik</span>}
            <button onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold transition"
              style={{ background: 'rgba(255,255,255,0.2)' }}>✕</button>
          </div>
        </div>

        {/* Avatar — centered, overlapping header */}
        <div className="flex justify-center" style={{ marginTop: -44 }}>
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-xl overflow-hidden flex items-center justify-center text-4xl"
              style={{ background: isMale ? '#dbeafe' : '#fce7f3' }}>
              {photoSrc
                ? <img src={photoSrc} className="w-full h-full object-cover" alt={person.full_name} />
                : <span>{isMale ? '👨' : '👩'}</span>}
            </div>
            {/* gender dot */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-xs"
              style={{ background: isMale ? '#3b82f6' : '#ec4899' }}>
              {isMale ? '♂' : '♀'}
            </div>
          </div>
        </div>

        {/* Name + badges */}
        <div className="text-center px-5 pt-2 pb-3">
          <h2 className="text-base font-bold text-gray-800 leading-tight">{person.full_name}</h2>
          <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`badge ${isMale ? 'badge-male' : 'badge-female'}`}>
              {isMale ? '👨 Erkak' : '👩 Ayol'}
            </span>
            {ageLabel && (
              <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                🎂 {ageLabel}
              </span>
            )}
            {person.child_number && (
              <span className="badge" style={{ background: '#f0fdf4', color: '#15803d' }}>
                🔢 {person.child_number}-farzand
              </span>
            )}
          </div>
        </div>

        {/* Scrollable info */}
        <div className="px-5 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
          <InfoRow icon="📅" label="Tug'ilgan sana" value={fmtDate(person.birth_date)} />

          {isDeceased && (
            <InfoRow icon="🌿" label="Vafot etgan sana">
              <div className="text-sm font-medium text-gray-700">{fmtDate(person.death_date)}</div>
              {person.age_at_death != null && person.birth_date && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {new Date(person.birth_date).getFullYear()} — {new Date(person.death_date).getFullYear()} · {person.age_at_death} yoshida
                </div>
              )}
            </InfoRow>
          )}

          <InfoRow icon="📞" label="Telefon" value={person.phone || null} />
          <InfoRow icon="👨" label="Otasi"  value={person.father_name || null} />
          <InfoRow icon="👩" label="Onasi"  value={person.mother_name || null} />
          <InfoRow icon="💍" label="Turmush o'rtog'i" value={person.spouse_name || null} />

          {/* Children */}
          {person.children?.length > 0 && (
            <InfoRow icon="👶" label={`Farzandlari (${person.children.length} ta)`}>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {person.children.map(c => (
                  <span key={c.id} className={`badge ${c.gender === 'male' ? 'badge-male' : 'badge-female'}`}>
                    {c.gender === 'male' ? '👨' : '👩'} {c.full_name}
                    {c.birth_date ? ` (${new Date(c.birth_date + 'T00:00:00').getFullYear()})` : ''}
                  </span>
                ))}
              </div>
            </InfoRow>
          )}

          <InfoRow icon="👤" label="Qo'shgan" value={person.created_by_name || null} />
          <div className="h-3" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onEdit} className="btn btn-primary flex-1 justify-center text-sm py-2">
            ✏️ Tahrirlash
          </button>
          <button onClick={onDelete} className="btn text-sm px-4 py-2"
            style={{ background: '#fef2f2', color: '#dc2626' }}>
            🗑️ O'chirish
          </button>
          <button onClick={onClose} className="btn btn-ghost text-sm px-4 py-2">
            ✕ Yopish
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm modal ─────────────────────────────────────
function DeleteModal({ person, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  if (!person) return null

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: 'scaleIn .2s ease both' }}>
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-4xl mx-auto mb-4">
            🗑️
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">O'chirishni tasdiqlang</h2>
          <p className="text-sm text-gray-500 mb-1">
            Quyidagi shaxs ma'lumotlari bazadan <strong>butunlay o'chiriladi</strong>:
          </p>
          <div className="bg-red-50 rounded-xl px-4 py-3 my-4 text-left">
            <div className="font-bold text-red-700">{person.full_name}</div>
            {person.birth_date && (
              <div className="text-xs text-red-400 mt-0.5">
                {fmtDate(person.birth_date)}
                {person.age ? ` · ${person.age} yosh` : ''}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">Bu amalni qaytarib bo'lmaydi!</p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn btn-ghost flex-1 justify-center">
            Bekor qilish
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="btn flex-1 justify-center font-bold"
            style={{ background: '#ef4444', color: 'white', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
            {loading ? '⏳...' : '🗑️ Ha, o\'chirish'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function AdminPersons() {
  const [persons, setPersons]       = useState([])
  const [search, setSearch]         = useState('')
  const [gender, setGender]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [deletePerson_, setDeletePerson] = useState(null)
  const [sortKey, setSortKey]       = useState('name')
  const [sortDir, setSortDir]       = useState('asc')
  const navigate = useNavigate()

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPersons({ search, gender })
      setPersons(res.data)
    } catch {
      toast.error('❌ Ma\'lumotlarni yuklashda xato')
    } finally {
      setLoading(false)
    }
  }, [search, gender])

  useEffect(() => { load() }, [load])

  const sorted = useMemo(() => sortPersons(persons, sortKey, sortDir), [persons, sortKey, sortDir])

  const handleView = (id) => {
    navigate(`/admin/persons/${id}`)
  }

  const handleDeleteConfirm = async () => {
    if (!deletePerson_) return
    try {
      await deletePerson(deletePerson_.id)
      toast.success(`✅ "${deletePerson_.full_name}" o'chirildi`)
      setDeletePerson(null)
      load()
    } catch {
      toast.error('❌ O\'chirishda xato yuz berdi')
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">👥 Barcha shaxslar</h1>
          <p className="text-xs text-gray-400 mt-0.5"><AnimCount to={persons.length} /> ta shaxs topildi</p>
        </div>
        <button onClick={() => navigate('/admin/persons/add')} className="btn btn-success">
          ➕ Yangi shaxs
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        {/* Search with proper icon */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text"
            placeholder="Ism, familiya yoki otasining ismi bo'yicha qidiring..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-9 w-full" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
          {[['', '👥 Barcha'], ['male', '👨 Erkak'], ['female', '👩 Ayol']].map(([val, lbl]) => (
            <button key={val} onClick={() => setGender(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                gender === val
                  ? 'text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
              style={gender === val ? { background: 'linear-gradient(135deg,#3b82f6,#6366f1)' } : {}}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 animate-bounce">🌳</div>
            <div className="text-sm text-gray-400">Yuklanmoqda...</div>
          </div>
        ) : persons.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm font-medium text-gray-500">Hech kim topilmadi</div>
            <div className="text-xs text-gray-400 mt-1">Qidiruv shartlarini o'zgartiring</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>№</th>
                <Th label="Shaxs"        sortKey="name"  current={sortKey} dir={sortDir} onSort={handleSort} />
                <th>Jins</th>
                <Th label="Yoshi"        sortKey="age"   current={sortKey} dir={sortDir} onSort={handleSort} />
                <Th label="Tug'ilgan"    sortKey="birth" current={sortKey} dir={sortDir} onSort={handleSort} />
                <Th label="Vafot sanasi" sortKey="death" current={sortKey} dir={sortDir} onSort={handleSort} />
                <Th label="Farzand #"    sortKey="child" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th>Holati</th>
                <th style={{ width: 110 }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">
                      {i + 1}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: p.gender === 'male' ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'linear-gradient(135deg,#ec4899,#db2777)' }}>
                        {p.photo
                          ? <img src={p.photo} className="w-full h-full object-cover" alt="" />
                          : (p.gender === 'male' ? '👨' : '👩')}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-700 text-xs leading-tight">{p.full_name}</div>
                        {p.phone && <div className="text-xs text-gray-400">{p.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${p.gender === 'male' ? 'badge-male' : 'badge-female'}`}>
                      {p.gender === 'male' ? '👨 Erkak' : '👩 Ayol'}
                    </span>
                  </td>
                  <td className="text-gray-600 text-xs">
                    {p.age != null ? `${p.age} yosh` : '—'}
                  </td>
                  <td className="text-gray-600 text-xs">
                    {p.birth_date ? fmtDate(p.birth_date) : '—'}
                  </td>
                  <td className="text-gray-600 text-xs">
                    {p.death_date ? fmtDate(p.death_date) : '—'}
                  </td>
                  <td className="text-gray-600 text-xs text-center">
                    {p.child_number ? `${p.child_number}-farzand` : '—'}
                  </td>
                  <td>
                    {p.death_date
                      ? <span className="badge badge-dead">🌿 Vafot etgan</span>
                      : <span className="badge badge-alive">💚 Tirik</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {/* View */}
                      <button onClick={() => handleView(p.id)}
                        title="Ko'rish"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:scale-110"
                        style={{ background: '#eff6ff', color: '#2563eb' }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      {/* Edit */}
                      <button onClick={() => navigate(`/admin/persons/${p.id}/edit`)}
                        title="Tahrirlash"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:scale-110"
                        style={{ background: '#fffbeb', color: '#d97706' }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {/* Delete */}
                      <button onClick={() => setDeletePerson(p)}
                        title="O'chirish"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:scale-110"
                        style={{ background: '#fef2f2', color: '#dc2626' }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirm modal */}
      {deletePerson_ && (
        <DeleteModal
          person={deletePerson_}
          onClose={() => setDeletePerson(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}
