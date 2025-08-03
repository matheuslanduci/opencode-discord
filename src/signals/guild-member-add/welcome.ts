import { execute, Signal } from 'sunar'

const signal = new Signal('guildMemberAdd')

execute(signal, (member) => {
	console.log(`${member.user.tag} joined the guild!`)
})

export { signal }
