interface ModelProvider {
	id: string
	name: string
	models: Record<string, ModelInfo>
}

interface ModelInfo {
	id: string
	name: string
	attachment?: boolean
	reasoning?: boolean
	temperature?: boolean
	tool_call?: boolean
	knowledge?: string
	release_date?: string
	last_updated?: string
	modalities?: {
		input: string[]
		output: string[]
	}
	open_weights?: boolean
	cost?: {
		input?: number
		output?: number
		cache_read?: number
		cache_write?: number
	}
	limit?: {
		context?: number
		output?: number
	}
}

interface GitHubCopilotModel {
	id: string
	name: string
	description: string
}

class ModelsService {
	private models: GitHubCopilotModel[] = []
	private initialized = false

	async initialize(): Promise<void> {
		if (this.initialized) return

		try {
			console.log('Fetching models from API...')
			const response = await fetch('https://models.dev/api.json')

			if (!response.ok) {
				throw new Error(
					`Failed to fetch models: ${response.status} ${response.statusText}`
				)
			}

			const data: Record<string, ModelProvider> = await response.json()
			this.models = this.transformModels(data)
			this.initialized = true
			console.log(`Successfully loaded ${this.models.length} models from API`)
		} catch (error) {
			console.error('Failed to fetch models from API, using fallback:', error)
			this.loadFallbackModels()
		}
	}

	private transformModels(
		data: Record<string, ModelProvider>
	): GitHubCopilotModel[] {
		const transformedModels: GitHubCopilotModel[] = []

		// Look specifically for GitHub Copilot models
		const githubCopilot = data['github-copilot']
		if (githubCopilot?.models) {
			for (const [modelId, modelInfo] of Object.entries(githubCopilot.models)) {
				transformedModels.push({
					id: modelId,
					name: modelInfo.name,
					description: this.generateDescription(modelInfo)
				})
			}
		}

		// If no GitHub Copilot models found, include some popular models from other providers
		if (transformedModels.length === 0) {
			const popularProviders = ['openai', 'anthropic', 'google', 'mistral']

			for (const providerId of popularProviders) {
				const provider = data[providerId]
				if (provider?.models) {
					const modelEntries = Object.entries(provider.models).slice(0, 3) // Limit to 3 per provider
					for (const [modelId, modelInfo] of modelEntries) {
						transformedModels.push({
							id: modelId,
							name: modelInfo.name,
							description: this.generateDescription(modelInfo)
						})
					}
				}
			}
		}

		return transformedModels.sort((a, b) => a.name.localeCompare(b.name))
	}

	private generateDescription(modelInfo: ModelInfo): string {
		const features: string[] = []

		if (modelInfo.reasoning) features.push('reasoning')
		if (modelInfo.attachment) features.push('image support')
		if (modelInfo.tool_call) features.push('tool calling')

		const baseDescription =
			features.length > 0
				? `Advanced model with ${features.join(', ')}`
				: 'Powerful language model'

		return baseDescription
	}

	private loadFallbackModels(): void {
		// Fallback to the original static models if API fails
		this.models = [
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
		this.initialized = true
		console.log(`Loaded ${this.models.length} fallback models`)
	}

	getModels(): GitHubCopilotModel[] {
		if (!this.initialized) {
			console.warn('Models service not initialized, returning empty array')
			return []
		}
		return this.models
	}

	async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize()
		}
	}
}

export const modelsService = new ModelsService()
export type { GitHubCopilotModel }
