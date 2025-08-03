import type { Client, ThreadChannel } from 'discord.js'
import { opencode } from '../opencode'

interface SessionData {
	threadId: string
	sessionId: string
	lastMessageCount: number
	lastChecked: Date
}

interface OpenCodeMessage {
	info: {
		id: string
		role: 'user' | 'assistant'
		system?: string[]
		mode?: string
		path?: Record<string, string>
		cost?: number
		tokens?: {
			input?: number
			output?: number
			reasoning?: number
			cache?: {
				read?: number
				write?: number
			}
		}
		modelID?: string
		providerID?: string
		time?: {
			created?: number
			completed?: number
		}
		sessionID?: string
	}
	parts: Array<{
		id: string
		messageID: string
		sessionID: string
		type: string
		text?: string
		time?: {
			start?: number
			end?: number
		}
		tokens?: {
			input?: number
			output?: number
			reasoning?: number
			cache?: {
				read?: number
				write?: number
			}
		}
		cost?: number
	}>
}

class SessionMonitor {
	private sessions = new Map<string, SessionData>()
	private client: Client | null = null
	private pollInterval: NodeJS.Timeout | null = null
	private readonly POLL_INTERVAL_MS = 10000 // Poll every 10 seconds

	initialize(client: Client): void {
		this.client = client
		console.log('Session monitor initialized')
	}

	start(): void {
		if (this.pollInterval) {
			console.log('Session monitor already running')
			return
		}

		this.startPolling()
		console.log('Session monitor started')
	}

	addSession(threadId: string, sessionId: string): void {
		this.sessions.set(sessionId, {
			lastChecked: new Date(),
			lastMessageCount: 0,
			sessionId,
			threadId
		})
		console.log(`Added session ${sessionId} for thread ${threadId} to monitor`)
	}

	removeSession(sessionId: string): void {
		this.sessions.delete(sessionId)
		console.log(`Removed session ${sessionId} from monitor`)
	}

	private startPolling(): void {
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
		}

		this.pollInterval = setInterval(async () => {
			await this.checkAllSessions()
		}, this.POLL_INTERVAL_MS)
	}

	private async checkAllSessions(): Promise<void> {
		if (!this.client || this.sessions.size === 0) return

		const sessionsToCheck = Array.from(this.sessions.values())

		for (const sessionData of sessionsToCheck) {
			try {
				await this.checkSession(sessionData)
			} catch (error) {
				console.error(`Error checking session ${sessionData.sessionId}:`, error)
			}
		}
	}

	private async checkSession(sessionData: SessionData): Promise<void> {
		try {
			// Get messages from the OpenCode session
			const messagesResult = await opencode.session.messages({
				path: { id: sessionData.sessionId }
			})

			if (messagesResult.error) {
				console.error(
					`Error fetching messages for session ${sessionData.sessionId}:`,
					messagesResult.error
				)
				return
			}

			// The messages API returns an array of messages directly
			const messages = messagesResult.data || []

			// Check if there are new messages
			if (messages.length > sessionData.lastMessageCount) {
				const newMessages = messages.slice(sessionData.lastMessageCount)
				await this.handleNewMessages(sessionData, newMessages)

				// Update the session data
				sessionData.lastMessageCount = messages.length
				sessionData.lastChecked = new Date()
			}
		} catch (error) {
			console.error(
				`Error in checkSession for ${sessionData.sessionId}:`,
				error
			)
		}
	}

	private async handleNewMessages(
		sessionData: SessionData,
		newMessages: OpenCodeMessage[]
	): Promise<void> {
		if (!this.client) return

		try {
			// Find the thread
			const thread = (await this.client.channels.fetch(
				sessionData.threadId
			)) as ThreadChannel

			if (!thread) {
				console.warn(
					`Thread ${sessionData.threadId} not found, removing session ${sessionData.sessionId}`
				)
				this.removeSession(sessionData.sessionId)
				return
			}

			// Process each new message
			for (const message of newMessages) {
				// Only process assistant messages (not user messages)
				if (message.info.role === 'assistant' && message.parts) {
					const textContent = this.extractTextFromParts(message.parts)

					if (textContent?.trim()) {
						// Split long messages to avoid Discord's 2000 character limit
						const messageChunks = this.splitMessage(textContent, 2000)

						for (const chunk of messageChunks) {
							await thread.send(chunk)
						}
					}
				}
			}
		} catch (error) {
			console.error(
				`Error handling new messages for session ${sessionData.sessionId}:`,
				error
			)
		}
	}

	private extractTextFromParts(
		parts: Array<{ type: string; text?: string }>
	): string {
		return parts
			.filter((part) => part.type === 'text' && part.text)
			.map((part) => part.text || '')
			.join('\n')
			.trim()
	}

	private splitMessage(text: string, maxLength: number): string[] {
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
					const chunks = line.match(
						new RegExp(`.{1,${maxLength - 1}}`, 'g')
					) || [line]
					messages.push(...chunks)
				}
			}
		}

		if (currentMessage) {
			messages.push(currentMessage)
		}

		return messages
	}

	stop(): void {
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
			this.pollInterval = null
		}
		console.log('Session monitor stopped')
	}

	getActiveSessionsCount(): number {
		return this.sessions.size
	}

	getSessionInfo(): SessionData[] {
		return Array.from(this.sessions.values())
	}
}

export const sessionMonitor = new SessionMonitor()
export type { SessionData }
