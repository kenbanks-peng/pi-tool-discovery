# Tool Discovery Glossary

**Tool discovery**: Extension behavior that keeps selected tool definitions out of the initial active-tool set and gives the agent private tool descriptions.

**Direct tool**: A built-in, `discover_tools`, or allow-listed tool that stays active.

**Deferred tool**: An eligible active non-built-in tool removed from the active-tool set until `discover_tools` activates it.

**Private tool metadata**: A session-temporary Markdown file that contains full callable tool metadata and input schema. It is not a Pi skill, is hidden from users, and cannot be called with `/skill:`.

**Available-tools XML**: Private agent system-prompt context with `tool`, `name`, `description`, and `location` elements for each deferred tool. The location points to its private metadata file.

**Reconciliation**: The one-time selection, metadata write, XML build, and active-tool update at the first `before_agent_start`. Later agent starts reuse the stored XML.

**Allow-list**: The union of global and trusted-project TOML `tools` entries that identify direct tools.
