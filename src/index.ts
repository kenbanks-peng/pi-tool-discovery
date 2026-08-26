import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  selectActiveDeferredTools,
  type ToolMetadata,
} from "./core.ts";
import { resolveDirectTools } from "./config.ts";
import { createDiscoverableTools, injectDiscoverableTools } from "./discoverable-tools.ts";

const ACTIVATION_TOOL_NAME = "activate_tool";
const ACTIVATION_TOOL_DESCRIPTION = "Activate one deferred tool by name.";
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
    name: ACTIVATION_TOOL_NAME,
    label: "Activate Tool",
    description: ACTIVATION_TOOL_DESCRIPTION,
    promptSnippet: ACTIVATION_TOOL_DESCRIPTION,
    promptGuidelines: [
      "Call activate_tool when an inactive tool is needed. Set name to the tool name shown in <tool_discovery>. It activates that tool for the next response.",
    ],
    parameters: Type.Object({
      name: Type.String({ description: "The inactive tool name to activate" }),
    }),
    async execute(_toolCallId, params) {
      const selected = deferredTools.find((tool) => tool.name === params.name);
      if (!selected) {
        return {
          content: [{ type: "text", text: `No inactive tool is named: ${params.name}` }],
          details: { activated: [], alreadyActive: [] },
        };
      }

      const active = pi.getActiveTools();
      const activated = active.includes(selected.name) ? [] : [selected.name];
      const alreadyActive = active.includes(selected.name) ? [selected.name] : [];
      if (activated.length > 0) pi.setActiveTools([...active, selected.name]);

      const status = activated.length > 0
        ? `Activated: ${selected.name}.`
        : `Already active: ${selected.name}.`;
      return {
        content: [{ type: "text", text: status }],
        details: { activated, alreadyActive },
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
