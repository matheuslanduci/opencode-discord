# Introduction

This is a template for vibe-coding your own Discord bot. It has direct
instructions to use [Sunar](https://sunar.js.org/), a ergonomic framework built
on top of [Discord.js](https://discord.js.org/). Linting and formatting are
also included powered by [Biome](https://biomejs.dev/).

## Prerequisites

- [Bun](https://bun.sh) installed
- Knowledge of TypeScript and Discord.js is recommended

## Getting started

1. Clone the repository (or click the "Use this template" button on GitHub):

```bash
git clone https://github.com/matheuslanduci/discord-vibecoding.git name-of-your-bot
```

2. Navigate to the project directory:

```bash
cd name-of-your-bot
```

3. Install dependencies:

```bash
bun install
```

4. Create a `.env` file in the root directory and add your bot token:

```plaintext
DISCORD_BOT_TOKEN=your-bot-token
```

5. Customize the AI instructions:

We have three files:

- `ai/INSTRUCTIONS.md`: General instructions for the AI.
- `ai/SUNAR.md`: Instructions specific to the Sunar framework.
- `ai/DOCS.md`: Documentation links for libraries used in the project.

According to the tools you are using, you can move them to a specific folder 
(or a file) like `.cursorrules`, `.github/instructions` or `CLAUDE.md`.

You can also customize the instructions to fit your needs.

6. Start the bot:

```bash
bun dev
```

1. To run in production, use:

```bash
bun start
```

## Recommended AI Tools

- [Claude Code](https://claude.ai): Claude-based code agent.
- [GitHub Copilot](https://github.com/features/copilot): Github's AI code agent.
- [Cursor](https://cursor.com): AI IDE with built-in AI tools.
- [opencode](https://opencode.ai): Open-source AI code agent.

### Recommended Models

- Claude 4 Sonnet.
- GPT 4.1 with [Beast Mode](https://gist.github.com/burkeholland/88af0249c4b6aff3820bf37898c8bacf).