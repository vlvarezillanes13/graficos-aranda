import type { VercelRequest, VercelResponse } from '@vercel/node'
import { routeVercelApi } from '../lib/vercelApiRouter.js'

export const config = {
  maxDuration: 60,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await routeVercelApi(req, res)
}
