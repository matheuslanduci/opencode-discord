import { createOpencodeClient, type Session } from '@opencode-ai/sdk'
import { Config, Context, Data, Effect, Layer } from 'effect'

export class Opencode extends Context.Tag('Opencode')<
	Opencode,
	{
		readonly createSession: () => Effect.Effect<Session, OpencodeError>
		readonly getSessions: () => Effect.Effect<Session[], OpencodeError>
	}
>() {}

export class OpencodeError extends Data.TaggedError('OpencodeError')<{
	message: string
}> {}

export const OpencodeLive = Layer.effect(
	Opencode,
	Effect.gen(function* () {
		const url = yield* Config.string('OPENCODE_API_URL')

		const opencode = createOpencodeClient({
			baseUrl: url
		})

		return Opencode.of({
			createSession: () =>
				Effect.tryPromise({
					catch: () =>
						new OpencodeError({ message: 'Failed to create session' }),
					try: async () => {
						const { data } = await opencode.session.create({
							throwOnError: true
						})

						return data
					}
				}),
			getSessions: () =>
				Effect.tryPromise({
					catch: () =>
						new OpencodeError({ message: 'Failed to fetch sessions' }),
					try: async () => {
						const { data } = await opencode.session.list({
							throwOnError: true
						})

						return data
					}
				})
		})
	})
)
