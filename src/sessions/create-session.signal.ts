import type { Session } from '@opencode-ai/sdk'
import {
	ActionRowBuilder,
	type AnyThreadChannel,
	type ButtonBuilder,
	PermissionFlagsBits,
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

			if (!message.member?.permissions.has(PermissionFlagsBits.Administrator))
				return

			const opencode = yield* Opencode

			let session: Session
			let threadChannel: AnyThreadChannel

			const isInThread = message.channel.isThread()

			if (!isInThread) {
				session = yield* opencode.createSession()

				threadChannel = yield* Effect.tryPromise({
					catch: () => new DiscordError({ message: 'Failed to start thread' }),
					try: () =>
						message.startThread({
							autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
							name: `Thread with ${message.author.username} (${session.id})`
						})
				})
			} else {
				threadChannel = message.channel as AnyThreadChannel

				const sidTag = threadChannel.name.match(/Thread with .* \((\w+)\)/)?.[1]

				if (!sidTag) {
					return yield* new IncorrectUsageError({
						message:
							'Session ID not found in thread name. Try to create a new session.'
					})
				}

				const sid = sidTag.trim()

				session = yield* opencode.getSession(sid)
			}

			yield* Effect.tryPromise({
				catch: (err) =>
					new DiscordError({ cause: err, message: 'Failed to send reply' }),
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

			yield* opencode.send(session.id, message.content.trim())
		}).pipe(
			Effect.catchTags({
				DiscordError: (error) =>
					Console.trace('Discord error:', error.message, error.cause),
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
