import { execute, Slash } from 'sunar'
import { sessionMonitor } from '../services/session-monitor'

const slash = new Slash({
	description: 'Show active opencode sessions being monitored',
	name: 'sessions'
})

execute(slash, async (interaction) => {
	const activeCount = sessionMonitor.getActiveSessionsCount()
	const sessionInfo = sessionMonitor.getSessionInfo()

	if (activeCount === 0) {
		await interaction.reply({
			content: 'No active sessions are being monitored.',
			ephemeral: true
		})
		return
	}

	const sessionList = sessionInfo
		.map((session, index) => {
			const lastChecked = session.lastChecked.toLocaleString()
			return `${index + 1}. Thread: <#${session.threadId}>\n   Session: \`${session.sessionId}\`\n   Last checked: ${lastChecked}\n   Messages: ${session.lastMessageCount}`
		})
		.join('\n\n')

	await interaction.reply({
		content: `**Active Sessions (${activeCount})**\n\n${sessionList}`,
		ephemeral: true
	})
})

export { slash }
