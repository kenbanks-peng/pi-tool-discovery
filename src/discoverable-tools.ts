import type { ToolMetadata } from "./core.ts";

const DESCRIPTION_LIMIT = 200;

/** Return a compact prompt index for inactive tools. */
export async function createDiscoverableTools(
  tools: ToolMetadata[],
  _sessionId: string,
): Promise<string> {
  if (tools.length === 0) return "";

  const entries = tools.map((tool) => [
    "  <tool",
    `    name="${escapeXml(tool.name)}"`,
    `    description="${escapeXml(shortDescription(tool.description))}"`,
    "  />",
  ].join("\n"));

  return `<tool_discovery>
Here are tools available for use after they are activated using activate_tool.
${entries.join("\n")}
</tool_discovery>`;
}

export function injectDiscoverableTools(systemPrompt: string, discoverableTools: string): string {
  // The activate_tool guideline names this tag. Only an opening tag followed by a
  // newline is an injected discovery section; a textual mention must not block it.
  if (!discoverableTools || /<tool_discovery>\r?\n/.test(systemPrompt)) return systemPrompt;

  const toolsEnd = "</tools>";
  const toolsEndIndex = systemPrompt.indexOf(toolsEnd);
  if (toolsEndIndex !== -1) {
    const insertIndex = toolsEndIndex + toolsEnd.length;
    return `${systemPrompt.slice(0, insertIndex)}\n\n${discoverableTools}${systemPrompt.slice(insertIndex)}`;
  }

  const fallbackSectionEnd = "\n\nIn addition to the tools above";
  const fallbackIndex = systemPrompt.indexOf(fallbackSectionEnd);
  if (fallbackIndex === -1) return `${systemPrompt}\n\n${discoverableTools}`;
  return `${systemPrompt.slice(0, fallbackIndex)}\n\n${discoverableTools}${systemPrompt.slice(fallbackIndex)}`;
}

function shortDescription(description: string): string {
  const sentences = description.match(/.*?[.!?](?:\s|$)/g) ?? [description];
  const summary = sentences.slice(0, 2).join("").trim();
  return summary.length <= DESCRIPTION_LIMIT
    ? summary
    : `${summary.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}
