import { Layer, Logger, ManagedRuntime } from 'effect'
import { OpencodeLive } from './opencode'

const appLayer = Layer.mergeAll(Logger.pretty, OpencodeLive)

export const AppRuntime = ManagedRuntime.make(appLayer)
