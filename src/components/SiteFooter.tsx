import { Link } from 'react-router-dom'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div>
          <div className="site-footer-brand">PricePlay</div>
        </div>
        <div className="site-footer-links">
          <Link to="/">Ana sayfa</Link>
          <Link to="/browse/popular">Popüler</Link>
          <Link to="/browse/discounted">İndirim</Link>
          <Link to="/auth">Hesap</Link>
        </div>
        <div className="site-footer-meta">
          <p className="site-footer-copy">© {new Date().getFullYear()} PricePlay</p>
        </div>
      </div>
    </footer>
  )
}
