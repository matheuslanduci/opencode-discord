import { execute, Slash } from 'sunar'

const slash = new Slash({
	description: 'Say hi to the bot and get a greeting back!',
	name: 'hi'
})

execute(slash, (interaction) => {
	interaction.reply('Hi there! 👋 Nice to meet you!')
})

export { slash }
