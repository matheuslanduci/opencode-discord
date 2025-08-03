import { EmbedBuilder } from 'discord.js'
import { execute, Slash } from 'sunar'

const slash = new Slash({
	description: 'List all available GitHub Copilot models',
	name: 'models'
})

// GitHub Copilot models from the API
const GITHUB_COPILOT_MODELS = [
	{
		description: 'Advanced reasoning model with image support',
		id: 'claude-sonnet-4',
		name: 'Claude Sonnet 4'
	},
	{
		description: 'Reasoning model for complex tasks',
		id: 'o4-mini',
		name: 'o4-mini (Preview)'
	},
	{
		description: 'Fast and capable model with image support',
		id: 'claude-3.5-sonnet',
		name: 'Claude Sonnet 3.5'
	},
	{
		description: "Google's latest multimodal model",
		id: 'gemini-2.0-flash-001',
		name: 'Gemini 2.0 Flash'
	},
	{
		description: 'Advanced reasoning with thought process',
		id: 'claude-3.7-sonnet-thought',
		name: 'Claude Sonnet 3.7 Thinking'
	},
	{
		description: 'Latest Claude model with improved capabilities',
		id: 'claude-3.7-sonnet',
		name: 'Claude Sonnet 3.7'
	},
	{
		description: "Google's most capable model",
		id: 'gemini-2.5-pro',
		name: 'Gemini 2.5 Pro (Preview)'
	},
	{
		description: 'Most powerful Claude model',
		id: 'claude-opus-4',
		name: 'Claude Opus 4'
	},
	{
		description: 'Latest OpenAI reasoning model',
		id: 'o3-mini',
		name: 'o3-mini'
	},
	{
		description: "OpenAI's multimodal flagship model",
		id: 'gpt-4o',
		name: 'GPT-4o'
	},
	{
		description: "OpenAI's most advanced reasoning model",
		id: 'o3',
		name: 'o3 (Preview)'
	}
]

execute(slash, (interaction) => {
	const embed = new EmbedBuilder()
		.setTitle('🤖 Available GitHub Copilot Models')
		.setDescription('Choose from these models using `/model <name>`')
		.setColor(0x0099ff)
		.setTimestamp()

	// Add models to embed fields
	GITHUB_COPILOT_MODELS.forEach((model) => {
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

export { slash, GITHUB_COPILOT_MODELS }
