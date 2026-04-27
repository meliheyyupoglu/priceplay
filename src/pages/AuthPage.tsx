import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageBack } from '../components/PageBack'

function validPassword(p: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(p)
}

function validPhone(p: string) {
  const digits = p.replace(/\D/g, '')
  return /^0\d{10}$/.test(digits)
}

export function AuthPage() {
  const nav = useNavigate()
  const { login, register } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      await login(identifier.trim(), password)
      nav('/')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!validPassword(regPassword)) {
      setErr('Şifre en az 6 karakter; büyük, küçük harf ve rakam içermeli.')
      return
    }
    const phoneDigits = phone.replace(/\D/g, '')
    if (!validPhone(phoneDigits)) {
      setErr('Telefon 0 ile başlayan 11 haneli Türkiye formatında olmalı (0XXXXXXXXXX).')
      return
    }
    setLoading(true)
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim(),
        email: email.trim(),
        phone: phoneDigits,
        password: regPassword,
      })
      nav('/')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Kayıt başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageBack />
      <div className="auth-card card">
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={`auth-tab ${tab === 'login' ? 'auth-tab-active' : ''}`}
            onClick={() => setTab('login')}
          >
            Giriş
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            className={`auth-tab ${tab === 'register' ? 'auth-tab-active' : ''}`}
            onClick={() => setTab('register')}
          >
            Kayıt
          </button>
        </div>

        <div className="auth-card-body card-pad">
          {err && <p className="error">{err}</p>}

          {tab === 'login' ? (
            <form className="form-stack" onSubmit={onLogin}>
              <div className="form-field">
                <label htmlFor="auth-identifier">E-posta veya kullanıcı adı</label>
                <input
                  id="auth-identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="form-field">
                <label htmlFor="auth-password">Şifre</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-wide" disabled={loading}>
                {loading ? '…' : 'Giriş yap'}
              </button>
            </form>
          ) : (
            <form className="form-stack" onSubmit={onRegister}>
              <div className="form-field">
                <label htmlFor="reg-first">Ad</label>
                <input id="reg-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="form-field">
                <label htmlFor="reg-last">Soyad</label>
                <input id="reg-last" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <div className="form-field">
                <label htmlFor="reg-nick">Kullanıcı adı</label>
                <input id="reg-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
              </div>
              <div className="form-field">
                <label htmlFor="reg-email">E-posta</label>
                <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-field">
                <label htmlFor="reg-phone">Telefon</label>
                <input
                  id="reg-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="0XXXXXXXXXX"
                  autoComplete="tel"
                />
              </div>
              <div className="form-field">
                <label htmlFor="reg-pass">Şifre</label>
                <input
                  id="reg-pass"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <span className="form-hint">En az 6 karakter; büyük, küçük harf ve rakam.</span>
              </div>
              <button type="submit" className="btn btn-primary btn-wide" disabled={loading}>
                {loading ? '…' : 'Kayıt ol'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
