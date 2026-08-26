import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  findMatchingTools,
  selectActiveDeferredTools,
  type ToolMetadata,
} from "./core.ts";
import { resolveDirectTools } from "./config.ts";
import { createDiscoverableTools, injectDiscoverableTools } from "./discoverable-tools.ts";

const DISCOVERY_TOOL_NAME = "discover_tools";
const DISCOVERY_TOOL_DESCRIPTION = "Select and activate one deferred tool whose primary purpose matches a required action and target.";
const REQUIRED_DIRECT_TOOLS = ["read"];

function asToolMetadata(tools: ReturnType<ExtensionAPI["getAllTools"]>): ToolMetadata[] {
  return tools as ToolMetadata[];
}

export default function toolDiscovery(pi: ExtensionAPI): void {
  let deferredTools: ToolMetadata[] = [];
  let directTools = new Set<string>();
  let discoverableTools = "";
  let sessionId = "unknown-session";
  let reconciled = false;

  function deferActiveTools(): void {
    const activeTools = pi.getActiveTools();
    deferredTools = selectActiveDeferredTools(
      asToolMetadata(pi.getAllTools()),
      new Set(activeTools),
      directTools,
    );
    const deferredNames = new Set(deferredTools.map((tool) => tool.name));
    pi.setActiveTools(activeTools.filter((name) => !deferredNames.has(name)));
  }

  pi.registerTool({
    name: DISCOVERY_TOOL_NAME,
    label: "Discover Tools",
    description: DISCOVERY_TOOL_DESCRIPTION,
    // Keep its complete description in Pi's standard Available tools section.
    // A custom tool normally supplies only a short prompt snippet there.
    promptSnippet: DISCOVERY_TOOL_DESCRIPTION,
    promptGuidelines: [
      "Call discover_tools when the active tools cannot do the work. State the action and target in request, such as 'search the public web' or 'run several shell commands'. It activates only the best matching tool for the next response.",
    ],
    parameters: Type.Object({
      request: Type.String({ description: "The task or capability that requires a tool" }),
    }),
    async execute(_toolCallId, params) {
      const matches = findMatchingTools(params.request, deferredTools);
      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No deferred tools match: ${params.request}` }],
          details: { matches: [], activated: [], alreadyActive: [] },
        };
      }

      const active = pi.getActiveTools();
      const selected = matches.find((tool) => !active.includes(tool.name)) ?? matches[0];
      const activated = active.includes(selected.name) ? [] : [selected.name];
      const alreadyActive = active.includes(selected.name) ? [selected.name] : [];
      if (activated.length > 0) {
        pi.setActiveTools([...active, selected.name]);
      }

      const status = activated.length > 0
        ? `Activated: ${selected.name}. Tool definition will be available in the next response.`
        : `Already active: ${selected.name}.`;
      return {
        content: [{ type: "text", text: status }],
        details: { matches: matches.map((tool) => tool.name), activated, alreadyActive },
      };
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    deferredTools = [];
    discoverableTools = "";
    sessionId = ctx.sessionManager.getSessionId();
    reconciled = false;

    const configuredDirectTools = await resolveDirectTools(
      join(getAgentDir(), "tool-discovery.toml"),
      join(ctx.cwd, CONFIG_DIR_NAME, "tool-discovery.toml"),
      ctx.isProjectTrusted(),
      (message) => ctx.ui.notify(`Tool discovery configuration warning: ${message}`, "warning"),
    );
    directTools = new Set([...REQUIRED_DIRECT_TOOLS, ...configuredDirectTools]);
  });

  pi.on("before_agent_start", async (event) => {
    if (!reconciled) {
      deferActiveTools();
      discoverableTools = await createDiscoverableTools(deferredTools, sessionId);
      reconciled = true;
    }
    return { systemPrompt: injectDiscoverableTools(event.systemPrompt, discoverableTools) };
  });
}
