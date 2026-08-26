# Plan: General Tool Discovery and Ranking

## Goal

Select deferred tools from arbitrary Pi tool metadata without loading all tool schemas into the initial model context.

The solution must not contain rules for a known tool set. It must work when tools, names, descriptions, schemas, and sources change.

## Current Design

- `src/index.ts` removes eligible non-built-in tools from Pi's active tool list at session start.
- `src/discoverable-tools.ts` writes full metadata to private session files and injects a compact catalog into the system prompt.
- `discover_tools` in `src/index.ts` calls `findMatchingTools()`.
- `src/core.ts` ranks tools with simple token overlap on the tool name and description.
- The top match is activated without a confidence check.

The deferral behavior must stay. It prevents all deferred tool schemas from entering the first model request.

## Non-Goals

- Do not hard-code tool names, aliases, tool families, vendors, or task examples.
- Do not use the current local tool set as a relevance benchmark.
- Do not add all deferred schemas to the initial system prompt.
- Do not remove Pi dynamic activation. Pi must still expose a selected schema only after the loader activates that tool.
- Do not make an uncertain automatic selection.

## Required Behavior

1. Build each searchable record only from `ToolMetadata`:
   - `name`
   - `label`, if present
   - `description`
   - `promptGuidelines`, if present
   - JSON Schema parameter names, descriptions, types, and enum values
   - source metadata only when it is useful as a neutral ranking field
2. Rank a natural-language request against these records.
3. Activate exactly one tool only when the ranker has enough evidence.
4. When the choice is uncertain, return ranked candidates and do not change the active tool list.
5. Preserve the existing tool-file catalog as the agent verification path. The agent can read a candidate file, then make a more precise discovery request.
6. Preserve additive activation so that Pi can use native deferred loading where it is available.

## Design

### 1. Catalog builder

Create a pure catalog builder, for example `buildToolSearchRecords(tools)`, in a new module such as `src/search.ts`.

Each record must retain the original `ToolMetadata` and contain normalized searchable fields. Extract schema text recursively and deterministically. Do not serialize irrelevant schema keywords as search text.

Use field boundaries. A match in a concise name or label is more specific than a match in a long parameter description, but the weights must be generic constants, not tool-specific rules.

### 2. Hybrid candidate retrieval

Use two independent generic retrieval methods:

- **Lexical retrieval** for identifiers, exact terms, and uncommon words.
- **Semantic retrieval** for paraphrases and different wording.

Merge their candidate sets, then rerank only that bounded set using the complete record fields.

The semantic provider must be an interface, not a fixed implementation:

```ts
interface SemanticSearch {
  index(records: ToolSearchRecord[]): Promise<void>;
  search(query: string, limit: number): Promise<SemanticMatch[]>;
}
```

Provide these implementations in stages:

- A lexical-only implementation that always works with no network, model, or optional package.
- An optional local embedding implementation behind the interface.
- No remote embedding implementation unless configuration explicitly enables it. Remote embedding can expose tool descriptions and user task text.

The extension must use lexical retrieval when semantic search is unavailable or fails.

### 3. Ranking and confidence

Return a structured result, not only an ordered tool array:

```ts
interface ToolSearchResult {
  candidates: Array<{ tool: ToolMetadata; score: number; lexicalScore: number; semanticScore?: number }>;
  decision: "activate" | "disambiguate" | "no_match";
  reason: "high_confidence" | "low_score" | "close_scores" | "no_candidates";
}
```

Use generic confidence rules:

- Require a minimum relevance score.
- Require a minimum difference between first and second candidate.
- Treat one strong exact match as high confidence only when there is no competing result.
- Treat a short, generic, or weak query as ambiguous.
- Limit candidate output to a small fixed count.

Keep all thresholds in one configuration object. Add diagnostics to `details` so tests and future tuning can inspect the decision.

### 4. Loader behavior

Update `discover_tools` in `src/index.ts` to consume `ToolSearchResult`.

- For `activate`, add only the selected inactive tool with `pi.setActiveTools()`.
- For `disambiguate`, return candidate names and short descriptions. Do not activate a tool.
- For `no_match`, return a clear no-match result.
- Keep the result text short. Keep scores and decision data in `details`.

Do not return a schema as ordinary result text. Pi provides the real callable schema after activation.

### 5. Prompt and tool-file behavior

Keep `<tool_discovery>` and tool files in the first version.

Change the instruction so it is accurate for both flows:

- The agent may call `discover_tools` with a precise task request.
- When the loader reports ambiguous candidates, the agent must read the selected candidate file before it requests activation.
- The agent must not call an inactive tool.

This reduces unnecessary reads for high-confidence requests while retaining an explicit verification route for uncertain requests.

## Configuration

Extend `tool-discovery.toml` only after the core behavior has tests.

Possible generic settings:

```toml
[search]
semantic = "off" # "off" | "local"
minimum_score = 0.0
minimum_margin = 0.0
candidate_limit = 3
```

Do not expose values until their semantics and safe defaults are defined. Configuration must remain optional. Project configuration remains subject to the existing project-trust rule.

## Evaluation Before Tuning

Do not tune against the tools installed in one development session.

Create a synthetic evaluation fixture with many unrelated tool records. Vary:

- names that are descriptive and names that are opaque;
- short and long descriptions;
- overlapping descriptions;
- parameter-only distinctions;
- exact requests, paraphrases, broad requests, and no-match requests;
- one clear winner and several equally plausible winners.

Each fixture case must specify the expected decision class: `activate`, `disambiguate`, or `no_match`. It must not require an exact score.

Use this fixture to compare lexical-only and semantic-enabled modes. Select default thresholds from aggregate precision and ambiguity behavior, not from individual current tools.

## Implementation Steps

1. Add domain types for search records, candidates, decisions, and diagnostics.
2. Extract generic schema text from `ToolMetadata.parameters`.
3. Move current token logic from `src/core.ts` into a lexical retriever. Preserve it as the baseline fallback.
4. Implement bounded lexical ranking with field-aware scoring and phrase matching.
5. Add the semantic-search interface. Keep the initial production default lexical-only.
6. Add an optional local semantic implementation only after dependency size, model delivery, startup time, offline behavior, and cache location are decided.
7. Implement hybrid merge and generic confidence decisions.
8. Replace `findMatchingTools()` use in `src/index.ts` with the structured search result.
9. Change `discover_tools` result text and `details` for activation, disambiguation, and no-match cases.
10. Update the injected tool-discovery instruction in `src/discoverable-tools.ts`.
11. Add optional, validated configuration only when it is needed for a deployed ranker.
12. Update `README.md` with the discovery lifecycle, privacy behavior, fallback behavior, and configuration.

## Tests

Add unit tests for:

- metadata extraction from names, descriptions, guidelines, and nested schemas;
- deterministic lexical ranking;
- candidate merge and reranking;
- high-confidence activation;
- low-score no-match;
- close-score disambiguation;
- empty and generic requests;
- failure of the optional semantic provider with lexical fallback;
- arbitrary synthetic catalogs rather than the current tool list.

Update extension tests for:

- no change to deferred-tool behavior at session start;
- additive activation on a high-confidence decision;
- no active-tool change for disambiguation;
- candidate data in loader result details;
- accurate prompt instructions.

Run:

```sh
bun run typecheck
bun test
```

## Acceptance Criteria

- The initial model context excludes deferred tool schemas.
- The ranker uses only metadata supplied by the current deferred-tool catalog.
- No tool names or task categories are special cases in production ranking code.
- An uncertain request cannot activate a tool.
- A known semantic component failure does not stop lexical discovery.
- The agent can inspect a candidate tool file and retry with a precise request.
- Test data contains tool catalogs that do not match the developer's current installed tools.
