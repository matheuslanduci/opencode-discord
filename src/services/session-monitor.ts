import type {
	Client,
	NewsChannel,
	TextChannel,
	ThreadChannel
} from 'discord.js'
import {
	Config,
	Console,
	Context,
	Data,
	Effect,
	Layer,
	pipe,
	Ref,
	Schedule
} from 'effect'

interface SessionData {
	threadId: string
	sessionId: string
}

interface EventStreamEvent {
	type: string
	properties: {
		sessionID?: string
		message?: {
			id: string
			role: 'user' | 'assistant'
			content: string
		}
	}
}

export class SessionMonitorError extends Data.TaggedError(
	'SessionMonitorError'
)<{
	message: string
	cause?: unknown
}> {}

// Discord Client service tag
export class DiscordClient extends Context.Tag('DiscordClient')<
	DiscordClient,
	Client
>() {}

// SessionMonitor service definition
export class SessionMonitor extends Context.Tag('SessionMonitor')<
	SessionMonitor,
	{
		readonly setDiscordClient: (
			client: Client
		) => Effect.Effect<void, never, never>
		readonly addSession: (
			threadId: string,
			sessionId: string
		) => Effect.Effect<void, never, never>
		readonly removeSession: (
			sessionId: string
		) => Effect.Effect<void, never, never>
		readonly start: () => Effect.Effect<void, SessionMonitorError, never>
		readonly stop: () => Effect.Effect<void, never, never>
		readonly getActiveSessionsCount: () => Effect.Effect<number, never, never>
		readonly getSessionInfo: () => Effect.Effect<SessionData[], never, never>
	}
>() {}

const makeSessionMonitor = Effect.gen(function* () {
	const apiUrl = yield* Config.string('OPENCODE_API_URL')

	// State management with Ref
	const sessionsRef = yield* Ref.make(new Map<string, SessionData>())
	const isRunningRef = yield* Ref.make(false)

	// Store client reference
	let discordClient: Client | null = null

	// Helper function to set the Discord client
	const setDiscordClient = (client: Client) =>
		Effect.sync(() => {
			discordClient = client
		})

	// Helper function to connect to event stream
	const connectToEventStream = (url: string) =>
		Effect.gen(function* () {
			yield* Console.log('Connecting to OpenCode event stream...')

			const response = yield* Effect.tryPromise({
				catch: (error) =>
					new SessionMonitorError({
						cause: error,
						message: 'Failed to connect to event stream'
					}),
				try: () =>
					fetch(url, {
						headers: {
							Accept: 'text/event-stream',
							'Cache-Control': 'no-cache'
						},
						method: 'GET'
					})
			})

			if (!response.ok) {
				return yield* Effect.fail(
					new SessionMonitorError({
						message: `Failed to connect to event stream: ${response.status} ${response.statusText}`
					})
				)
			}

			if (!response.body) {
				return yield* Effect.fail(
					new SessionMonitorError({
						message: 'No response body from event stream'
					})
				)
			}

			yield* Console.log('Connected to OpenCode event stream')

			// Process the stream
			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ''

			return yield* Effect.acquireUseRelease(
				Effect.succeed(reader),
				(reader) =>
					Effect.gen(function* () {
						while (true) {
							const result = yield* Effect.tryPromise({
								catch: (error) =>
									new SessionMonitorError({
										cause: error,
										message: 'Error reading from stream'
									}),
								try: () => reader.read()
							})

							if (result.done) {
								yield* Console.log('Event stream ended')
								break
							}

							buffer += decoder.decode(result.value, { stream: true })
							const lines = buffer.split('\n')
							buffer = lines.pop() || ''

							for (const line of lines) {
								yield* processEventStreamLine(line)
							}
						}
					}),
				(reader) => Effect.sync(() => reader.releaseLock())
			)
		})

	// Process individual event stream lines
	const processEventStreamLine = (line: string) =>
		Effect.gen(function* () {
			if (!line.trim()) return

			if (line.startsWith('data: ')) {
				const eventData = yield* Effect.try({
					catch: (error) =>
						new SessionMonitorError({
							cause: error,
							message: 'Failed to parse event data'
						}),
					try: () => JSON.parse(line.substring(6)) as EventStreamEvent
				})

				yield* handleEvent(eventData)
			}
		}).pipe(
			Effect.catchAll((error) =>
				Console.error(`Error processing event line: ${error}`)
			)
		)

	// Handle specific events
	const handleEvent = (event: EventStreamEvent) =>
		Effect.gen(function* () {
			const { type, properties } = event

			// We only care about session.idle events
			if (type !== 'session.idle') return

			const sessionId = properties?.sessionID
			if (!sessionId) return

			const sessions = yield* Ref.get(sessionsRef)
			const sessionData = sessions.get(sessionId)

			if (!sessionData) {
				// Session not being monitored
				return
			}

			yield* Console.log(
				`Session ${sessionId} became idle, sending final message`
			)

			// Get the final message content and send it to Discord
			yield* sendFinalMessage(sessionData, properties.message)
		}).pipe(
			Effect.catchAll((error) =>
				Console.error(`Error handling event: ${error}`)
			)
		)

	// Send the final message to Discord when session becomes idle
	const sendFinalMessage = (
		sessionData: SessionData,
		message?: { id: string; role: string; content: string }
	) =>
		Effect.gen(function* () {
			if (!message || message.role !== 'assistant') return

			const client = discordClient
			if (!client) {
				return yield* Effect.fail(
					new SessionMonitorError({
						message: 'Discord client not available'
					})
				)
			}

			const channel = yield* Effect.tryPromise({
				catch: (error) =>
					new SessionMonitorError({
						cause: error,
						message: 'Failed to fetch Discord channel'
					}),
				try: () => client.channels.fetch(sessionData.threadId)
			})

			if (!channel?.isTextBased()) {
				return yield* Effect.fail(
					new SessionMonitorError({
						message: 'Channel is not text-based'
					})
				)
			}

			// Split message if it's too long (Discord limit is 2000 characters)
			const messages = splitMessage(message.content, 2000)

			for (const messageContent of messages) {
				yield* Effect.tryPromise({
					catch: (error) =>
						new SessionMonitorError({
							cause: error,
							message: 'Failed to send message to Discord'
						}),
					try: () =>
						(channel as ThreadChannel | TextChannel | NewsChannel).send(
							messageContent
						)
				})
			}
		}).pipe(
			Effect.catchAll((error) =>
				Console.error(`Error sending final message: ${error}`)
			)
		)

	// Helper function to split long messages
	const splitMessage = (text: string, maxLength: number): string[] => {
		if (text.length <= maxLength) return [text]

		const messages: string[] = []
		let currentMessage = ''

		const lines = text.split('\n')

		for (const line of lines) {
			if (currentMessage.length + line.length + 1 > maxLength) {
				if (currentMessage) {
					messages.push(currentMessage.trim())
					currentMessage = ''
				}

				// If single line is too long, split it
				if (line.length > maxLength) {
					let remaining = line
					while (remaining.length > maxLength) {
						messages.push(remaining.substring(0, maxLength))
						remaining = remaining.substring(maxLength)
					}
					if (remaining) {
						currentMessage = remaining
					}
				} else {
					currentMessage = line
				}
			} else {
				currentMessage += (currentMessage ? '\n' : '') + line
			}
		}

		if (currentMessage) {
			messages.push(currentMessage.trim())
		}

		return messages
	}

	// Start the event stream monitoring
	const startEventStream = Effect.gen(function* () {
		const eventUrl = `${apiUrl}/event`

		yield* pipe(
			connectToEventStream(eventUrl),
			Effect.retry(
				Schedule.exponential('1 seconds').pipe(
					Schedule.compose(Schedule.recurs(5))
				)
			),
			Effect.catchAll((error) =>
				Console.error(`Failed to start event stream after retries: ${error}`)
			),
			Effect.fork
		)
	})

	return {
		addSession: (threadId: string, sessionId: string) =>
			Effect.gen(function* () {
				const sessions = yield* Ref.get(sessionsRef)
				const newSessions = new Map(sessions)
				newSessions.set(sessionId, { sessionId, threadId })
				yield* Ref.set(sessionsRef, newSessions)
				yield* Console.log(
					`Added session ${sessionId} for thread ${threadId} to monitor`
				)
			}),

		getActiveSessionsCount: () =>
			Effect.gen(function* () {
				const sessions = yield* Ref.get(sessionsRef)
				return sessions.size
			}),

		getSessionInfo: () =>
			Effect.gen(function* () {
				const sessions = yield* Ref.get(sessionsRef)
				return Array.from(sessions.values())
			}),

		removeSession: (sessionId: string) =>
			Effect.gen(function* () {
				const sessions = yield* Ref.get(sessionsRef)
				const newSessions = new Map(sessions)
				newSessions.delete(sessionId)
				yield* Ref.set(sessionsRef, newSessions)
				yield* Console.log(`Removed session ${sessionId} from monitor`)
			}),
		setDiscordClient,

		start: () =>
			Effect.gen(function* () {
				const isRunning = yield* Ref.get(isRunningRef)
				if (isRunning) {
					yield* Console.log('Session monitor already running')
					return
				}

				yield* Ref.set(isRunningRef, true)
				yield* startEventStream
				yield* Console.log('Session monitor started')
			}),

		stop: () =>
			Effect.gen(function* () {
				yield* Ref.set(isRunningRef, false)
				yield* Console.log('Session monitor stopped')
			})
	}
}) // Layer that provides the SessionMonitor service
export const SessionMonitorLive = Layer.effect(
	SessionMonitor,
	makeSessionMonitor
)

// Legacy exports for compatibility (will be updated in implementation files)
export const sessionMonitor = {
	addSession: () => {
		throw new Error('Use Effect-based SessionMonitor service instead')
	},
	getActiveSessionsCount: () => {
		throw new Error('Use Effect-based SessionMonitor service instead')
	},
	getSessionInfo: () => {
		throw new Error('Use Effect-based SessionMonitor service instead')
	},
	isUsingFallback: () => {
		throw new Error('Use Effect-based SessionMonitor service instead')
	},
	removeSession: () => {
		throw new Error('Use Effect-based SessionMonitor service instead')
	}
}

export type { SessionData }
