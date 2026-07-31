# ModularBotTemplate

A modular Discord bot template built with TypeScript and discord.js.

The project provides a structured foundation for building scalable Discord applications by separating commands, events, managers and domain models into independent modules. Its architecture focuses on maintainability, extensibility and type safety without enforcing a specific application structure.

---

## Features

- Modular architecture
- Dynamic module loading
- Automatic command registration
- Automatic event registration
- Text and Slash Command support
- Guild settings management
- Permission namespaces
- User management
- Flag management
- Type-safe abstractions
- Mongoose integration
- Workspace ready

---

## Project Layout

```
.
├── classes
│   ├── managers
│   └── structs
├── defaults
│   ├── commands
│   ├── events
│   └── permissionNamespaces.ts
├── handlers
├── modules
│   └── example
├── scripts
├── index.ts
├── postinstall.mjs
└── package.json
```

---

## Requirements

- Node.js 20+
- npm

---

## Installation

Clone the repository

```bash
git clone https://github.com/PlaryWasTaken/ModularBotTemplate.git
cd ModularBotTemplate
```

Install dependencies

```bash
npm install
```

---

## Development

Run the bot in development mode.

```bash
npm run startDev
```

---

## Production Build

```bash
npm run build
```

Start the compiled application.

```bash
npm start
```

---

## Available Scripts

| Script | Description |
|---------|-------------|
| `npm run startDev` | Starts the bot using ts-node |
| `npm run build` | Generates typings and compiles the project |
| `npm start` | Builds and starts the production build |
| `npm run generate:user-augments` | Generates user augmentation typings |
| `npm run buildCoolify` | Production build for Coolify deployments |

---

## Architecture

### Managers

Managers encapsulate application services and shared business logic.

```
classes/managers
```

Current managers include:

- FlagsManager
- GuildManager
- PermissionsManager
- SettingsManager
- SlashManager
- UserManager

---

### Structs

Core domain abstractions used throughout the project.

```
classes/structs
```

- Command
- SlashCommand
- Guild
- User
- Permissions
- ObjectFlags

---

### Defaults

The `defaults` directory contains the framework's built-in implementation.

```
defaults
```

- Commands
- Events
- Permission namespaces

---

### Modules

Application features are organized as isolated modules.

```
modules/
```

Each module may contain:

- commands
- events
- services
- assets
- custom logic

This keeps unrelated functionality isolated while allowing the framework to discover and register components automatically.

---

## Creating Commands

Text commands and slash commands are implemented independently.

Example layout:

```
modules/
└── myModule
    └── commands
        ├── ping.ts
        └── pingSlash.ts
```

The command handler automatically discovers and registers supported commands during startup.

---

## Creating Events

Events can be added by creating new files inside either the module or default event directories.

```
modules/myModule/events
```

or

```
defaults/events
```

No additional registration is required.

---

## Tech Stack

- TypeScript
- Node.js
- Discord.js
- Mongoose
- Axios
- RxJS
- Sharp

---

## Contributing

Contributions are welcome.

1. Fork this repository.
2. Create a feature branch.
3. Commit your changes.
4. Push your branch.
5. Open a Pull Request.

Please keep contributions consistent with the project's existing coding style.

---

## License

Licensed under the ISC License.

See the LICENSE file for more information.