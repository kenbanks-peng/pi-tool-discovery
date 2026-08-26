import type { ToolMetadata } from "./core.ts";

const DESCRIPTION_LIMIT = 120;

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
Inactive tools are listed below. Their descriptions are sufficient to select a tool. Call activate_tool with the exact name; do not read a tool-description file.
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
  const firstSentence = description.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? description.trim();
  return firstSentence.length <= DESCRIPTION_LIMIT
    ? firstSentence
    : `${firstSentence.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
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
