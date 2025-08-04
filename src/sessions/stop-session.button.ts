import {
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	PermissionFlagsBits
} from 'discord.js'
import { Console, Effect } from 'effect'
import { Button, execute } from 'sunar'
import { AppRuntime } from '~/app-runtime'
import { DiscordError, IncorrectUsageError } from '~/discord'
import { Opencode } from '~/opencode'

const button = new Button({ id: /^stop-session#\w+$/ })

export function createStopSessionButton(sessionId: string) {
	return new ButtonBuilder()
		.setCustomId(`stop-session#${sessionId}`)
		.setLabel('Stop Session')
		.setEmoji('🛑')
		.setStyle(ButtonStyle.Secondary)
}

execute(button, (interaction) =>
	AppRuntime.runPromise(
		Effect.gen(function* () {
			if (
				!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
			)
				return

			const sessionId = interaction.customId.split('#')[1]

			if (!sessionId) {
				return new IncorrectUsageError({
					message: 'Invalid session ID in button interaction'
				})
			}

			const opencode = yield* Opencode

			yield* opencode.abort(sessionId)

			yield* Effect.tryPromise({
				catch: (err) =>
					new DiscordError({ cause: err, message: 'Failed to send reply' }),
				try: () =>
					interaction.reply({
						content: `Session ${sessionId} has been stopped.`,
						flags: [MessageFlags.Ephemeral]
					})
			})
		}).pipe(
			Effect.catchTags({
				DiscordError: (error) =>
					Console.trace('Discord error:', error.message, error.cause),
				SessionNotFoundError: (error) =>
					Effect.promise(() =>
						interaction.reply({
							content: `Session with ID \`${error.sessionId}\` not found. Please create a new session.`,
							flags: [MessageFlags.Ephemeral]
						})
					)
			}),
			Effect.catchAll((error) =>
				Effect.promise(() =>
					interaction.reply({
						content: error.message,
						flags: [MessageFlags.Ephemeral]
					})
				)
			)
		)
	)
)

export { button }
