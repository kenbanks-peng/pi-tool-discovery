import { describe, expect, test } from "bun:test";
import toolDiscovery from "../src/index.ts";

interface HandlerMap {
  session_start?: (event: unknown, ctx: unknown) => Promise<void>;
  before_agent_start?: (event: { systemPrompt: string }) => Promise<{ systemPrompt: string }>;
}

const baseSystemPrompt = `Available tools:
- read: Read files.
- activate_tool: Activate an inactive tool.

In addition to the tools above, you may have access to other custom tools depending on the project.`;

function createPi(initialActive = ["read", "bash", "search_issues", "search_comments", "deploy_preview", "activate_tool"]) {
  const active = [...initialActive];
  const handlers: HandlerMap = {};
  let activationTool: any;
  const tools = [
    { name: "read", description: "Read files.", parameters: {}, sourceInfo: { source: "builtin" } },
    { name: "bash", description: "Run shell commands.", parameters: {}, sourceInfo: { source: "builtin" } },
    { name: "search_issues", description: "Search GitHub issues by keyword.", parameters: {}, sourceInfo: { source: "extension" } },
    { name: "search_comments", description: "Search GitHub comments by keyword.", parameters: {}, sourceInfo: { source: "extension" } },
    { name: "deploy_preview", description: "Deploy a preview environment.", parameters: {}, sourceInfo: { source: "extension" } },
  ];
  const pi = {
    registerTool(tool: any) { activationTool = tool; },
    on(name: keyof HandlerMap, handler: HandlerMap[keyof HandlerMap]) { handlers[name] = handler as never; },
    getAllTools() { return [...tools, { name: "activate_tool", description: "Activate a tool.", parameters: {}, sourceInfo: { source: "extension" } }]; },
    getActiveTools() { return [...active]; },
    setActiveTools(names: string[]) { active.splice(0, active.length, ...names); },
  };
  return { pi, active, tools, handlers, getActivationTool: () => activationTool };
}

const sessionContext = (id: string) => ({
  cwd: `/test/project/${id}`,
  isProjectTrusted: () => false,
  sessionManager: { getSessionId: () => id },
  ui: { notify: () => {} },
});

describe("tool discovery extension", () => {
  test("defers eligible tools and provides names and descriptions", async () => {
    const fixture = createPi();
    toolDiscovery(fixture.pi as never);
    await fixture.handlers.session_start?.({}, sessionContext("test-session"));
    const prompt = await fixture.handlers.before_agent_start?.({ systemPrompt: baseSystemPrompt });

    expect(fixture.active).toEqual(["read", "bash", "activate_tool"]);
    expect(prompt?.systemPrompt).toContain("<tool_discovery>");
    expect(prompt?.systemPrompt).not.toContain('name="bash"');
    expect(prompt?.systemPrompt).toContain('name="search_issues"');
    expect(prompt?.systemPrompt).toContain('description="Search GitHub issues by keyword."');
    expect(prompt?.systemPrompt).not.toContain("location=");
    expect(prompt?.systemPrompt).toContain("Here are tools available for use after they are activated using activate_tool.");
    expect(fixture.getActivationTool().description).toBe("Activate one deferred tool by name.");
    expect(fixture.getActivationTool().promptSnippet).toBe("Activate one deferred tool by name.");
    expect(fixture.getActivationTool().promptGuidelines).toEqual([
      "Call activate_tool when an inactive tool is needed. Set name to the tool name shown in <tool_discovery>. It activates that tool for the next response.",
    ]);

    const result = await fixture.getActivationTool().execute("call", { name: "search_issues" });
    expect(result.details).toEqual({ activated: ["search_issues"], alreadyActive: [] });
    expect(fixture.active).toEqual(["read", "bash", "activate_tool", "search_issues"]);
  });

  test("activates only the named tool", async () => {
    const fixture = createPi();
    toolDiscovery(fixture.pi as never);
    await fixture.handlers.session_start?.({}, sessionContext("test-single-activation"));
    await fixture.handlers.before_agent_start?.({ systemPrompt: baseSystemPrompt });

    const result = await fixture.getActivationTool().execute("call", { name: "search_comments" });
    expect(result.details).toEqual({ activated: ["search_comments"], alreadyActive: [] });
    expect(fixture.active).toEqual(["read", "bash", "activate_tool", "search_comments"]);
  });

  test("keeps activated tools active", async () => {
    const fixture = createPi();
    toolDiscovery(fixture.pi as never);
    await fixture.handlers.session_start?.({}, sessionContext("test-later-start"));
    await fixture.handlers.before_agent_start?.({ systemPrompt: baseSystemPrompt });
    await fixture.getActivationTool().execute("call", { name: "deploy_preview" });

    expect(fixture.active).toEqual(["read", "bash", "activate_tool", "deploy_preview"]);
    const result = await fixture.getActivationTool().execute("call", { name: "deploy_preview" });
    expect(result.details).toEqual({ activated: [], alreadyActive: ["deploy_preview"] });
  });

  test("does not activate disabled or unknown tools", async () => {
    const fixture = createPi(["read", "search_issues", "activate_tool"]);
    toolDiscovery(fixture.pi as never);
    await fixture.handlers.session_start?.({}, sessionContext("test-disabled"));
    await fixture.handlers.before_agent_start?.({ systemPrompt: baseSystemPrompt });

    const result = await fixture.getActivationTool().execute("call", { name: "deploy_preview" });
    expect(result.details).toEqual({ activated: [], alreadyActive: [] });
  });
});
