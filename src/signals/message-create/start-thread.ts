import { ChannelType, ThreadAutoArchiveDuration } from 'discord.js'
import { execute, Signal } from 'sunar'
import { getUserModel } from '../../commands/model'
import { opencode } from '../../opencode'
import { sessionMonitor } from '../../services/session-monitor'

const signal = new Signal('messageCreate')

// Store session IDs for threads
const threadSessions = new Map<string, string>()

execute(signal, async (message) => {
	if (message.author.bot) return

	if (message.mentions.has(message.client.user)) {
		// Only allow thread creation in GuildText or GuildAnnouncement channels
		if (
			!message.channel ||
			![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
				message.channel.type
			)
		) {
			// Optionally, you can reply or log here
			return
		}

		let thread = message.thread

		if (!message.hasThread) {
			thread = await message.startThread({
				autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
				name: `Thread with ${message.author.username}`
			})
		}

		try {
			// Check if we already have a session for this thread
			let sessionId = threadSessions.get(thread.id)

			if (!sessionId) {
				// Create a new opencode session
				const sessionResult = await opencode.session.create()

				if (sessionResult.error) {
					console.error('Session creation error:', sessionResult.error)
					await thread.send('Sorry, I encountered an error creating a session.')
					return
				}

				sessionId = sessionResult.data?.id
				if (!sessionId) {
					console.error('No session ID returned from opencode')
					await thread.send('Sorry, I could not create a session.')
					return
				}

				threadSessions.set(thread.id, sessionId)

				// Add session to monitor for continuous listening
				sessionMonitor.addSession(thread.id, sessionId)

				console.log(
					`[THREAD] Created opencode session ${sessionId} for thread ${thread.id}`
				)
				console.log(`[THREAD] Thread name: ${thread.name}, Thread type: ${thread.type}`)
			} else {
				console.log(`[THREAD] Using existing session ${sessionId} for thread ${thread.id}`)
			}

			// Clean user message by removing bot mentions
			const userMessage = message.content.replace(/<@!?\d+>/g, '').trim()

			// Get the user's selected model
			const selectedModel = getUserModel(message.author.id)

			// Send the user's message to the opencode session
			const chatResult = await opencode.session.chat({
				body: {
					modelID: selectedModel,
					parts: [
						{
							text: userMessage,
							type: 'text'
						}
					],
					providerID: 'github-copilot'
				},
				path: {
					id: sessionId
				}
			})

			// Reply in the thread with the opencode response
			if (chatResult.error) {
				console.error('Chat error:', chatResult.error)
				await thread.send(
					'Sorry, I encountered an error processing your message.'
				)
			} else if (chatResult.data) {
				const assistantResponse = extractTextFromResponse(chatResult.data)

				if (assistantResponse) {
					// Split long messages to avoid Discord's 2000 character limit
					const messages = splitMessage(assistantResponse, 2000)
					for (const messageChunk of messages) {
						await thread.send(messageChunk)
					}
				} else {
					await thread.send(
						"I processed your message, but I don't have a text response."
					)
				}
			}
		} catch (error) {
			console.error('Error interacting with opencode:', error)
			await thread.send(
				'Sorry, I encountered an error while processing your request.'
			)
		}
	}
})

function extractTextFromResponse(response: Record<string, unknown>): string {
	// Extract text from the parts array
	if (response.parts && Array.isArray(response.parts)) {
		const textParts = response.parts
			.filter(
				(part: unknown) =>
					typeof part === 'object' &&
					part !== null &&
					'type' in part &&
					part.type === 'text' &&
					'text' in part &&
					typeof part.text === 'string'
			)
			.map((part: { text: string }) => part.text)
			.filter((text: string) => text && text.trim().length > 0)

		return textParts.join('\n')
	}

	return ''
}

function splitMessage(text: string, maxLength: number): string[] {
	if (text.length <= maxLength) return [text]

	const messages: string[] = []
	let currentMessage = ''

	const lines = text.split('\n')

	for (const line of lines) {
		if (currentMessage.length + line.length + 1 <= maxLength) {
			currentMessage += (currentMessage ? '\n' : '') + line
		} else {
			if (currentMessage) {
				messages.push(currentMessage)
				currentMessage = line
			} else {
				// Line is too long, split it
				const chunks = line.match(new RegExp(`.{1,${maxLength - 1}}`, 'g')) || [
					line
				]
				messages.push(...chunks)
			}
		}
	}

	if (currentMessage) {
		messages.push(currentMessage)
	}

	return messages
}

export { signal }
