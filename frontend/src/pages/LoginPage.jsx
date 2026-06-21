import { useNavigate } from 'react-router-dom'
import AuthModal from '../components/AuthModal'

export default function LoginPage() {
  const navigate = useNavigate()
  return <AuthModal onClose={() => navigate('/')} />
}
