import { ThreadAutoArchiveDuration } from 'discord.js'
import { Data, Effect } from 'effect'
import { execute, Signal } from 'sunar'
import { AppRuntime } from '~/app-runtime'
import { DiscordError } from '~/discord'
import { Opencode } from '~/opencode'

const signal = new Signal('messageCreate')

class AuthorIsBotError extends Data.TaggedError('AuthorIsBotError') {}

execute(signal, async (message) =>
	AppRuntime.runPromise(
		Effect.gen(function* () {
			if (!message.mentions.has(message.client.user)) return

			if (message.author.bot) return yield* new AuthorIsBotError()

			const opencode = yield* Opencode

			if (!message.thread) {
				yield* Effect.tryPromise({
					catch: () => new DiscordError({ message: 'Failed to start thread' }),
					try: () =>
						message.startThread({
							autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
							name: `Thread with ${message.author.username}`
						})
				})
			}
		}).pipe(
			Effect.catchTags({
				AuthorIsBotError: () =>
					Effect.promise(() =>
						message.reply({
							content: 'I cannot respond to requests from bots.'
						})
					),
				DiscordError: (error: DiscordError) =>
					Console.error('Discord error:', error.message)
			})
		)
	)
)

export { signal }
