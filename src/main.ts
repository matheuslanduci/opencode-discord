import { GatewayIntentBits } from 'discord.js'
import { Config, Effect } from 'effect'
import { Client, load } from 'sunar'
import { AppRuntime } from './app-runtime'

const program = Effect.gen(function* () {
	const token = yield* Config.string('DISCORD_BOT_TOKEN')
	const nodeEnv = yield* Config.literal('production', 'development')('NODE_ENV')

	const client = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.MessageContent
		]
	})

	const mainFolder = nodeEnv === 'production' ? 'dist' : 'src'

	yield* Effect.promise(() =>
		load(`${mainFolder}/**/*.{slash,signal,button}.{js,ts}`)
	)

	yield* Effect.promise(() => client.login(token))
})

AppRuntime.runPromise(program)
