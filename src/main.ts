import { Client, load } from 'sunar'
import { env } from './env'

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
		intents: []
	})

	const mainFolder = process.env.NODE_ENV === 'production' ? 'dist' : 'src'

	await load(`${mainFolder}/{${components.join(',')}}/**/*.{js,ts}`)

	return client.login(env.DISCORD_BOT_TOKEN)
}

main().catch(console.error)
