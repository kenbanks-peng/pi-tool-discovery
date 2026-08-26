# Pi Tool Discovery

Pi Tool Discovery reduces the initial tool context for non-built-in tools. It uses Pi's native dynamic tool loading.

Before the first agent request, the extension keeps all built-in tools, direct tools, and `discover_tools` active. It defers only eligible non-built-in active tools. Pi lists `discover_tools` with the built-in tools, using its full description, and adds its usage rule to **Guidelines**:

- Call `discover_tools` when the active tools cannot do the required work.
- State the action and target in `request`, for example, `search the public web` or `run several shell commands`.
- Pi gives priority to exact tool-name matches over broad words in a tool description.
- Pi adds only the best matching tool definition for the next response. Call it again for each additional tool.

This keeps the tool-discovery instructions with the normal tool guidance. Deferred tools add a compact `<tool_discovery>` section below `<tools>`. Each entry has the tool name, a short description, and a path to a session-temporary Markdown file. The file contains the full description, parameter schema, and tool guidelines that Pi would otherwise provide with the callable tool definition. The agent must read that file before it activates or calls the tool.

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

Direct tools and all built-in tools stay active when Pi made them active. `read` stays active so the agent can read a deferred tool file. `discover_tools` is always a direct tool: it stays active and is never listed as a deferred tool. A tool disabled by Pi stays disabled.

## Extension order

Tool Discovery must load after extensions that add tools in `before_agent_start`. This lets it defer these tools before the first model request. For example, load `context-mode` before `pi-tool-discovery` when context-mode registers `ctx_*` tools at this lifecycle event.

This is an extension load-order requirement. Pi does not provide a generic guarantee that an extension runs last.

## Development

```sh
bun run typecheck
bun test
```
