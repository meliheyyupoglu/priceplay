import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageBack } from '../components/PageBack'

export function ProfilePage() {
  const { user, loading, updateProfile, refreshProfile } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName)
    setLastName(user.lastName)
    setNickname(user.nickname)
    setPhone(user.phone ?? '')
  }, [user])

  if (loading) return <p className="muted">Yükleniyor…</p>
  if (!user) return <Navigate to="/auth" replace />

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    setSaving(true)
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ''),
      })
      await refreshProfile()
      setMsg('Profil güncellendi.')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Hata')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageBack />
      <h1 className="section-title">Profil</h1>
      <p className="muted">
        {user.email} · <span className="pill">ID: {user.id.slice(0, 8)}…</span>
      </p>
      <div className="card card-pad" style={{ marginTop: 20, maxWidth: 440 }}>
        {msg && <p style={{ color: 'var(--mint)' }}>{msg}</p>}
        {err && <p className="error">{err}</p>}
        <form className="form-stack" onSubmit={onSave}>
          <div className="form-field">
            <label htmlFor="prof-fn">Ad</label>
            <input id="prof-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="prof-ln">Soyad</label>
            <input id="prof-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="prof-nick">Kullanıcı adı</label>
            <input id="prof-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="prof-phone">Telefon</label>
            <input id="prof-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <p className="muted" style={{ margin: 0 }}>
            E-posta sunucuda sabit; değiştirmek için backend genişletmesi gerekir.
          </p>
          <button type="submit" className="btn btn-primary btn-wide" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </form>
      </div>
    </>
  )
}
