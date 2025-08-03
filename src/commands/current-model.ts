import { MessageFlags } from 'discord.js'
import { execute, Slash } from 'sunar'
import { modelsService } from '../services/models'
import { getUserModel } from './model'

const slash = new Slash({
	description: 'Show your currently selected model',
	name: 'current-model'
})

execute(slash, async (interaction) => {
	const currentModelId = getUserModel(interaction.user.id)

	// Ensure models are loaded
	await modelsService.ensureInitialized()
	const models = modelsService.getModels()
	const model = models.find((m) => m.id === currentModelId)

	if (!model) {
		return interaction.reply({
			content:
				'❌ Could not find your current model. Use `/model` to select one.',
			flags: MessageFlags.Ephemeral
		})
	}

	interaction.reply({
		content: `🤖 **Current Model**: ${model.name} (\`${model.id}\`)\n${model.description}`,
		flags: MessageFlags.Ephemeral
	})
})

export { slash }
