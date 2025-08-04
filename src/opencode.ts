import { createOpencodeClient, type Session } from '@opencode-ai/sdk'
import { Config, Context, Data, Effect, Layer } from 'effect'

export class Opencode extends Context.Tag('Opencode')<
	Opencode,
	{
		readonly createSession: () => Effect.Effect<Session, OpencodeError>
		readonly getSessions: () => Effect.Effect<Session[], OpencodeError>
		readonly getSession: (
			sessionId: string
		) => Effect.Effect<Session, OpencodeError | SessionNotFoundError>
		readonly send: (
			sessionId: string,
			content: string
		) => Effect.Effect<void, OpencodeError | SessionNotFoundError>
		readonly abort: (
			sessionId: string
		) => Effect.Effect<void, OpencodeError | SessionNotFoundError>
	}
>() {}

export class OpencodeError extends Data.TaggedError('OpencodeError')<{
	message: string
}> {}

export class SessionNotFoundError extends Data.TaggedError(
	'SessionNotFoundError'
)<{
	sessionId: string
}> {}

export const OpencodeLive = Layer.effect(
	Opencode,
	Effect.gen(function* () {
		const url = yield* Config.string('OPENCODE_API_URL')

		const opencode = createOpencodeClient({
			baseUrl: url
		})

		const getSessions = (): Effect.Effect<Session[], OpencodeError> =>
			Effect.tryPromise({
				catch: () => new OpencodeError({ message: 'Failed to fetch sessions' }),
				try: async () => {
					const { data } = await opencode.session.list({
						throwOnError: true
					})

					return data
				}
			})
		const getSession = (
			sessionId: string
		): Effect.Effect<Session, OpencodeError | SessionNotFoundError> =>
			getSessions().pipe(
				Effect.map((sessions) => sessions.find((s) => s.id === sessionId)),
				Effect.flatMap((session) => {
					if (!session) {
						return Effect.fail(new SessionNotFoundError({ sessionId }))
					}

					return Effect.succeed(session)
				})
			)
		const createSession = (): Effect.Effect<Session, OpencodeError> =>
			Effect.tryPromise({
				catch: () => new OpencodeError({ message: 'Failed to create session' }),
				try: async () => {
					const { data } = await opencode.session.create({
						throwOnError: true
					})

					return data
				}
			})
		const send = (
			sessionId: string,
			content: string
		): Effect.Effect<void, OpencodeError | SessionNotFoundError> =>
			getSession(sessionId).pipe(
				Effect.flatMap((session) =>
					Effect.tryPromise({
						catch: () =>
							new OpencodeError({ message: 'Failed to send message' }),
						try: async () => {
							await opencode.session.chat({
								body: {
									modelID: 'gpt-4.1',
									parts: [
										{
											text: content,
											type: 'text'
										}
									],
									providerID: 'github-copilot'
								},
								path: {
									id: session.id
								}
							})
						}
					})
				)
			)
		const abort = (
			sessionId: string
		): Effect.Effect<void, OpencodeError | SessionNotFoundError> =>
			getSession(sessionId).pipe(
				Effect.flatMap((session) =>
					Effect.tryPromise({
						catch: () =>
							new OpencodeError({ message: 'Failed to abort session' }),
						try: async () => {
							await opencode.session.abort({
								path: {
									id: session.id
								}
							})
						}
					})
				)
			)

		return Opencode.of({
			abort,
			createSession,
			getSession,
			getSessions,
			send
		})
	})
)
