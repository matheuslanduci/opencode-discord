import { Client, load } from 'sunar'
import { env } from './env'
import { modelsService } from './services/models'
import { sessionMonitor } from './services/session-monitor'

const components = [
	'commands',
	'signals',
	'autocompletes',
	'buttons',
	'modals',
	'context-menus',
	'groups',
	'protectors',
	'select-menus'
]

async function main() {
	const client = new Client({
		intents: ['Guilds', 'GuildMessages', 'MessageContent']
	})

	// Initialize models service
	await modelsService.initialize()

	const mainFolder = process.env.NODE_ENV === 'production' ? 'dist' : 'src'

	await load(`${mainFolder}/{${components.join(',')}}/**/*.{js,ts}`)

	// Initialize session monitor after client login
	await client.login(env.DISCORD_BOT_TOKEN)

	// Initialize and start session monitor
	sessionMonitor.initialize(client)
	sessionMonitor.start()

	return client
}

main().catch(console.error)
