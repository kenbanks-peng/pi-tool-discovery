import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ToolMetadata } from "./core.ts";

const DESCRIPTION_LIMIT = 120;

/** Write complete callable metadata outside the prompt and return its prompt index. */
export async function createDiscoverableTools(
  tools: ToolMetadata[],
  sessionId: string,
): Promise<string> {
  if (tools.length === 0) return "";

  const directory = join(cacheDirectory(), "pi-tool-discovery", `session-${shortHash(sessionId)}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });

  const entries = await Promise.all(tools.map(async (tool) => {
    const location = join(directory, `${safeFileStem(tool.name)}.md`);
    await writeFile(location, formatToolFile(tool), { encoding: "utf8", mode: 0o600 });
    return [
      "  <tool",
      `    name="${escapeXml(tool.name)}"`,
      `    description="${escapeXml(shortDescription(tool.description))}"`,
      `    location="${escapeXml(location)}"`,
      "  />",
    ].join("\n");
  }));

  return `<tool_discovery>
Read a tool file at its location before you activate or call that tool. The file has its complete description and parameter schema.
${entries.join("\n")}
</tool_discovery>`;
}

export function injectDiscoverableTools(systemPrompt: string, discoverableTools: string): string {
  if (!discoverableTools || systemPrompt.includes("<tool_discovery>")) return systemPrompt;

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

function formatToolFile(tool: ToolMetadata): string {
  const guidelines = tool.promptGuidelines?.length
    ? `\n\n## Guidelines\n\n${tool.promptGuidelines.map((guideline) => `- ${guideline}`).join("\n")}`
    : "";
  return `# ${tool.name}\n\n## Description\n\n${tool.description}\n\n## Parameters\n\n\`\`\`json\n${JSON.stringify(tool.parameters, null, 2)}\n\`\`\`${guidelines}\n`;
}

function shortDescription(description: string): string {
  const firstSentence = description.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? description.trim();
  return firstSentence.length <= DESCRIPTION_LIMIT
    ? firstSentence
    : `${firstSentence.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function cacheDirectory(): string {
  return process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
}

function safeFileStem(value: string): string {
  if (/^[A-Za-z0-9._-]+$/.test(value)) return value;

  const readable = value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "tool";
  return `${readable}-${shortHash(value)}`;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
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
