import { Link } from 'react-router-dom'

export function PageBack() {
  return (
    <div className="page-back-row">
      <Link to="/" className="page-back-link">
        Ana sayfa
      </Link>
    </div>
  )
}
