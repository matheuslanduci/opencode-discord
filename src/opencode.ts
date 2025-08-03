import { createOpencodeClient } from '@opencode-ai/sdk'
import { env } from './env'

export const opencode = createOpencodeClient({
	baseUrl: env.OPENCODE_API_URL
})
