import { Data } from 'effect'

export class DiscordError extends Data.TaggedError('DiscordError')<{
	message: string
}> {}
