import { expect, test } from "bun:test";
import { createDiscoverableTools, injectDiscoverableTools } from "../src/discoverable-tools.ts";

const tool = {
  name: "search_issues",
  description: "Search GitHub issues by keyword and state. Supports repository filters.",
  parameters: { type: "object", properties: { query: { type: "string" } } },
  promptGuidelines: ["Use search_issues to find GitHub issues."],
  sourceInfo: { source: "extension" },
};

test("returns a compact tool index without file pointers", async () => {
  const section = await createDiscoverableTools([tool], "test/session");

  expect(section).toContain("<tool_discovery>");
  expect(section).toContain('  <tool\n    name="search_issues"');
  expect(section).toContain('    description="Search GitHub issues by keyword and state."');
  expect(section).toContain("Call activate_tool with the exact name");
  expect(section).not.toContain("location=");
  expect(section).not.toContain("Read a tool file at its location");
});

test("places tool discovery below the tools section", () => {
  const prompt = "<tools>\n  <tool name=\"read\" />\n</tools>\n\n<instructions>Use tools safely.</instructions>";
  const section = "<tool_discovery>\n  <tool name=\"search_issues\" />\n</tool_discovery>";

  expect(injectDiscoverableTools(prompt, section)).toBe(
    "<tools>\n  <tool name=\"read\" />\n</tools>\n\n<tool_discovery>\n  <tool name=\"search_issues\" />\n</tool_discovery>\n\n<instructions>Use tools safely.</instructions>",
  );
});
