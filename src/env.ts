import { z } from 'zod'

const envSchema = z.object({
	DISCORD_BOT_TOKEN: z.string(),
	OPENCODE_API_URL: z.string().optional().default('http://127.0.0.1:4096')
})

export const env = envSchema.parse(process.env)
