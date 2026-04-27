import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { IconHeart, IconSearch } from './NavIcons'
import { SiteFooter } from './SiteFooter'

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link to="/" className="brand">
          PricePlay
        </Link>
        <nav className="nav-actions" aria-label="Site">
          <Link
            to="/"
            state={{ focusSearch: true }}
            className="nav-icon-link"
            title="Ara"
            aria-label="Ana sayfada ara"
          >
            <IconSearch />
          </Link>
          <Link
            to={user ? '/favorites' : '/auth'}
            className="nav-icon-link"
            title="Favoriler"
            aria-label={user ? 'Favoriler' : 'Giriş yap — favoriler'}
          >
            <IconHeart />
          </Link>
          {user ? (
            <>
              <Link to="/profile" className="nav-text-link">
                Profil
              </Link>
              <button type="button" className="nav-text-btn" onClick={() => logout()}>
                Çıkış
              </button>
            </>
          ) : (
            <Link to="/auth" className="nav-text-link nav-text-accent">
              Giriş
            </Link>
          )}
        </nav>
      </header>
      <Outlet />
      <SiteFooter />
    </div>
  )
}
