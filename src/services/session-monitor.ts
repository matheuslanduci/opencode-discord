import type { Client, ThreadChannel } from 'discord.js'
import { env } from '../env'
import { opencode } from '../opencode'

interface SessionData {
	threadId: string
	sessionId: string
	lastMessageCount: number
	lastChecked: Date
	completedMessages: Set<string> // Track completed message IDs
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

interface EventStreamEvent {
	type: string
	properties: {
		info?: {
			id: string
			role: 'user' | 'assistant'
			sessionID: string
			time?: {
				created?: number
				completed?: number
			}
		}
		part?: {
			id: string
			messageID: string
			sessionID: string
			type: string
			text?: string
			time?: {
				start?: number
				end?: number
			}
		}
		sessionID?: string
		messageID?: string
	}
}

class SessionMonitor {
	private sessions = new Map<string, SessionData>()
	private client: Client | null = null
	private eventSource: EventSource | null = null
	private reconnectAttempts = 0
	private readonly MAX_RECONNECT_ATTEMPTS = 5
	private readonly RECONNECT_DELAY_MS = 5000
	private fallbackPollInterval: NodeJS.Timeout | null = null
	private readonly FALLBACK_POLL_INTERVAL_MS = 30000 // Fallback to polling every 30 seconds
	private usingFallback = false

	initialize(client: Client): void {
		this.client = client
		console.log('Session monitor initialized')
	}

	start(): void {
		if (this.eventSource || this.fallbackPollInterval) {
			console.log('Session monitor already running')
			return
		}

		this.startEventStream()
		console.log('Session monitor started')
	}

	addSession(threadId: string, sessionId: string): void {
		this.sessions.set(sessionId, {
			completedMessages: new Set(),
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

	private async startEventStream(): Promise<void> {
		try {
			// Connect to OpenCode's event stream endpoint
			const baseUrl = env.OPENCODE_API_URL
			const eventUrl = `${baseUrl}/event`

			await this.connectToEventStream(eventUrl)
		} catch (error) {
			console.error('Failed to start event stream:', error)
			this.scheduleReconnect()
		}
	}

	private async connectToEventStream(url: string): Promise<void> {
		try {
			console.log('Connecting to OpenCode event stream...')

			const response = await fetch(url, {
				headers: {
					Accept: 'text/event-stream',
					'Cache-Control': 'no-cache'
				},
				method: 'GET'
			})

			if (!response.ok) {
				throw new Error(
					`Failed to connect to event stream: ${response.status} ${response.statusText}`
				)
			}

			if (!response.body) {
				throw new Error('No response body from event stream')
			}

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ''

			console.log('Connected to OpenCode event stream')
			this.reconnectAttempts = 0
			this.usingFallback = false

			// Stop fallback polling if it's running
			if (this.fallbackPollInterval) {
				clearInterval(this.fallbackPollInterval)
				this.fallbackPollInterval = null
			}

			try {
				while (true) {
					const { done, value } = await reader.read()

					if (done) {
						console.log('Event stream ended')
						break
					}

					buffer += decoder.decode(value, { stream: true })
					const lines = buffer.split('\n')
					buffer = lines.pop() || '' // Keep the last incomplete line in the buffer

					for (const line of lines) {
						await this.processEventStreamLine(line)
					}
				}
			} finally {
				reader.releaseLock()
			}
		} catch (error) {
			console.error('Event stream connection error:', error)
			this.scheduleReconnect()
		}
	}

	private async processEventStreamLine(line: string): Promise<void> {
		if (!line.trim()) return

		// Parse Server-Sent Events format
		if (line.startsWith('data: ')) {
			try {
				const eventData = JSON.parse(line.substring(6))
				await this.handleEvent(eventData)
			} catch (error) {
				console.error('Failed to parse event data:', error)
			}
		}
	}

	private async handleEvent(event: EventStreamEvent): Promise<void> {
		const { type, properties } = event

		// Only handle events for sessions we're monitoring
		const sessionId =
			properties?.info?.sessionID ||
			properties?.part?.sessionID ||
			properties?.sessionID
		if (!sessionId || !this.sessions.has(sessionId)) {
			return
		}

		switch (type) {
			case 'message.updated':
				await this.handleMessageUpdated(sessionId, properties)
				break
			case 'message.part.updated':
				// We don't handle part updates since we wait for message completion
				break
			default:
				// Ignore other event types
				break
		}
	}

	private async handleMessageUpdated(
		sessionId: string,
		properties: EventStreamEvent['properties']
	): Promise<void> {
		const messageInfo = properties.info
		if (!messageInfo || messageInfo.role !== 'assistant') return

		// Check if message is completed (has time.completed)
		if (
			messageInfo.time?.completed &&
			!this.sessions.get(sessionId)?.completedMessages.has(messageInfo.id)
		) {
			console.log(
				`Assistant message ${messageInfo.id} completed for session ${sessionId}`
			)

			// Mark message as completed
			const sessionData = this.sessions.get(sessionId)
			if (sessionData) {
				sessionData.completedMessages.add(messageInfo.id)
				// Send the completed message to Discord
				await this.sendCompletedMessage(sessionData, messageInfo.id)
			}
		}
	}

	private async sendCompletedMessage(
		sessionData: SessionData,
		messageId: string
	): Promise<void> {
		if (!this.client) return

		try {
			// Fetch the complete message from OpenCode API
			const messageResult = await opencode.session.message({
				path: { id: sessionData.sessionId, messageID: messageId }
			})

			if (messageResult.error) {
				console.error(
					`Error fetching completed message ${messageId}:`,
					messageResult.error
				)
				return
			}

			const message = messageResult.data
			if (!message || message.info.role !== 'assistant') return

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

			// Extract and send the complete text content
			const textContent = this.extractTextFromParts(message.parts)

			if (textContent?.trim()) {
				// Split long messages to avoid Discord's 2000 character limit
				const messageChunks = this.splitMessage(textContent, 2000)

				for (const chunk of messageChunks) {
					await thread.send(chunk)
				}
			}
		} catch (error) {
			console.error(`Error sending completed message ${messageId}:`, error)
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
			console.error(
				'Max reconnection attempts reached, falling back to polling'
			)
			this.startFallbackPolling()
			return
		}

		this.reconnectAttempts++
		console.log(
			`Scheduling reconnect attempt ${this.reconnectAttempts} in ${this.RECONNECT_DELAY_MS}ms`
		)

		setTimeout(() => {
			this.startEventStream()
		}, this.RECONNECT_DELAY_MS)
	}

	private startFallbackPolling(): void {
		if (this.fallbackPollInterval) {
			return
		}

		console.log('Starting fallback polling mode')
		this.usingFallback = true

		this.fallbackPollInterval = setInterval(async () => {
			await this.checkAllSessionsForUpdates()
		}, this.FALLBACK_POLL_INTERVAL_MS)

		// Do an immediate check
		this.checkAllSessionsForUpdates()
	}

	private async checkAllSessionsForUpdates(): Promise<void> {
		if (!this.client || this.sessions.size === 0) return

		const sessionsToCheck = Array.from(this.sessions.values())

		for (const sessionData of sessionsToCheck) {
			try {
				await this.checkSessionForCompletedMessages(sessionData)
			} catch (error) {
				console.error(`Error checking session ${sessionData.sessionId}:`, error)
			}
		}
	}

	private async checkSessionForCompletedMessages(
		sessionData: SessionData
	): Promise<void> {
		try {
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

			const messages = messagesResult.data || []

			// Only process completed assistant messages that we haven't sent yet
			for (const message of messages) {
				if (
					message.info.role === 'assistant' &&
					message.info.time?.completed &&
					!sessionData.completedMessages.has(message.info.id)
				) {
					sessionData.completedMessages.add(message.info.id)
					await this.sendCompletedMessage(sessionData, message.info.id)
				}
			}

			sessionData.lastChecked = new Date()
		} catch (error) {
			console.error(
				`Error in checkSessionForCompletedMessages for ${sessionData.sessionId}:`,
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
		if (this.eventSource) {
			this.eventSource.close()
			this.eventSource = null
		}

		if (this.fallbackPollInterval) {
			clearInterval(this.fallbackPollInterval)
			this.fallbackPollInterval = null
		}

		console.log('Session monitor stopped')
	}

	getActiveSessionsCount(): number {
		return this.sessions.size
	}

	getSessionInfo(): SessionData[] {
		return Array.from(this.sessions.values())
	}

	isUsingFallback(): boolean {
		return this.usingFallback
	}
}

export const sessionMonitor = new SessionMonitor()
export type { SessionData }
