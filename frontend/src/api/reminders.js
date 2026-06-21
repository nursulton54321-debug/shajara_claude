import api from './axios'

export const getReminders     = (params) => api.get('/persons/reminders/', { params })
export const getReminderStats = ()       => api.get('/persons/reminders/stats/')
export const createReminder   = (data)   => api.post('/persons/reminders/', data)
export const updateReminder   = (id, d)  => api.patch(`/persons/reminders/${id}/`, d)
export const deleteReminder   = (id)     => api.delete(`/persons/reminders/${id}/`)
export const autoCreateReminders = ()    => api.post('/persons/reminders/auto/')
