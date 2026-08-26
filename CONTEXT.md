# Tool Discovery Glossary

**Tool discovery**: Extension behavior that keeps selected tool definitions out of the initial active-tool set and gives the agent private tool descriptions.

**Direct tool**: A built-in, `discover_tools`, or allow-listed tool that stays active.

**Deferred tool**: An eligible active non-built-in tool removed from the active-tool set until `discover_tools` activates it.

**Tool file**: A session-temporary Markdown file with the full description, parameter schema, and guidelines for a deferred tool. It is not a Pi skill and cannot be called with `/skill:`.

**Discoverable-tools section**: Agent context in the normal tools section. It lists each deferred tool with a short description and the location of its tool file.

**Reconciliation**: The one-time selection, tool-file write, discoverable-tools-section build, and active-tool update at the first `before_agent_start`. Later agent starts reuse the stored section.

**Allow-list**: The union of global and trusted-project TOML `tools` entries that identify direct tools.
