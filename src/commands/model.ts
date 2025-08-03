import { ApplicationCommandOptionType } from 'discord.js'
import { Autocomplete, execute, Slash } from 'sunar'
import { GITHUB_COPILOT_MODELS } from './models'

// In-memory storage for selected models per user
const userModels = new Map<string, string>()

const slash = new Slash({
	description: 'Select a GitHub Copilot model for your sessions',
	name: 'model',
	options: [
		{
			autocomplete: true,
			description: 'The model to use for your sessions',
			name: 'model',
			required: true,
			type: ApplicationCommandOptionType.String
		}
	]
})

execute(slash, (interaction) => {
	const selectedModel = interaction.options.getString('model', true)

	// Find the model in our list
	const model = GITHUB_COPILOT_MODELS.find((m) => m.id === selectedModel)

	if (!model) {
		return interaction.reply({
			content:
				'❌ Invalid model selected. Use `/models` to see available options.',
			ephemeral: true
		})
	}

	// Store the user's selected model
	userModels.set(interaction.user.id, selectedModel)

	interaction.reply({
		content: `✅ Model updated to **${model.name}** (\`${model.id}\`)\n${model.description}`,
		ephemeral: true
	})
})

const autocomplete = new Autocomplete({
	commandName: 'model',
	name: 'model'
})

execute(autocomplete, (interaction, option) => {
	const query = option.value.toLowerCase()

	// Filter models based on the user's input
	const filteredModels = GITHUB_COPILOT_MODELS.filter(
		(model) =>
			model.id.toLowerCase().includes(query) ||
			model.name.toLowerCase().includes(query)
	).slice(0, 25) // Discord limits to 25 autocomplete options

	// Format for Discord autocomplete
	const choices = filteredModels.map((model) => ({
		name: `${model.name} (${model.id})`,
		value: model.id
	}))

	interaction.respond(choices)
})

// Helper function to get user's selected model
export function getUserModel(userId: string): string {
	return userModels.get(userId) || 'claude-sonnet-4' // Default to claude-sonnet-4
}

export { slash, autocomplete }
