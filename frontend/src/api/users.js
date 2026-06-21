import api from './axios'
import axios from 'axios'

export const updateMe       = (data) => api.patch('/auth/me/update/', data)
export const changePassword = (data) => api.post('/auth/me/change-password/', data)

// 4.1 — Invite token orqali ro'yxatdan o'tish
export const inviteRegister = (data) => axios.post('/api/auth/invite-register/', data)
