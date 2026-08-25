function getSessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.VITE_AUTH_SESSION_SECRET ||
    'dev-only-change-in-production'
  )
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false

  let result = 0
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return result === 0
}

async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  )

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function extractBearerToken(authorization) {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
}

export async function verifySessionToken(token) {
  if (!token) return null

  const [payloadB64, signature] = String(token).split('.')
  if (!payloadB64 || !signature) return null

  const expectedSignature = await hmacSha256Hex(getSessionSecret(), payloadB64)
  if (!timingSafeEqual(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(atob(payloadB64))
    if (!payload.u || !payload.exp || payload.exp < Date.now()) {
      return null
    }

    return {
      username: payload.u,
      isAdmin: payload.admin === true,
    }
  } catch {
    return null
  }
}
