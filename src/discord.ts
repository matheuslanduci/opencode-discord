import { Data } from 'effect'

export class DiscordError extends Data.TaggedError('DiscordError')<{
	message: string
	cause?: unknown
}> {}

export class IncorrectUsageError extends Data.TaggedError(
	'IncorrectUsageError'
)<{
	message: string
}> {}
