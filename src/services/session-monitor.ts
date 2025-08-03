import type { Client, ThreadChannel } from 'discord.js'
import { env } from '../env'
import { opencode } from '../opencode'

interface SessionData {
	threadId: string
	sessionId: string
	lastMessageCount: number
	lastChecked: Date
	completedMessages: Set<string> // Track completed message IDs
	partialMessages: Map<string, string> // Track partial message content by message ID
}

interface OpenCodeMessage {
	info: {
		id: string
		role: 'user' | 'assistant'
		time?: {
			created?: number
			completed?: number
		}
	}
	parts: Array<{
		type: string
		text?: string
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
			partialMessages: new Map(),
			sessionId,
			threadId
		})
		console.log(
			`[SESSION] Added session ${sessionId} for thread ${threadId} to monitor`
		)
		console.log(`[SESSION] Total active sessions: ${this.sessions.size}`)
	}

	removeSession(sessionId: string): void {
		this.sessions.delete(sessionId)
		console.log(`[SESSION] Removed session ${sessionId} from monitor`)
		console.log(`[SESSION] Total active sessions: ${this.sessions.size}`)
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
				// Reduce log noise - only log important events
				if (eventData.type !== 'storage.write') {
					console.log(`[DEBUG] Processing event: ${eventData.type}`)
				}
				await this.handleEvent(eventData)
			} catch (error) {
				console.error('Failed to parse event data:', error)
				console.error('Raw line:', line)
			}
		}
	}

	private async handleEvent(event: EventStreamEvent): Promise<void> {
		const { type, properties } = event

		// Skip storage.write events - they're just noise
		if (type === 'storage.write') return

		// Only handle events for sessions we're monitoring
		const sessionId =
			properties?.info?.sessionID ||
			properties?.part?.sessionID ||
			properties?.sessionID

		console.log(
			`[DEBUG] Received event: ${type}, sessionId: ${sessionId}, monitoring: ${this.sessions.has(sessionId || '')}`
		)

		if (!sessionId || !this.sessions.has(sessionId)) {
			return
		}

		switch (type) {
			case 'message.updated':
				await this.handleMessageUpdated(sessionId, properties)
				break
			case 'message.part.updated':
				await this.handleMessagePartUpdated(sessionId, properties)
				break
			default:
				console.log(`[DEBUG] Ignoring event type: ${type}`)
				break
		}
	}

	private async handleMessageUpdated(
		sessionId: string,
		properties: EventStreamEvent['properties']
	): Promise<void> {
		const messageInfo = properties.info
		if (!messageInfo || messageInfo.role !== 'assistant') return

		console.log(
			`[DEBUG] Message updated - messageID: ${messageInfo.id}, completed: ${!!messageInfo.time?.completed}`
		)

		// Check if message is completed (has time.completed)
		if (
			messageInfo.time?.completed &&
			!this.sessions.get(sessionId)?.completedMessages.has(messageInfo.id)
		) {
			console.log(
				`Assistant message ${messageInfo.id} completed for session ${sessionId}`
			)

			// Mark message as completed and send any remaining partial content
			const sessionData = this.sessions.get(sessionId)
			if (sessionData) {
				sessionData.completedMessages.add(messageInfo.id)

				// Send any remaining partial content first
				const remainingContent = sessionData.partialMessages.get(messageInfo.id)
				console.log(
					`[DEBUG] Remaining content length: ${remainingContent?.length || 0}`
				)

				if (remainingContent?.trim()) {
					console.log(`[DEBUG] Sending final remaining content`)
					await this.sendPartialMessage(sessionData, remainingContent)
				}

				sessionData.partialMessages.delete(messageInfo.id) // Clean up partial content
				console.log(`[DEBUG] Message ${messageInfo.id} processing completed`)
			}
		}
	}

	private async handleMessagePartUpdated(
		sessionId: string,
		properties: EventStreamEvent['properties']
	): Promise<void> {
		const partInfo = properties.part
		if (!partInfo || partInfo.type !== 'text' || !partInfo.text) return

		console.log(
			`[DEBUG] Part updated - messageID: ${partInfo.messageID}, text length: ${partInfo.text.length}`
		)

		const sessionData = this.sessions.get(sessionId)
		if (!sessionData) return

		// Skip if this message is already completed
		if (sessionData.completedMessages.has(partInfo.messageID)) return

		// Get current partial content for this message
		const currentContent =
			sessionData.partialMessages.get(partInfo.messageID) || ''
		const newContent = currentContent + partInfo.text

		// Update the partial content
		sessionData.partialMessages.set(partInfo.messageID, newContent)

		console.log(
			`[DEBUG] Updated partial content for message ${partInfo.messageID}, total length: ${newContent.length}`
		)

		// Check if the new content contains newlines that we haven't sent yet
		const lines = newContent.split('\n')
		if (lines.length > 1) {
			// We have complete lines to send (all but the last incomplete line)
			const completeLinesContent = lines.slice(0, -1).join('\n')
			const remainingContent = lines[lines.length - 1]

			console.log(`[DEBUG] Found ${lines.length - 1} complete lines to send`)

			// Update partial content to only keep the remaining incomplete line
			sessionData.partialMessages.set(partInfo.messageID, remainingContent)

			// Send the complete lines to Discord
			if (completeLinesContent.trim()) {
				console.log(
					`[DEBUG] Sending partial message with ${completeLinesContent.length} characters`
				)
				await this.sendPartialMessage(sessionData, completeLinesContent)
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

			const message = messageResult.data as OpenCodeMessage
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

	private async sendPartialMessage(
		sessionData: SessionData,
		content: string
	): Promise<void> {
		if (!this.client) {
			console.log('[DEBUG] No client available for sending partial message')
			return
		}

		try {
			console.log(
				`[DEBUG] Attempting to send partial message to thread ${sessionData.threadId}`
			)

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

			console.log(`[DEBUG] Found thread: ${thread.name}`)

			if (content.trim()) {
				// Split long messages to avoid Discord's 2000 character limit
				const messageChunks = this.splitMessage(content, 2000)

				console.log(`[DEBUG] Sending ${messageChunks.length} message chunks`)

				for (const chunk of messageChunks) {
					console.log(`[DEBUG] Sending chunk with ${chunk.length} characters`)
					await thread.send(chunk)
					console.log(`[DEBUG] Chunk sent successfully`)
				}
			}
		} catch (error) {
			console.error(`Error sending partial message:`, error)
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
					// For fallback polling, we send the complete message since we don't have streaming parts
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
