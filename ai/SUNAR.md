# Introduction

Sunar is a framework built on top of Discord.js.

## Getting Started

To get started with Sunar, you'll need to set up the entry file:

```ts src/main.ts
import { Client, dirname, load } from 'sunar'
import { env } from './env'

const components = ['commands', 'signals', 'autocompletes', 'buttons']

async function main() {
  // Start the Sunar client
	const client = new Client({
		intents: []
	})

  // Load the required components 
	await load(
		`${dirname(import.meta.url)}/{${components.join(',')}}/**/*.{js.ts}`
	)

  // Login with the token provided in .env file
	await client.login(env.DISCORD_BOT_TOKEN)
}

main().catch(console.error)
```

Then we need our first and core signal to handle any interaction.

```ts src/signals/interaction-create/handle-interaction.ts
import { execute, Signal } from 'sunar'
import { handleInteraction } from 'sunar/handlers'

const signal = new Signal('interactionCreate')

execute(signal, async (interaction) => {
	await handleInteraction(interaction)
})

export { signal }
```

### Registering commands

You can register different commands if you wish. There's three different types
of commands:

#### Dynamic

Dynamic registration allows you to programmatically register commands either 
globally or per server, providing flexibility in managing your bot's commands 
based on runtime conditions or configurations.

```ts src/signals/ready/register-commands.ts
import { execute, Signal } from 'sunar'
import { registerCommands } from 'sunar/registry'

const signal = new Signal('ready', { once: true })

execute(signal, async (client) => {
	await registerCommands(client.application)

	console.log(`${client.user.tag} logged!`)
})

export { signal }
```

To specify the servers on which a command should be registered you must pass it 
to them using the [config](#config) mutator.

```ts src/commands/ping.ts
import { config, execute, Slash } from 'sunar'

const slash = new Slash({
	description: "Ping the bot to check if it's online.",
	name: 'ping'
})

config(slash, {
	guildIds: ['YOUR_GUILD_ID']
})

execute(slash, (interaction) => {
	interaction.reply('Pong!')
})

export { slash }
```

#### Global

Global registration allows commands to be registered universally across all 
servers where the bot is present, simplifying deployment and ensuring 
consistency in command availability across Discord communities.

```ts src/signals/ready/register-commands.ts
import { execute, Signal } from 'sunar'
import { registerGlobalCommands } from 'sunar/registry'

const signal = new Signal('ready', { once: true })

execute(signal, async (client) => {
	await registerGlobalCommands(client.application)

	console.log(`${client.user.tag} logged!`)
})

export { signal }
```

#### Guild-Specific

Guilds registration involves registering all commands specifically for a list of
servers passed directly through a function call, ensuring commands are tailored 
and accessible only to designated servers.

```ts src/signals/ready/register-commands.ts
import { execute, Signal } from 'sunar'
import { registerGuildCommands } from 'sunar/registry'

const signal = new Signal('ready', { once: true })

execute(signal, async (client) => {
	await registerGuildCommands(client.application)

	console.log(`${client.user.tag} logged!`)
})

export { signal }
```

It is recommended to use this method only in development environments as it
allows you to test commands without affecting all servers your bot is in.

## Components

In Sunar, we have different components (helpers) to handle interactions.

### Autocomplete

Autocomplete commands enhance the user experience by providing suggestions while
the user is typing. They are particularly useful for commands with multiple 
options or extensive inputs.

```ts src/autocompletes/example.ts
import { Autocomplete, execute } from 'sunar'

const autocomplete = new Autocomplete({
	name: 'example'
})

execute(autocomplete, (interaction, option) => {
	// handle execution
})

export { autocomplete }
```

#### Implementation

```ts src/autocompletes/fruit.ts
import { ApplicationCommandOptionType } from 'discord.js'
import { Autocomplete, execute, Slash } from 'sunar'

const slash = new Slash({
	description: 'Eat a fruit',
	name: 'eat',
	options: [
		{
			autocomplete: true,
			description: 'Select the fruit',
			name: 'fruit',
			required: true,
			type: ApplicationCommandOptionType.String
		}
	]
})

execute(slash, (interaction) => {
	const fruit = interaction.options.getString('fruit', true)
	interaction.reply({ content: `You ate the **${fruit}**.` })
})

const autocomplete = new Autocomplete({
	commandName: 'eat', // optional
	name: 'fruit'
})

execute(autocomplete, (interaction, option) => {
	const data = [
		{ name: 'Apple', value: 'apple' },
		{ name: 'Kiwi', value: 'kiwi' },
		{ name: 'Watermelon', value: 'watermelon' },
		{ name: 'Banana', value: 'banana' },
		{ name: 'Strawberry', value: 'strawberry' }
	]

	const results = data.filter((e) =>
		e.name.toLowerCase().includes(option.value.toLowerCase())
	)

	interaction.respond(results)
})

export { slash, autocomplete }
```

#### Reference

- name: string | RegExp
- commandName: string | RegExp

### Button

Buttons are interactive elements users can click to trigger specific actions.
They are ideal for creating interactive messages, such as confirmation prompts
or menu navigation.

```ts src/buttons/confirm-leave.ts
import { Button, execute } from 'sunar'

const button = new Button({
	id: 'example'
})

execute(button, (interaction) => {
	// handle execution
})

export { button }
```

#### Implementation

```ts src/commands/leave.ts
import { Button, Slash, execute } from 'sunar'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionFlagsBits
} from 'discord.js'

const slash = new Slash({
	name: 'leave',
	description: 'Make the bot leave the server',
	dmPermission: false,
	defaultMemberPermissions: [PermissionFlagsBits.Administrator]
})

execute(slash, (interaction) => {
	const button = new ButtonBuilder()
		.setCustomId('confirmLeave')
		.setLabel('Leave')
		.setStyle(ButtonStyle.Danger)

	const row = new ActionRowBuilder().setComponents(button)

	interaction.reply({
		content: 'Are you certain about my leaving the server?',
		components: [row]
	})
})

const button = new Button({ id: 'confirmLeave' })

execute(button, async (interaction) => {
	await interaction.reply({
		content: 'Leaving...',
		ephemeral: true
	})

	interaction.guild.leave()
})

export { slash, button }
```

#### Reference

- id: string | RegExp

### ContextMenu

Context menu commands are available directly in the right-click context menu for
users or messages. These commands are convenient for quick actions without 
needing to type a command.

```ts src/commands/show-avatar.ts
import { ContextMenu, execute } from 'sunar'
import { ApplicationCommandType } from 'discord.js'

const contextMenu = new ContextMenu({
	name: 'example',
	type: ApplicationCommandType.User
})

execute(contextMenu, (interaction) => {
	// handle execution
})

export { contextMenu }
```

#### Implementation

```ts src/commands/show-avatar.ts
import { ContextMenu, execute } from 'sunar'
import { ApplicationCommandType } from 'discord.js'

const contextMenu = new ContextMenu({
	name: 'Show avatar',
	type: ApplicationCommandType.User
})

execute(contextMenu, (interaction) => {
	const avatarURL = interaction.targetUser.displayAvatarURL({
		size: 1024,
		forceStatic: false
	})

	interaction.reply({
		content: `Avatar of user **${interaction.user.username}**`,
		files: [avatarURL]
	})
})

export { contextMenu }
```

#### Reference

- name: string
- type: ApplicationCommandType
- guildIds?: string[]
- cooldown?: CooldownResolvable

### Group

The Group class handles slash commands with subcommands, allowing for structured
and efficient management of hierarchical commands under a single root.

```ts src/groups/example.ts
import { Group, execute } from 'sunar'

const group = new Group('root', 'parent', 'sub')

execute(group, (interaction) => {
	// handle execution
})

export { group }
```

#### Implementation

To create a group command, you need to first create the root command and then 
the subcommand.

**Create the root command:**

```ts src/commands/example/root.ts
import { Slash } from 'sunar'
import { ApplicationCommandOptionType } from 'discord.js'

const slash = new Slash({
	name: 'example',
	description: 'this is a example',
	options: [
		{
			name: 'parent',
			description: 'this is the parent',
			type: ApplicationCommandOptionType.SubcommandGroup,
			options: [
				{
					name: 'sub',
					description: 'this is the sub',
					type: ApplicationCommandOptionType.Subcommand
				}
			]
		}
	]
})

export { slash }
```

**Create the sub command:**

```ts src/commands/example/parent/sub.ts
import { Group, execute } from 'sunar'

const group = new Group('example', 'parent', 'sub')

execute(group, (interaction) => {
	// handle execution
})

export { group }
```

#### Reference

- cooldown?: CooldownResolvable

### Modal

Modals are popup forms that can collect detailed user input. They are 
particularly useful for complex interactions that require multiple fields or 
steps.

```ts src/modals/feedback.ts
import { Modal, execute } from 'sunar'

const modal = new Modal({ id: 'example' })

execute(modal, (interaction) => {
	// handle execution
})

export { modal }
```

#### Implementation

```ts src/commands/feedback.ts
import { Modal, Slash, execute } from 'sunar'
import {
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle
} from 'discord.js'

const slash = new Slash({
	name: 'feedback',
	description: 'Send us feedback'
})

execute(slash, (interaction) => {
	const contentInput = new TextInputBuilder()
		.setCustomId('content')
		.setLabel('Content')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('Your feedback content...')
		.setRequired(true)

	const row = new ActionRowBuilder().setComponents(contentInput)

	const modal = new ModalBuilder()
		.setCustomId('feedback')
		.setTitle('Submit your feedback')
		.setComponents(row)

	interaction.showModal(modal)
})

const modal = new Modal({ id: 'feedback' })

execute(modal, (interaction) => {
	const feedback = interaction.fields.getTextInputValue('content')

	// Send feedback somewhere...

	interaction.reply({
		content: 'Thanks for the feedback!',
		ephemeral: true
	})
})

export { slash, modal }
```

#### Reference

- id: string | RegExp
- cooldown?: CooldownResolvable

### Protector

Protectors in Sunar act as middleware, allowing you to intercept and control the
flow of commands and interactions within your Discord bot. They provide a
flexible way to enforce permissions, validate inputs, or perform pre-processing
before executing commands.

```ts src/protectors/admin-only.ts
import { Protector, execute } from 'sunar'

const protector = new Protector({
	commands: ['slash']
})

execute(protector, (arg) => {
	// handle execution
})

export { protector }
```

#### Implementation

For detailed implementation examples and usage patterns, refer to the [middlewares guide](https://sunar.js.org/docs/guides/middlewares#protectors).

#### Reference

- commands: string[]

### SelectMenu

Select menus allow users to choose from a list of options. They are useful for 
forms, surveys, or any scenario where the user needs to make a selection from 
multiple choices.

```ts src/select-menus/buy.ts
import { SelectMenu, execute } from 'sunar'
import { ComponentType } from 'discord.js'

const select = new SelectMenu({
	id: 'example',
	type: ComponentType.StringSelect
})

execute(select, (interaction) => {
	// handle execution
})

export { select }
```

#### Implementation

```ts src/commands/buy.ts
import { SelectMenu, Slash, execute } from 'sunar'
import {
	ActionRowBuilder,
	ComponentType,
	StringSelectMenuBuilder
} from 'discord.js'

const slash = new Slash({
	name: 'buy',
	description: 'Buy something'
})

execute(slash, (interaction) => {
	const select = new StringSelectMenuBuilder()
		.setCustomId('buy')
		.setOptions(
			{ label: 'Laptop', value: 'laptop' },
			{ label: 'Smart TV', value: 'smart-tv' },
			{ label: 'Tablet', value: 'tablet' },
			{ label: 'Smartphone', value: 'smartphone' }
		)
		.setPlaceholder('Select an item to purchase')

	const row = new ActionRowBuilder().setComponents(select)

	interaction.reply({ components: [row] })
})

const select = new SelectMenu({
	id: 'buy',
	type: ComponentType.StringSelect
})

execute(select, (interaction) => {
	const item = interaction.values.at(0)

	// Do something with the item...

	interaction.reply({ content: `You have purchased the **${item}** item` })
})

export { slash, select }
```

#### Reference

- id: string | RegExp
- type: ComponentType.StringSelect | ComponentType.UserSelect | ComponentType.RoleSelect | ComponentType.MentionableSelect | ComponentType.ChannelSelect
- cooldown?: CooldownResolvable

### Signal

Signals in Sunar correspond to events in discord.js. They allow you to handle 
various actions and responses that occur within your Discord bot, such as 
messages being sent, users joining or leaving, and more.

```ts src/signals/message-create.ts
import { Signal, execute } from 'sunar'

const signal = new Signal('messageCreate')

execute(signal, (message) => {
	// handle execution
})

export { signal }
```

#### Implementation

```ts src/signals/guild-member-add/welcome.ts
import { Signal, execute } from 'sunar'
import { TextChannel } from 'discord.js'

const signal = new Signal('guildMemberAdd')

execute(signal, (member) => {
	const channel = member.guild.channels.cache.find(
		(c) => c.name === 'welcomes'
	)

	if (!(channel instanceof TextChannel)) return

	channel.send({ content: `${member} just joined!` })
})

export { signal }
```

#### Reference

- event: string
- once?: boolean

### Slash

Slash commands are one of the primary ways users interact with bots. They
provide a structured way for users to issue commands directly within the chat
interface.

```ts src/commands/example.ts
import { Slash, execute } from 'sunar'

const slash = new Slash({
	name: 'example',
	description: 'example description'
})

execute(slash, (interaction) => {
	// handle execution
})

export { slash }
```

#### Implementation

```ts src/commands/avatar.ts
import { Slash, execute } from 'sunar'
import { ApplicationCommandOptionType } from 'discord.js'

const slash = new Slash({
	name: 'avatar',
	description: 'Show user avatar',
	options: [
		{
			name: 'target',
			description: 'Target user',
			type: ApplicationCommandOptionType.User
		}
	]
})

execute(slash, (interaction) => {
	const user = interaction.options.getUser('target') ?? interaction.user

	const avatarURL = user.displayAvatarURL({
		size: 1024,
		forceStatic: false
	})

	interaction.reply({
		content: `Avatar of user **${interaction.user.username}**`,
		files: [avatarURL]
	})
})

export { slash }
```

#### Reference

- name: string
- description: string
- options?: ApplicationCommandOptionData[]
- guildIds?: string[]
- cooldown?: CooldownResolvable

## Middlewares

Explore how Sunar enhances your discord bot's functionality with middleware
support.

### Protectors

Protectors in Sunar act as middleware, allowing you to intercept and control the
flow of commands and interactions within your Discord bot. They provide a
flexible way to enforce permissions, validate inputs, or perform pre-processing
before executing commands.

#### Create the protector logic

Create a file `only-admins.ts` in the directory `src/protectors/`. This file
defines a protector `onlyAdmins` that checks if the user has administrator
permissions.

```ts src/protectors/only-admins.ts
import { PermissionFlagsBits } from 'discord.js'
import { Protector, execute } from 'sunar'

const onlyAdmins = new Protector({
	commands: ['slash'],
	signals: ['interactionCreate']
})

const content = 'This command can only be used by administrators'

function checkIsAdmin(permissions) {
	if (!permissions) return false
	return permissions.has(PermissionFlagsBits.Administrator)
}

execute(onlyAdmins, (arg, next) => {
	const entry = Array.isArray(arg) ? arg[0] : arg
	const isAdmin = checkIsAdmin(entry.memberPermissions)

	if (entry.isRepliable() && !isAdmin) {
		return entry.reply({ content, ephemeral: true })
	}

	return isAdmin && next()
})

export { onlyAdmins }
```

When creating a `Protector` instance, specify the commands, signals, or
components that will use this protector. This allows precise control over the
arguments received through function parameters.

#### Create a protected command

Create a file `protected.ts` in the directory `src/commands/`. This file defines
a Slash command named `protected` that is protected by the `onlyAdmins`
protector. Only administrators can execute this command, and it replies with a
message indicating the user is an administrator.

```ts src/commands/protected.ts
import { Slash, execute, protect } from 'sunar'
import { onlyAdmins } from '../protectors/only-admins'

const slash = new Slash({
	name: 'protected',
	description: 'This is a protected slash command'
})

protect(slash, [onlyAdmins])

execute(slash, (interaction) => {
	interaction.reply({ content: 'You are an admin!' })
})

export { slash }
```

#### Admin Only

Restrict command execution to server administrators using middleware in Sunar.

```ts src/protectors/admin-only.ts
import { Message, PermissionFlagsBits, PermissionsBitField } from 'discord.js'
import { Protector, execute } from 'sunar'

const adminOnly = new Protector({
	commands: ['autocomplete', 'contextMenu', 'slash'],
	components: ['button', 'modal', 'selectMenu'],
	signals: ['interactionCreate', 'messageCreate']
})

const content = 'Only the admins can use this.'

function checkIsAdmin(permissions) {
	if (!permissions || typeof permissions === 'string') return false
	return permissions.has(PermissionFlagsBits.Administrator)
}

execute(adminOnly, (arg, next) => {
	const entry = Array.isArray(arg) ? arg[0] : arg

	const isAdmin = checkIsAdmin(entry.member?.permissions)

	if (entry instanceof Message) {
		if (isAdmin) return next()
		return entry.reply({ content })
	}

	if (entry.isAutocomplete() && !isAdmin) return entry.respond([])
	if (entry.isRepliable() && !isAdmin)
		return entry.reply({ content, ephemeral: true })

	return isAdmin && next()
})

export { adminOnly }
```

**Usage:**

```ts
protect(builder, [adminOnly])
```

#### Owner Only

Learn how to restrict command execution to only the bot owner using middleware
in Sunar.

```ts src/protectors/owner-only.ts
import { Message } from 'discord.js'
import { Protector, execute } from 'sunar'

const OWNERS = ['123', '456', '789']

const ownerOnly = new Protector({
	commands: ['autocomplete', 'contextMenu', 'slash'],
	components: ['button', 'modal', 'selectMenu'],
	signals: ['interactionCreate', 'messageCreate']
})

const content = 'Only the bot owners can use this.'

execute(ownerOnly, (arg, next) => {
	const entry = Array.isArray(arg) ? arg[0] : arg

	if (entry instanceof Message) {
		const isOwner = OWNERS.includes(entry.author.id)
		if (isOwner) return next()
		return entry.reply({ content })
	}

	const isOwner = OWNERS.includes(entry.user.id)

	if (entry.isAutocomplete() && !isOwner) return entry.respond([])
	if (entry.isRepliable() && !isOwner)
		return entry.reply({ content, ephemeral: true })

	return isOwner && next()
})

export { ownerOnly }
```

**Usage:**

```ts
protect(builder, [ownerOnly])
```

#### Verify Member Permissions

Ensure users have the required permissions before executing commands.

```ts src/protectors/member-perms.ts
import {
	Message,
	PermissionResolvable,
	PermissionsBitField,
	PermissionsString,
	inlineCode
} from 'discord.js'
import { Protector, execute } from 'sunar'

const res = (missing) => {
	const missingPerms = missing.map((p) => inlineCode(p)).join(', ')
	return `You need the ${missingPerms} permissions.`
}

export function memberPerms(...perms) {
	const protector = new Protector({
		commands: ['autocomplete', 'contextMenu', 'slash'],
		components: ['button', 'modal', 'selectMenu'],
		signals: ['interactionCreate', 'messageCreate']
	})

	execute(protector, (arg, next) => {
		const entry = Array.isArray(arg) ? arg[0] : arg
		if (!entry.guild) return next()

		const missing = getMissingPerms(entry.member?.permissions)
		const isMissing = missing.length > 0

		if (entry instanceof Message) {
			if (!isMissing) return next()
			return entry.reply({ content: res(missing) })
		}

		if (entry.isAutocomplete() && isMissing) return entry.respond([])
		if (entry.isRepliable() && isMissing)
			return entry.reply({ content: res(missing), ephemeral: true })

		return !isMissing && next()
	})

	function getMissingPerms(bitField) {
		if (!bitField || typeof bitField === 'string') return []
		return bitField.missing(perms)
	}

	return protector
}
```

**Usage:**

```ts
protect(builder, [memberPerms('Administrator')])
```

#### Verify Member Roles

Implement role verification to restrict command usage to members with specific
roles.

```ts src/protectors/roles.ts
import { GuildMemberRoleManager, Message, Role, inlineCode } from 'discord.js'
import { Protector, execute } from 'sunar'

const res = (missing) => {
	const missingRoles = missing.map((r) => inlineCode(r.name)).join(', ')
	return `You need the ${missingRoles} roles.`
}

export function roles(...roles) {
	const protector = new Protector({
		commands: ['autocomplete', 'contextMenu', 'slash'],
		components: ['button', 'modal', 'selectMenu'],
		signals: ['interactionCreate', 'messageCreate']
	})

	execute(protector, (arg, next) => {
		const entry = Array.isArray(arg) ? arg[0] : arg
		if (!entry.guild) return next()

		const missing = getMissingRoles(entry.member?.roles)
		const isMissing = missing.length > 0

		if (entry instanceof Message) {
			if (!isMissing) return next()
			return entry.reply({ content: res(missing) })
		}

		if (entry.isAutocomplete() && isMissing) return entry.respond([])
		if (entry.isRepliable() && isMissing)
			return entry.reply({ content: res(missing), ephemeral: true })

		return !isMissing && next()
	})

	function getMissingRoles(manager) {
		if (!manager || Array.isArray(manager)) return []

		const missing = roles
			.map((r) => {
				const role = manager.guild.roles.resolve(r)
				if (role && !manager.cache.has(role.id)) return role
			})
			.filter((r) => r != null)

		return missing
	}

	return protector
}
```

**Usage:**

```ts
protect(builder, [roles('123456')])
```

## Implementing Cooldowns

Learn how to implement and manage cooldowns for commands and components in your
Discord bot using Sunar. This guide will walk you through the steps to ensure
your bot handles cooldowns effectively, preventing command spam and enhancing
user experience.

> **Note:** Cooldowns can be used only for repliable interactions.

### Simple Usage

#### Create a command or component

Start by creating the command or component you want to apply a cooldown to.
This can be any type of command or interactive component within your bot.

For this example, we'll create a simple avatar command that responds with the
user avatar when invoked. The same process can be applied to components like
buttons or select menus.

```ts src/commands/avatar.ts
import { Slash, execute } from 'sunar'

const slash = new Slash({
	name: 'avatar',
	description: 'Show your user avatar'
})

execute(slash, (interaction) => {
	const avatarURL = interaction.user.displayAvatarURL()

	interaction.reply({
		content: `Showing ${interaction.user} avatar!`,
		files: [avatarURL]
	})
})

export { slash }
```

#### Implement and configure the cooldown

Next, implement and configure the cooldown for your command or component using
the config mutator. The `cooldown` property can be set using a `number` for a
simple cooldown period or a `CooldownConfig` object for more advanced
configuration.

Here's an example of setting a simple cooldown of 5 seconds:

```ts src/commands/avatar.ts
import { Slash, execute, config } from 'sunar'

const slash = new Slash({
	name: 'avatar',
	description: 'Show your user avatar'
})

config(slash, {
	cooldown: 5_000 // 5000 milliseconds = 5 seconds
})

execute(slash, (interaction) => {
	const avatarURL = interaction.user.displayAvatarURL()

	interaction.reply({
		content: `Showing ${interaction.user} avatar!`,
		files: [avatarURL]
	})
})

export { slash }
```

#### Detect when a user is on cooldown

To handle scenarios when a user attempts to use a command or component while
still in the cooldown period, you can listen for the `cooldown` signal provided
by Sunar. This signal passes the interaction and a `CooldownContext` object as
arguments.

Here's how you can set it up:

```ts src/signals/cooldown.ts
import { Signal, execute } from 'sunar'

const signal = new Signal('cooldown')

execute(signal, (interaction, context) => {
	interaction.reply({
		content: `You need to wait ${context.remaining} milliseconds before using this again.`
	})
})

export { signal }
```

In this example, the cooldown signal helps you notify users when they attempt to
use a command or component before the cooldown period has expired.

The `CooldownContext` object contains information such as the remaining cooldown
time, which you can use to inform the user accordingly.

### Advanced Usage

#### Using cooldowns with different scopes

Sunar supports different cooldown scopes through the `CooldownScope` enum,
allowing you to manage cooldown periods based on various contexts. By default,
cooldowns are applied at the user level, ensuring fair usage of commands across
different users.

**Scopes:**

1. **User**: Limits the frequency of command execution to once every specified
interval per user.
2. **Channel**: Limits the frequency of command execution to once every specified
interval per channel.
3. **Guild**: Limits the frequency of command execution to once every specified 
interval per server.
4. **Global**: Limits the frequency of command execution to once every specified 
interval globally across all users, channels, and servers.

**Example:**

This configuration restricts the command to execute only once every 3 seconds 
per server.

```ts src/commands/avatar.ts
import { CooldownScope, Slash, execute, config } from 'sunar'

const slash = new Slash({
	name: 'avatar',
	description: 'Show your user avatar'
})

config(slash, {
	cooldown: {
		time: 3_000, // 3 seconds
		scope: CooldownScope.Guild
	}
})

execute(slash, (interaction) => {
	const avatarURL = interaction.user.displayAvatarURL()

	interaction.reply({
		content: `Showing ${interaction.user} avatar!`,
		files: [avatarURL]
	})
})

export { slash }
```

#### Cooldown Capping

Learn how to set specific limits on how many times a command or component can be
used before triggering a cooldown period. By default, commands and components
have a usage limit of 1, after which a cooldown period goes into effect.

```ts src/commands/avatar.ts
import { Slash, execute, config } from 'sunar'

const slash = new Slash({
	name: 'avatar',
	description: 'Show your user avatar'
})

config(slash, {
	cooldown: {
		time: 5_000, // 5 seconds
		limit: 3
	}
})

execute(slash, (interaction) => {
	const avatarURL = interaction.user.displayAvatarURL()

	interaction.reply({
		content: `Showing ${interaction.user} avatar!`,
		files: [avatarURL]
	})
})

export { slash }
```

This example demonstrates how to implement a cooldown with a usage cap for a
slash command in Sunar. In this case, the `avatar` command is configured to have
a cooldown period of 5 seconds and a usage limit of 3. This means the command 
can be used up to 3 times within the cooldown period before subsequent uses 
trigger the cooldown.

#### Excluding target IDs

Learn how to exclude specific IDs from cooldown restrictions based on different
scopes using the exclude property in Sunar. This feature allows you to bypass
cooldown limits for certain entities, such as excluding server IDs in a Guild
scope configuration or excluding user IDs in a User scope configuration.

```ts src/commands/avatar.ts
import { Slash, execute, config } from 'sunar'

const slash = new Slash({
	name: 'avatar',
	description: 'Show your user avatar'
})

config(slash, {
	cooldown: {
		time: 5_000, // 5 seconds
		exclude: ['SOME_USER_ID']
		// scope: CooldownScope.User (default)
	}
})

execute(slash, (interaction) => {
	const avatarURL = interaction.user.displayAvatarURL()

	interaction.reply({
		content: `Showing ${interaction.user} avatar!`,
		files: [avatarURL]
	})
})

export { slash }
```

In this example, the `avatar` command is configured with a User scope cooldown
of 5 seconds. The exclude property is used to exclude specific user IDs from the
cooldown restrictions.

#### Advanced handling of the cooldown signal

Learn how to leverage the `cooldown` signal in Sunar for advanced bot
interaction management. This section covers configuring, customizing, and
integrating cooldown signals to optimize command usage and user experience.

```ts src/signals/cooldown.ts
import { Signal, CooldownScope, execute } from 'sunar'

const signal = new Signal('cooldown')

execute(signal, (interaction, { remaining, scope }) => {
	const type = interaction.isCommand() ? 'command' : 'component'
	const remainingSeconds = remaining / 1000
	let content

	switch (scope) {
		case CooldownScope.User:
			content = `You need to wait ${remainingSeconds} seconds before using this ${type} again.`
			break
		case CooldownScope.Channel:
			content = `You need to wait ${remainingSeconds} seconds in this channel before using this ${type} again.`
			break
		case CooldownScope.Guild:
			content = `You need to wait ${remainingSeconds} seconds in this server before using this ${type} again.`
			break
		case CooldownScope.Global:
			content = `This ${type} is on cooldown globally, you need to wait ${remainingSeconds} seconds.`
			break
		default:
			content = `This ${type} is on cooldown, you need to wait ${remainingSeconds} seconds.`
			break
	}

	interaction.reply({ content })
})

export { signal }
```

• **Cooldown Management**: The `cooldown` signal in Sunar manages cooldown
periods for Discord bot interactions. When triggered, it determines how long
users must wait before executing a command again.

• **Execution Callback**: When the `cooldown` signal is triggered, it executes a
callback function. This function informs users about the remaining cooldown time
based on the scope of the cooldown (`User`, `Channel`, `Guild`, `Global`).

• **User Experience**: By regulating command usage, cooldowns ensure fair
interaction within Discord servers. This prevents overuse of commands and
maintains a balanced user experience.

This setup allows developers to configure cooldowns based on specific needs,
ensuring smooth bot operation and enhancing community engagement on Discord
platforms.

