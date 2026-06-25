import api, { invalidateCache } from './axios'

export const getPersons   = (params) => api.get('/persons/', { params })
export const getPerson    = (id)     => api.get(`/persons/${id}/`)
// FormData (faqat rasm yuklanganda)
export const createPerson = (data, config = {}) =>
  api.post('/persons/', data, { headers: { 'Content-Type': 'multipart/form-data' }, ...config })
    .then(r => { invalidateCache('/persons/'); return r })

export const updatePerson = (id, data, config = {}) =>
  api.patch(`/persons/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' }, ...config })
    .then(r => { invalidateCache('/persons/'); return r })

// JSON (rasm yo'q, to'liq clearing uchun)
export const createPersonJSON = (data) =>
  api.post('/persons/', data).then(r => { invalidateCache('/persons/'); return r })

export const updatePersonJSON = (id, data) =>
  api.patch(`/persons/${id}/`, data).then(r => { invalidateCache('/persons/'); return r })

export const deletePerson = (id) =>
  api.delete(`/persons/${id}/`).then(r => { invalidateCache('/persons/'); return r })
export const getTree      = ()       => api.get('/persons/tree/')
export const getStatistics= ()       => api.get('/persons/statistics/')
export const getBirthdays = ()       => api.get('/persons/birthdays/')

// Family (ko'p oila)
export const getFamilies      = (params) => api.get('/persons/families/', { params })
export const getFamily        = (id)     => api.get(`/persons/families/${id}/`)
export const createFamily     = (data)   => api.post('/persons/families/', data)
export const updateFamily     = (id, d)  => api.patch(`/persons/families/${id}/`, d)
export const deleteFamily     = (id)     => api.delete(`/persons/families/${id}/`)

// CSV
export const exportCSV    = () => api.get('/persons/export/csv/',    { responseType: 'blob' })
export const exportBackup = () => api.get('/persons/export/backup/', { responseType: 'blob' })

export const importCSV = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/persons/import/csv/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const importBackup = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/persons/import/backup/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// 5.2 Did You Know
export const getDidYouKnow = () => api.get('/persons/did-you-know/')

// 4.1 Invites
export const getInvites    = ()       => api.get('/persons/invites/')
export const createInvite  = (data)   => api.post('/persons/invites/', data)
export const deleteInvite  = (id)     => api.delete(`/persons/invites/${id}/`)
export const getInviteInfo = (token)  => api.get(`/persons/invite/${token}/`)

// 4.2 My Profile
export const getMyProfile  = ()       => api.get('/persons/my-profile/')
export const linkMyProfile = (personId) => api.post('/persons/my-profile/', { person_id: personId })
export const unlinkMyProfile= ()      => api.post('/persons/my-profile/', { person_id: null })

// 4.3 Public profile
export const getPublicPerson = (slug) => api.get(`/persons/public/${slug}/`)

// 4.4 Push
// AI Chat (global)
export const aiChat    = (data) => api.post('/persons/ai/chat/', data)
export const aiStatus  = ()     => api.get('/persons/ai/status/')

// 15. AI relationship explainer
export const aiExplain = (data) => api.post('/persons/ai/explain/', data)
// 16. OCR — hujjatdan ma'lumot o'qish
export const ocrDocument = (file) => {
  const fd = new FormData(); fd.append('image', file)
  return api.post('/persons/ai/ocr/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// 12. Share links (public tree)
export const getShareLinks   = ()         => api.get('/persons/share/')
export const createShareLink = (data)     => api.post('/persons/share/', data)
export const deleteShareLink = (id)       => api.delete('/persons/share/', { data: { id } })
export const getPublicTree   = (token)    => api.get(`/persons/share/${token}/`)

export const getVapidKey    = ()     => api.get('/persons/push/vapid-key/')
export const pushSubscribe  = (sub)  => api.post('/persons/push/subscribe/', sub)
export const pushUnsubscribe= (ep)   => api.delete('/persons/push/subscribe/', { data: { endpoint: ep } })
export const pushSendBirthdays = (days=7) => api.post('/persons/push/send-birthdays/', { days })
