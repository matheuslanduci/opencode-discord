import { Data } from 'effect'

export class DiscordError extends Data.TaggedError('DiscordError')<{
	message: string
}> {}

export class IncorrectUsageError extends Data.TaggedError(
	'IncorrectUsageError'
)<{
	message: string
}> {}
