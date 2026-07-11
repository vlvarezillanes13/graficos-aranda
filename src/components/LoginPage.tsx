import { useState } from 'react'
import { login } from '../services/authService'
import './LoginPage.css'

interface LoginPageProps {
  onSuccess: () => void
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await login(username, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <section className="login-card">
        <p className="login-eyebrow">ITSM SONDA</p>
        <h1>Iniciar sesión</h1>
        <p className="login-subtitle">
          Acceso al panel de incidentes y solicitudes
        </p>

        <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            <span>Usuario</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="SNDTEST"
              required
            />
          </label>

          <label>
            <span>Contraseña</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Validando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </div>
  )
}
