import { EmbedBuilder } from 'discord.js'
import { execute, Slash } from 'sunar'
import { modelsService } from '../services/models'

const slash = new Slash({
	description: 'List all available GitHub Copilot models',
	name: 'models'
})

execute(slash, async (interaction) => {
	// Ensure models are loaded
	await modelsService.ensureInitialized()
	const models = modelsService.getModels()

	const embed = new EmbedBuilder()
		.setTitle('🤖 Available GitHub Copilot Models')
		.setDescription('Choose from these models using `/model <name>`')
		.setColor(0x0099ff)
		.setTimestamp()

	// Add models to embed fields
	models.forEach((model) => {
		embed.addFields({
			inline: true,
			name: `\`${model.id}\``,
			value: `**${model.name}**\n${model.description}`
		})
	})

	embed.setFooter({
		text: 'Use /model <model-id> to select a model'
	})

	interaction.reply({ embeds: [embed] })
})

export { slash }
