import { useCallback, useEffect, useState } from 'react'
import {
  fetchItsmCredentialsStatus,
  saveItsmCredentials,
} from '../services/itsmCredentialsService'

interface ItsmTokenModalProps {
  open: boolean
  message?: string | null
  onSaved: () => void | Promise<void>
}

export function ItsmTokenModal({
  open,
  message,
  onSaved,
}: ItsmTokenModalProps) {
  const [token, setToken] = useState('')
  const [cookie, setCookie] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    void fetchItsmCredentialsStatus()
      .then((status) => {
        if (status.configured) return
      })
      .catch(() => undefined)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, saving])

  const handleSubmit = useCallback(async () => {
    const trimmedToken = token.trim()
    if (!trimmedToken) {
      setError('Ingresa el token ITSM (Bearer eyJ...)')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await saveItsmCredentials(trimmedToken, cookie.trim() || undefined)
      setToken('')
      setCookie('')
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el token')
    } finally {
      setSaving(false)
    }
  }, [cookie, onSaved, token])

  if (!open) return null

  return (
    <div className="itsm-token-overlay" role="presentation">
      <div
        className="itsm-token-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="itsm-token-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="itsm-token-header">
          <h2 id="itsm-token-title">Token ITSM</h2>
          <p>
            Pega el JWT de sesión de Postman (GET create/token). Se guarda en el
            servidor para todos los usuarios conectados.
          </p>
          {message ? <p className="itsm-token-message">{message}</p> : null}
        </header>

        <div className="itsm-token-body">
          <label className="itsm-token-field">
            <span>Token (x-authorization)</span>
            <textarea
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Bearer eyJ..."
              rows={4}
              spellCheck={false}
            />
          </label>

          <label className="itsm-token-field">
            <span>Cookie AuthCookieASMS (opcional)</span>
            <input
              type="text"
              value={cookie}
              onChange={(event) => setCookie(event.target.value)}
              placeholder="AuthCookieASMS=..."
              spellCheck={false}
            />
          </label>

          {error ? <p className="itsm-token-error">{error}</p> : null}
        </div>

        <footer className="itsm-token-actions">
          <button
            type="button"
            className="itsm-token-submit"
            onClick={() => void handleSubmit()}
            disabled={saving}
          >
            {saving ? 'Guardando…' : 'Guardar y continuar'}
          </button>
        </footer>
      </div>
    </div>
  )
}
