import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
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
import Onboarding         from './components/Onboarding'

function PrivateRoute({ children, adminOnly = false }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin' && !user.is_superuser) return <Navigate to="/" replace />
  return children
}

function GuestWelcomeModal() {
  const [visible, setVisible] = useState(true)
  const [countdown, setCountdown] = useState(5)
  useEffect(() => {
    if (!visible) return
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); setVisible(false); return 0 } return c - 1 }), 1000)
    return () => clearInterval(t)
  }, [visible])
  if (!visible) return null
  return (
    <div onClick={() => setVisible(false)} style={{
      position:'fixed', inset:0, zIndex:99999,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)',
      padding:'16px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)',
        borderRadius:20, padding:'32px 28px', maxWidth:420, width:'100%',
        boxShadow:'0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.3)',
        textAlign:'center', color:'white', position:'relative',
      }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🌳</div>
        <h2 style={{ fontSize:20, fontWeight:900, marginBottom:8, lineHeight:1.3,
          background:'linear-gradient(135deg,#a5b4fc,#c4b5fd)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          Shajara daraxtiga xush kelibsiz!
        </h2>
        <p style={{ fontSize:14, color:'#c7d2fe', lineHeight:1.6, marginBottom:20 }}>
          Saytdan <strong style={{ color:'#a5b4fc' }}>to'liq foydalanish</strong> uchun
          login/parol orqali kiring.
          <br /><br />
          <span style={{ color:'#94a3b8' }}>
            Mehmon rejimida saytdagi ayrim ma'lumotlar bilan tanishishingiz mumkin.
          </span>
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <a href="/login" style={{
            display:'inline-block', padding:'11px 24px', borderRadius:12,
            background:'linear-gradient(135deg,#6366f1,#4f46e5)',
            color:'white', fontWeight:800, fontSize:14, textDecoration:'none',
            boxShadow:'0 4px 16px rgba(99,102,241,0.5)',
          }}>🔑 Login / Ro'yxatdan o'tish</a>
          <button onClick={() => setVisible(false)} style={{
            padding:'11px 20px', borderRadius:12, border:'1.5px solid rgba(148,163,184,0.3)',
            background:'rgba(255,255,255,0.07)', color:'#94a3b8',
            fontWeight:700, fontSize:13, cursor:'pointer',
          }}>Mehmon sifatida ko'rish</button>
        </div>
        <div style={{ marginTop:16, fontSize:12, color:'#64748b' }}>
          Bu oyna <strong style={{ color:'#818cf8' }}>{countdown}</strong> soniyadan keyin yopiladi
        </div>
        <div style={{ position:'absolute', bottom:0, left:0, height:3, borderRadius:'0 0 20px 20px',
          background:'linear-gradient(90deg,#6366f1,#a78bfa)',
          width:`${(countdown/5)*100}%`, transition:'width 1s linear' }} />
      </div>
    </div>
  )
}

export default function App() {
  const { user, logout } = useAuthStore()
  const [showOnboarding, setShowOnboarding] = useState(
    () => user && !localStorage.getItem('onboarding_done')
  )
  const [showGuestModal, setShowGuestModal] = useState(() => !user)

  // Sahifa yangilanganda: user bor lekin token yo'q → refresh qilib tokenni tiklash
  useEffect(() => {
    const refresh = sessionStorage.getItem('refresh')
    if (user && refresh && !api.defaults.headers.Authorization) {
      api.post('/auth/refresh/', { refresh })
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
    {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
    {showGuestModal && <GuestWelcomeModal />}
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
