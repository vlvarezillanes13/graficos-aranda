import { extractBearerToken, verifySessionToken } from '../../lib/auth.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const token = extractBearerToken(request.headers.get('Authorization'))
  const session = await verifySessionToken(token)

  if (!session) {
    return Response.json({ valid: false }, { status: 401 })
  }

  return Response.json({
    valid: true,
    username: session.username,
    isAdmin: session.isAdmin,
  })
}
