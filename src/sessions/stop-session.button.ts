import { ButtonBuilder, ButtonStyle } from 'discord.js'
import { Button, execute } from 'sunar'

const button = new Button({ id: /^stop-session-\w+$/ })

export function createStopSessionButton(sessionId: string) {
	return new ButtonBuilder()
		.setCustomId(`stop-session-${sessionId}`)
		.setLabel('Stop Session')
		.setEmoji('❌')
		.setStyle(ButtonStyle.Danger)
}

execute(button, (interaction) => {
	// handle execution
})

export { button }
