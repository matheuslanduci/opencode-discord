import type { Session } from '@opencode-ai/sdk'
import { MessageFlags } from 'discord.js'
import { Effect } from 'effect'
import { execute, Slash } from 'sunar'
import { AppRuntime } from '~/app-runtime'
import { DiscordError } from '~/discord'
import { Opencode, type OpencodeError } from '~/opencode'

const slash = new Slash({
	description: 'Get sessions',
	name: 'sessions'
})

execute(slash, async (interaction) =>
	AppRuntime.runPromise(
		Effect.gen(function* () {
			const opencode = yield* Opencode

			const sessions = yield* opencode.getSessions()

			yield* Effect.tryPromise({
				catch: () => new DiscordError({ message: 'Failed to send a reply' }),
				try: () =>
					interaction.reply({
						content: `Sessions: ${sessions.map((session: Session) => session.id).join(', ')}`,
						flags: [MessageFlags.Ephemeral]
					})
			})
		}).pipe(
			Effect.catchTags({
				DiscordError: (error: DiscordError) =>
					Effect.promise(() =>
						interaction.reply({
							content: error.message,
							flags: [MessageFlags.Ephemeral]
						})
					),
				OpencodeError: (error: OpencodeError) =>
					Effect.promise(() =>
						interaction.reply({
							content: error.message,
							flags: [MessageFlags.Ephemeral]
						})
					)
			})
		)
	)
)

export { slash }
