# Pi Tool Discovery

Pi Tool Discovery reduces the initial tool context for non-built-in tools. It uses Pi's native dynamic tool loading.

Before the first agent request, the extension keeps built-in tools, direct tools, and `discover_tools` active. It defers the other active non-built-in tools. Pi then lists `discover_tools` in its normal **Available tools** section and adds its usage rule to **Guidelines**:

- Call `discover_tools` when the active tools cannot do the required work.
- Describe the required capability in `request`.
- Pi adds matching tool definitions for the next response.

This keeps the tool-discovery instructions with the normal tool guidance. Deferred tools do not add a separate XML list or private metadata files to the system prompt.

## Install

```sh
pi --extension ./src/index.ts
```

## Configure direct tools

Use either or both optional TOML files:

- Global: `tool-discovery.toml` in Pi's agent directory.
- Project: `tool-discovery.toml` in the trusted project configuration directory.

```toml
tools = ["search_issues", "deploy_preview"]
```

Direct tools stay active when Pi made them active. Built-in tools and `discover_tools` also stay active. A tool disabled by Pi stays disabled.

## Extension order

Tool Discovery must load after extensions that add tools in `before_agent_start`. This lets it defer these tools before the first model request. For example, load `context-mode` before `pi-tool-discovery` when context-mode registers `ctx_*` tools at this lifecycle event.

This is an extension load-order requirement. Pi does not provide a generic guarantee that an extension runs last.

## Development

```sh
bun run typecheck
bun test
```
