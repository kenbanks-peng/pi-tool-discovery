import { describe, expect, test } from "bun:test";
import toolDiscovery from "../src/index.ts";

interface HandlerMap {
  session_start?: (event: unknown, ctx: unknown) => Promise<void>;
  before_agent_start?: () => void;
}

function createPi(initialActive = ["read", "search_issues", "deploy_preview", "discover_tools"]) {
  const active = [...initialActive];
  const handlers: HandlerMap = {};
  let discoveryTool: any;
  const tools = [
    { name: "read", description: "Read files.", parameters: {}, sourceInfo: { source: "builtin" } },
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
    fixture.handlers.before_agent_start?.();

    expect(fixture.active).toEqual(["read", "discover_tools"]);
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
    fixture.handlers.before_agent_start?.();
    await fixture.getDiscoveryTool().execute("call", { request: "deploy preview" });

    expect(fixture.active).toEqual(["read", "discover_tools", "deploy_preview"]);
    const result = await fixture.getDiscoveryTool().execute("call", { request: "deploy preview" });
    expect(result.details).toEqual({ matches: ["deploy_preview"], activated: [], alreadyActive: ["deploy_preview"] });
  });

  test("keeps Pi-disabled tools out of the deferred set", async () => {
    const fixture = createPi(["read", "search_issues", "discover_tools"]);
    toolDiscovery(fixture.pi as never);
    await fixture.handlers.session_start?.({}, sessionContext("test-disabled"));
    fixture.handlers.before_agent_start?.();

    const result = await fixture.getDiscoveryTool().execute("call", { request: "deploy preview" });
    expect(result.details).toEqual({ matches: [], activated: [], alreadyActive: [] });
  });
});
