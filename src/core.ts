export interface ToolMetadata {
  name: string;
  description: string;
  parameters: unknown;
  promptGuidelines?: string[];
  sourceInfo: { source: string };
  [key: string]: unknown;
}

const DISCOVERY_TOOL_NAME = "discover_tools";

export function selectDeferredTools(tools: ToolMetadata[]): ToolMetadata[] {
  return tools.filter(
    (tool) => tool.name !== DISCOVERY_TOOL_NAME && tool.sourceInfo.source !== "builtin",
  );
}

export function selectActiveDeferredTools(
  tools: ToolMetadata[],
  activeNames: Set<string>,
  directNames: Set<string>,
): ToolMetadata[] {
  return selectDeferredTools(tools).filter(
    (tool) => activeNames.has(tool.name) && !directNames.has(tool.name),
  );
}

const GENERIC_TERMS = new Set([
  "tool", "tools", "capability", "capabilities", "need", "needs", "needed",
  "use", "using", "find", "help", "with",
]);

function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((term) => term.length >= 3 && !GENERIC_TERMS.has(term));
}

function matchScore(requestTerms: string[], searchable: string[], exactWeight: number, partialWeight: number): number {
  return requestTerms.reduce((total, term) => {
    if (searchable.some((candidate) => candidate === term)) return total + exactWeight;
    if (searchable.some((candidate) => candidate.startsWith(term) || term.startsWith(candidate))) return total + partialWeight;
    return total;
  }, 0);
}

function score(requestTerms: string[], tool: ToolMetadata): number {
  // Tool names are concise capability labels. Give them priority over long,
  // often overlapping descriptions so that "search the web" selects web_search,
  // not a tool that merely mentions search in its usage notes.
  const nameTerms = terms(tool.name.replaceAll("_", " "));
  const descriptionTerms = terms(tool.description);
  return matchScore(requestTerms, nameTerms, 10, 5)
    + matchScore(requestTerms, descriptionTerms, 2, 1);
}

export function findMatchingTools(request: string, tools: ToolMetadata[]): ToolMetadata[] {
  const requestTerms = terms(request);
  if (requestTerms.length === 0) return [];
  return tools
    .map((tool) => ({ tool, score: score(requestTerms, tool) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .map((match) => match.tool);
}
