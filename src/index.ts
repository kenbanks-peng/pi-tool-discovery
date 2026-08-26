import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  findMatchingTools,
  selectActiveDeferredTools,
  type ToolMetadata,
} from "./core.ts";
import { resolveDirectTools } from "./config.ts";

const DISCOVERY_TOOL_NAME = "discover_tools";

function asToolMetadata(tools: ReturnType<ExtensionAPI["getAllTools"]>): ToolMetadata[] {
  return tools as ToolMetadata[];
}

export default function toolDiscovery(pi: ExtensionAPI): void {
  let deferredTools: ToolMetadata[] = [];
  let directTools = new Set<string>();
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
    description: "Find and activate progressively disclosed tools for a required capability.",
    promptSnippet: "Find progressively disclosed tools when active tools cannot do the required work",
    promptGuidelines: [
      "Call discover_tools for a required capability when the active tools cannot do the work. It activates matching tools for the next response.",
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
      const activated = matches.map((tool) => tool.name).filter((name) => !active.includes(name));
      const alreadyActive = matches.map((tool) => tool.name).filter((name) => active.includes(name));
      if (activated.length > 0) {
        pi.setActiveTools([...new Set([...active, ...activated])]);
      }

      const status = [
        activated.length > 0 ? `Activated: ${activated.join(", ")}. Tool definitions will be available in the next response.` : "",
        alreadyActive.length > 0 ? `Already active: ${alreadyActive.join(", ")}.` : "",
      ].filter(Boolean).join(" ");
      return {
        content: [{ type: "text", text: status }],
        details: { matches: matches.map((tool) => tool.name), activated, alreadyActive },
      };
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    deferredTools = [];
    reconciled = false;

    directTools = await resolveDirectTools(
      join(getAgentDir(), "tool-discovery.toml"),
      join(ctx.cwd, CONFIG_DIR_NAME, "tool-discovery.toml"),
      ctx.isProjectTrusted(),
      (message) => ctx.ui.notify(`Tool discovery configuration warning: ${message}`, "warning"),
    );
  });

  pi.on("before_agent_start", () => {
    if (!reconciled) {
      deferActiveTools();
      reconciled = true;
    }
  });
}
