import { describe, expect, test } from "bun:test";
import toolDiscovery from "../src/index.ts";

interface HandlerMap {
  session_start?: (event: unknown, ctx: unknown) => Promise<void>;
  before_agent_start?: (event: { systemPrompt: string }) => Promise<{ systemPrompt: string }>;
}

const baseSystemPrompt = `Available tools:
- read: Read files.
- discover_tools: Find tools.

In addition to the tools above, you may have access to other custom tools depending on the project.`;

function createPi(initialActive = ["read", "bash", "search_issues", "deploy_preview", "discover_tools"]) {
  const active = [...initialActive];
  const handlers: HandlerMap = {};
  let discoveryTool: any;
  const tools = [
    { name: "read", description: "Read files.", parameters: {}, sourceInfo: { source: "builtin" } },
    { name: "bash", description: "Run shell commands.", parameters: {}, sourceInfo: { source: "builtin" } },
    { name: "search_issues", description: "Search GitHub issues by keyword.", parameters: {}, sourceInfo: { source: "extension" } },
    { name: "deploy_preview", description: "Deploy a preview environment.", parameters: {}, sourceInfo: { source: "extension" } },
  ];
  const pi = {
    registerTool(tool: any) { discoveryTool = tool; },
    on(name: keyof HandlerMap, handler: HandlerMap[keyof HandlerMap]) { handlers[name] = handler as never; },
    getAllTools() { return [...tools, { name: "discover_tools", description: "Discover tools.", parameters: {}, sourceInfo: { source: "extension" } }]; },
    getActiveTools() { return [...active]; },
    setActiveTools(names: string[]) { active.splice(0, active.length, ...names); },
  };
  return { pi, active, tools, handlers, getDiscoveryTool: () => discoveryTool };
}

const sessionContext = (id: string) => ({
  cwd: `/test/project/${id}`,
  isProjectTrusted: () => false,
  sessionManager: { getSessionId: () => id },
  ui: { notify: () => {} },
});

describe("tool discovery extension", () => {
  test("defers eligible tools at session start and gives clear discovery guidance", async () => {
    const fixture = createPi();
    toolDiscovery(fixture.pi as never);
    await fixture.handlers.session_start?.({}, sessionContext("test-session"));
    const prompt = await fixture.handlers.before_agent_start?.({ systemPrompt: baseSystemPrompt });

    expect(fixture.active).toEqual(["read", "discover_tools"]);
    expect(prompt?.systemPrompt).toContain("<discoverable_tools>");
    expect(prompt?.systemPrompt).toContain('name="bash"');
    expect(prompt?.systemPrompt).toContain('name="search_issues"');
    expect(prompt?.systemPrompt).toContain('description="Search GitHub issues by keyword."');
    expect(prompt?.systemPrompt).toMatch(/location=".*pi-tool-discovery\//);
    expect(prompt?.systemPrompt).toContain("Read a tool file at its location before you activate or call that tool.");
    expect(prompt?.systemPrompt.indexOf("<discoverable_tools>")).toBeLessThan(
      prompt?.systemPrompt.indexOf("In addition to the tools above") ?? 0,
    );
    expect(fixture.getDiscoveryTool().promptSnippet)
      .toBe("Find progressively disclosed tools when active tools cannot do the required work");
    expect(fixture.getDiscoveryTool().promptGuidelines)
      .toEqual(["Call discover_tools for a required capability when the active tools cannot do the work. It activates matching tools for the next response."]);

    const result = await fixture.getDiscoveryTool().execute("call", { request: "find GitHub issues" });
    expect(result.details).toEqual({ matches: ["search_issues"], activated: ["search_issues"], alreadyActive: [] });
    expect(fixture.active).toEqual(["read", "discover_tools", "search_issues"]);
  });

  test("keeps discovered tools active and loads matching tools additively", async () => {
    const fixture = createPi();
    toolDiscovery(fixture.pi as never);
    await fixture.handlers.session_start?.({}, sessionContext("test-later-start"));
    await fixture.handlers.before_agent_start?.({ systemPrompt: baseSystemPrompt });
    await fixture.getDiscoveryTool().execute("call", { request: "deploy preview" });

    expect(fixture.active).toEqual(["read", "discover_tools", "deploy_preview"]);
    const result = await fixture.getDiscoveryTool().execute("call", { request: "deploy preview" });
    expect(result.details).toEqual({ matches: ["deploy_preview"], activated: [], alreadyActive: ["deploy_preview"] });
  });

  test("keeps Pi-disabled tools out of the deferred set", async () => {
    const fixture = createPi(["read", "search_issues", "discover_tools"]);
    toolDiscovery(fixture.pi as never);
    await fixture.handlers.session_start?.({}, sessionContext("test-disabled"));
    await fixture.handlers.before_agent_start?.({ systemPrompt: baseSystemPrompt });

    const result = await fixture.getDiscoveryTool().execute("call", { request: "deploy preview" });
    expect(result.details).toEqual({ matches: [], activated: [], alreadyActive: [] });
  });
});
