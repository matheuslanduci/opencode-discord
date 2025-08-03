import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder
} from 'discord.js'
import { Button, Slash, execute } from 'sunar'

interface Provider {
	id: string
	name: string
	doc: string
	env: string[]
	npm: string
	api?: string
	models: Record<string, any>
}

const PROVIDERS_PER_PAGE = 10

const slash = new Slash({
	description: 'List all available AI model providers with pagination',
	name: 'providers'
})

async function fetchProviders(): Promise<Provider[]> {
	try {
		const response = await fetch('https://models.dev/api.json')
		const data = await response.json()

		return Object.values(data).map((provider: any) => ({
			id: provider.id,
			name: provider.name,
			doc: provider.doc,
			env: provider.env || [],
			npm: provider.npm,
			api: provider.api,
			models: provider.models || {}
		}))
	} catch (error) {
		console.error('Failed to fetch providers:', error)
		return []
	}
}

function createProvidersEmbed(
	providers: Provider[],
	page: number
): EmbedBuilder {
	const startIndex = page * PROVIDERS_PER_PAGE
	const endIndex = startIndex + PROVIDERS_PER_PAGE
	const pageProviders = providers.slice(startIndex, endIndex)
	const totalPages = Math.ceil(providers.length / PROVIDERS_PER_PAGE)

	const embed = new EmbedBuilder()
		.setTitle('🤖 Available AI Model Providers')
		.setDescription(
			`Choose from these providers to access various AI models.\nPage ${page + 1} of ${totalPages}`
		)
		.setColor(0x0099ff)
		.setTimestamp()

	pageProviders.forEach((provider) => {
		const modelCount = Object.keys(provider.models).length
		const envVars = provider.env.length > 0 ? provider.env.join(', ') : 'None'

		embed.addFields({
			inline: true,
			name: `\`${provider.id}\``,
			value: `**${provider.name}**\n📊 Models: ${modelCount}\n🔑 Env: ${envVars}\n📖 [Docs](${provider.doc})`
		})
	})

	embed.setFooter({
		text: `Total providers: ${providers.length} • Use buttons to navigate`
	})

	return embed
}

function createNavigationButtons(
	page: number,
	totalPages: number
): ActionRowBuilder<ButtonBuilder> {
	const row = new ActionRowBuilder<ButtonBuilder>()

	const prevButton = new ButtonBuilder()
		.setCustomId(`providers-prev-${page}`)
		.setLabel('◀ Previous')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(page === 0)

	const nextButton = new ButtonBuilder()
		.setCustomId(`providers-next-${page}`)
		.setLabel('Next ▶')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(page >= totalPages - 1)

	const pageButton = new ButtonBuilder()
		.setCustomId(`providers-page-${page}`)
		.setLabel(`${page + 1}/${totalPages}`)
		.setStyle(ButtonStyle.Primary)
		.setDisabled(true)

	row.addComponents(prevButton, pageButton, nextButton)
	return row
}

execute(slash, async (interaction) => {
	await interaction.deferReply()

	const providers = await fetchProviders()

	if (providers.length === 0) {
		await interaction.editReply({
			content: '❌ Failed to fetch providers. Please try again later.'
		})
		return
	}

	const page = 0
	const totalPages = Math.ceil(providers.length / PROVIDERS_PER_PAGE)
	const embed = createProvidersEmbed(providers, page)
	const buttons = createNavigationButtons(page, totalPages)

	await interaction.editReply({
		embeds: [embed],
		components: [buttons]
	})
})

const prevButton = new Button({
	id: /^providers-prev-(\d+)$/
})

execute(prevButton, async (interaction) => {
	const match = interaction.customId.match(/^providers-prev-(\d+)$/)
	if (!match) return

	const currentPage = parseInt(match[1])
	const newPage = Math.max(0, currentPage - 1)

	await interaction.deferUpdate()

	const providers = await fetchProviders()
	const totalPages = Math.ceil(providers.length / PROVIDERS_PER_PAGE)
	const embed = createProvidersEmbed(providers, newPage)
	const buttons = createNavigationButtons(newPage, totalPages)

	await interaction.editReply({
		embeds: [embed],
		components: [buttons]
	})
})

const nextButton = new Button({
	id: /^providers-next-(\d+)$/
})

execute(nextButton, async (interaction) => {
	const match = interaction.customId.match(/^providers-next-(\d+)$/)
	if (!match) return

	const currentPage = parseInt(match[1])

	await interaction.deferUpdate()

	const providers = await fetchProviders()
	const totalPages = Math.ceil(providers.length / PROVIDERS_PER_PAGE)
	const newPage = Math.min(totalPages - 1, currentPage + 1)

	const embed = createProvidersEmbed(providers, newPage)
	const buttons = createNavigationButtons(newPage, totalPages)

	await interaction.editReply({
		embeds: [embed],
		components: [buttons]
	})
})

export { slash, prevButton, nextButton }
