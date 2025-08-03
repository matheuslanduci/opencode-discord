import { execute, Slash } from 'sunar'
import { sessionMonitor } from '../services/session-monitor'

const slash = new Slash({
	description: 'Show active opencode sessions being monitored',
	name: 'sessions'
})

execute(slash, async (interaction) => {
	const activeCount = sessionMonitor.getActiveSessionsCount()
	const sessionInfo = sessionMonitor.getSessionInfo()
	const isUsingFallback = sessionMonitor.isUsingFallback()

	if (activeCount === 0) {
		await interaction.reply({
			content: 'No active sessions are being monitored.',
			ephemeral: true
		})
		return
	}

	const monitoringMode = isUsingFallback
		? '🔄 Polling Mode (Fallback)'
		: '⚡ Real-time Event Stream'

	const sessionList = sessionInfo
		.map((session, index) => {
			const lastChecked = session.lastChecked.toLocaleString()
			const completedCount = session.completedMessages.size
			return `${index + 1}. Thread: <#${session.threadId}>\n   Session: \`${session.sessionId}\`\n   Last checked: ${lastChecked}\n   Completed messages: ${completedCount}`
		})
		.join('\n\n')

	await interaction.reply({
		content: `**Active Sessions (${activeCount})** - ${monitoringMode}\n\n${sessionList}`,
		ephemeral: true
	})
})

export { slash }
