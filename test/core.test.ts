import { expect, test } from "bun:test";
import {
  findMatchingTools,
  selectActiveDeferredTools,
  selectDeferredTools,
  type ToolMetadata,
} from "../src/core.ts";

const tools: ToolMetadata[] = [
  { name: "search_issues", description: "Search GitHub issues by keyword and state.", parameters: { type: "object", properties: { query: { type: "string" } } }, sourceInfo: { source: "extension" } },
  { name: "deploy_preview", description: "Deploy the current project to a preview environment.", parameters: { type: "object", properties: {} }, sourceInfo: { source: "extension" } },
  { name: "read", description: "Read a file.", parameters: {}, sourceInfo: { source: "builtin" } },
  { name: "discover_tools", description: "Find deferred tools.", parameters: {}, sourceInfo: { source: "extension" } },
  { name: "sdk_tool", description: "Run an SDK capability.", parameters: {}, sourceInfo: { source: "sdk" } },
];

test("selects only eligible active non-direct tools", () => {
  expect(selectDeferredTools(tools)).toEqual([tools[0], tools[1], tools[4]]);
  expect(selectActiveDeferredTools(tools, new Set(tools.map((tool) => tool.name)), new Set(["search_issues"])))
    .toEqual([tools[1], tools[4]]);
});

test("matches tool requests against tool names and descriptions", () => {
  expect(findMatchingTools("find GitHub tickets", tools.slice(0, 2))).toEqual([tools[0]]);
  expect(findMatchingTools("transcode a video", tools.slice(0, 2))).toEqual([]);
});
