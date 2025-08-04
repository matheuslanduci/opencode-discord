import { createOpencodeClient, type Session } from '@opencode-ai/sdk'
import { Config, Context, Data, Effect, Layer } from 'effect'

// export const opencode = createOpencodeClient({
// 	baseUrl: env.OPENCODE_API_URL
// })
export class Opencode extends Context.Tag('Opencode')<
	Opencode,
	{
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
