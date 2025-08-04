import { MessageFlags } from 'discord.js'
import { Effect } from 'effect'
import { execute, Slash } from 'sunar'
import { AppRuntime } from '~/app-runtime'
import { SessionMonitor } from '~/services/session-monitor'

const slash = new Slash({
	description: 'Show active opencode sessions being monitored',
	name: 'sessions'
})

execute(slash, async (interaction) =>
	AppRuntime.runPromise(
		Effect.gen(function* () {
			const sessionMonitor = yield* SessionMonitor

			const activeCount = yield* sessionMonitor.getActiveSessionsCount()
			const sessionInfo = yield* sessionMonitor.getSessionInfo()

			if (activeCount === 0) {
				yield* Effect.tryPromise({
					catch: () => new Error('Failed to send reply'),
					try: () =>
						interaction.reply({
							content: 'No active sessions are being monitored.',
							flags: [MessageFlags.Ephemeral]
						})
				})
				return
			}

			const sessionList = sessionInfo
				.map((session, index) => {
					return `${index + 1}. **Session ID:** \`${session.sessionId}\`\n   **Thread ID:** <#${session.threadId}>`
				})
				.join('\n\n')

			yield* Effect.tryPromise({
				catch: () => new Error('Failed to send reply'),
				try: () =>
					interaction.reply({
						content: `**Active Sessions (${activeCount})**\n\n${sessionList}`,
						flags: [MessageFlags.Ephemeral]
					})
			})
		})
	)
)

export { slash }
