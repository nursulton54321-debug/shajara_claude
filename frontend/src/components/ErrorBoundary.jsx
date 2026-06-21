import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16,
        background: '#0f172a', color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Kutilmagan xato yuz berdi</h2>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>
          {this.state.error?.message || 'Noma\'lum xato'}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14,
          }}
        >
          Sahifani yangilash
        </button>
      </div>
    )
  }
}
