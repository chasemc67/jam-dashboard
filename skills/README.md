# Vendored skills

Agents must read [`typesafe-ai/SKILL.md`](typesafe-ai/SKILL.md) before changing the Jev integration, including prompts, question shapes, or Gateway wiring. The skill is vendored from [typesafe-ai/skills](https://github.com/typesafe-ai/skills) (copied from [Jevis](https://github.com/chasemc67/Jevis/tree/main/skills)), with its [MIT license](typesafe-ai/LICENSE) preserved.

Live documentation at [docs.typesafe.ai](https://docs.typesafe.ai) remains the source of truth; use the [documentation index](https://docs.typesafe.ai/llms.txt) to find current guidance.

**Jam Dashboard uses Jev through Vercel AI Gateway model `typesafe-ai/jev`, with the same Gateway credential as Agent chat and voice (`AI_GATEWAY_API_KEY`, or the desktop app's Keychain key). Never call the TypeSafe API directly from this project.** The integration lives in [`app/agent/jev.ts`](../app/agent/jev.ts) (questions, parsing, confidence gate), [`app/agent/jev.server.ts`](../app/agent/jev.server.ts) (the `/api/agent-jev` Gateway call), and [`app/agent/jev-filter.ts`](../app/agent/jev-filter.ts) (Agent Chat's Jev voice mode).
