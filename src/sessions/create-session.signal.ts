import type { Session } from '@opencode-ai/sdk'
import {
	ActionRowBuilder,
	type AnyThreadChannel,
	type ButtonBuilder,
	ThreadAutoArchiveDuration
} from 'discord.js'
import { Console, Effect } from 'effect'
import { execute, Signal } from 'sunar'
import { AppRuntime } from '~/app-runtime'
import { DiscordError, IncorrectUsageError } from '~/discord'
import { Opencode } from '~/opencode'
import { createStopSessionButton } from './stop-session.button'

const signal = new Signal('messageCreate')

execute(signal, async (message) =>
	AppRuntime.runPromise(
		Effect.gen(function* () {
			if (!message.mentions.has(message.client.user)) return

			if (message.author.bot) return

			const opencode = yield* Opencode

			let session: Session
			let threadChannel: AnyThreadChannel

			if (!message.thread) {
				session = yield* opencode.createSession()

				threadChannel = yield* Effect.tryPromise({
					catch: () => new DiscordError({ message: 'Failed to start thread' }),
					try: () =>
						message.startThread({
							autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
							name: `Thread with ${message.author.username}`
						})
				})

				yield* Effect.tryPromise({
					catch: () =>
						new DiscordError({ message: 'Failed to add tag to thread' }),
					try: () =>
						threadChannel.setAppliedTags([
							...(threadChannel.appliedTags ?? []),
							`sid:${session.id}`
						])
				})
			} else {
				threadChannel = message.thread
				const sidTag = message.thread.appliedTags.find((tag) =>
					tag.startsWith('sid:')
				)

				const [, sid] = sidTag?.split(':') ?? []

				if (!sid) {
					return yield* new IncorrectUsageError({
						message:
							'Session ID not found in thread tags. Try to create a new session.'
					})
				}

				session = yield* opencode.getSession(sid)
			}

			yield* opencode.send(session.id, message.content.trim())

			yield* Effect.tryPromise({
				catch: () => new DiscordError({ message: 'Failed to send reply' }),
				try: () =>
					threadChannel.send({
						components: [
							new ActionRowBuilder<ButtonBuilder>().addComponents(
								createStopSessionButton(session.id)
							)
						],
						content: `Process started!`
					})
			})
		}).pipe(
			Effect.catchTags({
				DiscordError: (error) => Console.error('Discord error:', error.message),
				SessionNotFoundError: (error) =>
					Effect.promise(() =>
						message.reply({
							content: `Session with ID \`${error.sessionId}\` not found. Please create a new session.`
						})
					)
			}),
			Effect.catchAll((error) =>
				Effect.promise(() =>
					message.reply({
						content: error.message
					})
				)
			)
		)
	)
)

export { signal }
