import { execute, Slash } from 'sunar'
import { getUserModel } from './model'
import { GITHUB_COPILOT_MODELS } from './models'

const slash = new Slash({
	description: 'Show your currently selected model',
	name: 'current-model'
})

execute(slash, (interaction) => {
	const currentModelId = getUserModel(interaction.user.id)
	const model = GITHUB_COPILOT_MODELS.find((m) => m.id === currentModelId)

	if (!model) {
		return interaction.reply({
			content:
				'❌ Could not find your current model. Use `/model` to select one.',
			ephemeral: true
		})
	}

	interaction.reply({
		content: `🤖 **Current Model**: ${model.name} (\`${model.id}\`)\n${model.description}`,
		ephemeral: true
	})
})

export { slash }
