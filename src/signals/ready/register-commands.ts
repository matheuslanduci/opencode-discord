import { execute, Signal } from 'sunar'
import { registerCommands } from 'sunar/registry'

const signal = new Signal('ready', { once: true })

execute(signal, async (client) => {
	await registerCommands(client.application)

	console.log(`${client.user.tag} logged!`)
})

export { signal }
