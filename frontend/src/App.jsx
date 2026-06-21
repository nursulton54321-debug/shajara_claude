import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import axios from 'axios'
import api from './api/axios'
import useAuthStore from './store/authStore'
import PinGate from './components/PinGate'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

import UserLayout from './pages/user/UserLayout'
import DashboardPage from './pages/user/DashboardPage'
import TreePage from './pages/user/TreePage'
import PersonsListPage from './pages/user/PersonsListPage'
import PersonFormPage from './pages/user/PersonFormPage'
import PersonProfilePage from './pages/user/PersonProfilePage'
import RelationshipPage from './pages/user/RelationshipPage'
import StatisticsPage from './pages/user/StatisticsPage'

import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminPersons from './pages/admin/AdminPersons'
import AdminUsers from './pages/admin/AdminUsers'
import AdminSettings from './pages/admin/AdminSettings'
import AdminReminders from './pages/admin/AdminReminders'
import AdminStats from './pages/admin/AdminStats'
import AdminLink from './pages/admin/AdminLink'
import AdminAuditLog from './pages/admin/AdminAuditLog'
import AdminInvites  from './pages/admin/AdminInvites'

// 4.x pages
import MyProfilePage      from './pages/user/MyProfilePage'
import NotificationsPage  from './pages/user/NotificationsPage'
import InvitePage         from './pages/InvitePage'
import PublicPersonPage   from './pages/PublicPersonPage'
import InstallPrompt      from './components/InstallPrompt'
import PublicTreePage     from './pages/PublicTreePage'
import ThemeToggleFloat   from './components/ThemeToggleFloat'
import AiChatWidget       from './components/AiChatWidget'

function PrivateRoute({ children, adminOnly = false }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin' && !user.is_superuser) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, logout } = useAuthStore()

  // Sahifa yangilanganda: user bor lekin token yo'q → refresh qilib tokenni tiklash
  useEffect(() => {
    const refresh = sessionStorage.getItem('refresh')
    if (user && refresh && !api.defaults.headers.Authorization) {
      axios.post('/api/auth/refresh/', { refresh })
        .then(res => {
          api.defaults.headers.Authorization = `Bearer ${res.data.access}`
        })
        .catch(() => {
          logout()
          sessionStorage.removeItem('refresh')
        })
    }
  }, [])

  return (
    <PinGate>
    <InstallPrompt />
    <ThemeToggleFloat />
    <AiChatWidget />
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Eski root redirect */}
      <Route path="/home" element={<Navigate to="/" replace />} />

      {/* 4.1 — Invite orqali ro'yxatdan o'tish (public) */}
      <Route path="/invite/:token" element={<InvitePage />} />
      {/* 4.3 — Public shaxs profili (auth talab qilinmaydi) */}
      <Route path="/p/:slug" element={<PublicPersonPage />} />
      {/* 12 — Public shajara (token orqali, login talab qilinmaydi) */}
      <Route path="/s/:token" element={<PublicTreePage />} />

      {/* Foydalanuvchi sahifalari — hamma uchun ochiq, login ixtiyoriy */}
      <Route path="/" element={<UserLayout />}>
        <Route index element={<TreePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tree" element={<TreePage />} />
        <Route path="persons" element={<PrivateRoute><PersonsListPage /></PrivateRoute>} />
        <Route path="persons/add" element={<PrivateRoute><PersonFormPage /></PrivateRoute>} />
        <Route path="persons/:id" element={<PrivateRoute><PersonProfilePage /></PrivateRoute>} />
        <Route path="persons/:id/edit" element={<PrivateRoute><PersonFormPage /></PrivateRoute>} />
        <Route path="statistics" element={<PrivateRoute><StatisticsPage /></PrivateRoute>} />
        <Route path="relationship" element={<RelationshipPage />} />
        {/* 4.2 My Profile */}
        <Route path="my-profile" element={<MyProfilePage />} />
        {/* 4.4 Notifications */}
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="/admin" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="persons" element={<AdminPersons />} />
        <Route path="persons/add" element={<PersonFormPage isAdmin />} />
        <Route path="persons/:id" element={<PersonProfilePage isAdmin />} />
        <Route path="persons/:id/edit" element={<PersonFormPage isAdmin />} />
        <Route path="link"      element={<AdminLink />} />
        <Route path="reminders" element={<AdminReminders />} />
        <Route path="stats"     element={<AdminStats />} />
        <Route path="users"     element={<PrivateRoute adminOnly><AdminUsers /></PrivateRoute>} />
        <Route path="settings"  element={<PrivateRoute adminOnly><AdminSettings /></PrivateRoute>} />
        <Route path="audit"     element={<PrivateRoute adminOnly><AdminAuditLog /></PrivateRoute>} />
        {/* 4.1 Invites */}
        <Route path="invites"   element={<AdminInvites />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </PinGate>
  )
}
