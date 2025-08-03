import { execute, Slash } from 'sunar'

const slash = new Slash({
	description: "Ping the bot to check if it's online.",
	name: 'ping'
})

execute(slash, (interaction) => {
	interaction.reply({ content: 'Pong!', ephemeral: true })
})

export { slash }
