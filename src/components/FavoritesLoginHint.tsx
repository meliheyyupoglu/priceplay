import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Props = { className?: string }

export function FavoritesLoginHint({ className }: Props) {
  const { user } = useAuth()
  if (user) return null
  return (
    <p className={`muted favorites-login-hint${className ? ` ${className}` : ''}`}>
      Favoriler için <Link to="/auth">giriş yap</Link>.
    </p>
  )
}
