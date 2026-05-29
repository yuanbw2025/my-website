# AI Visual Patterns Development Plan

## Vision

Turn this fork from a GPT-Image2 case gallery into a practical image-generation learning site:

- Learn from imported high-quality cases.
- Understand reusable scene slots.
- Build prompts from structured templates.
- Diagnose bad outputs and repair prompts.
- Package the same knowledge as an Agent Skill for Codex, Claude Code, and Cursor.

## Product Positioning

Chinese name: AI 视觉场景库

English name: AI Visual Patterns

One-line description: 中文 AI 图像案例、提示词槽位与场景模板库 / Chinese AI image cases, prompt slots, and visual scene templates.

## Reference Projects Reviewed

### awesome-gpt-image-2

Useful parts to keep:

- Large visual case library with real prompts and category covers.
- Gallery-first browsing experience.
- Existing Agent Skill packaging path.
- Generated `cases.json` and `style-library.json` pipeline.

Limits to improve:

- Case browsing is useful, but users still need guidance on how to adapt a case to their own task.
- Template knowledge is not yet exposed as a strong learning path on the website.
- The current Skill is more of a style/template selector than a full prompt coaching workflow.

### ConardLi/garden-skills gpt-image-2

Useful parts to absorb:

- Runtime mode design: local API generation, host-native image tool delegation, and prompt-only advisor mode.
- `references/` organized by category folders and one template per Markdown file.
- Structured template documents with usage scope, missing-information questions, JSON prompt template, parameter strategy, auto-fill strategy, variants, and avoid list.
- Scripts for mode detection, generation, editing, shared environment loading, and output saving.
- Explicit prompt/image saving rules for later review and reuse.
- Broader template coverage: academic figures, UI mockups, product visuals, maps, technical diagrams, storyboards, editing workflows, avatars, branding, slides, infographics, and more.

Limits to avoid:

- It is Skill-first, not website-first. We should not turn this project into only a command-line/agent package.
- Its templates are powerful but long. The website needs progressive disclosure: simple scene cards first, full template detail second.
- Its Garden local generation mode is useful later, but should not become a blocker for the current no-API learning site.

## Product Shape

The site should have three layers:

1. Case Gallery: users see what good results look like.
2. Scene Guide: users pick a task type, fill required slots, and get a usable prompt.
3. Template Academy: users learn why a prompt works, what fields matter, what mistakes cause bad images, and how to repair them.

The Agent Skill should share the same data source with the website, so the website teaches humans and the Skill assists agents with the same scene/template knowledge.

## Phase 1 - Current Foundation

- Preserve the original case gallery as the visual evidence base.
- Add a Guide / Builder section before the gallery.
- Add structured Chinese creator scenes.
- Add a Prompt Builder that fills scene slots and outputs copyable prompts.
- Add a Failure Diagnosis section for common bad image patterns.
- Keep source attribution and upstream license information visible.
- Default the website to Chinese on first open, while preserving manual language switching.

## Phase 2 - Website Learning Depth

- Expand scene templates to 30+ Chinese creator scenarios.
- Add model suitability notes for GPT Image, Midjourney, 即梦, 通义万相, Flux, and Stable Diffusion.
- Add before/after repair examples.
- Add a full template detail page for each scene:
  - when to use
  - when not to use
  - missing information question order
  - slot explanation
  - JSON prompt structure
  - auto-fill strategy
  - variants
  - avoid list
- Add “copy as natural prompt”, “copy as JSON”, and “copy as Agent task” output modes.
- Add a case-to-template mapping: each case should suggest the closest scene templates and reusable slots.
- Add a small learning path: Beginner, Creator, E-commerce, Education, Technical Diagram, Storyboard.

## Phase 3 - Data And Skill System

- Create a dedicated `ai-visual-patterns` Skill instead of only extending `gpt-image-2-style-library`.
- Let agents select scene templates, ask missing slot questions, diagnose outputs, and generate multi-model prompts.
- Add an exportable prompt pack for other projects such as YunType, AI Slides, StoryForge, and AI Visual Exploration Book.
- Split template data into a maintainable structure:
  - `src/data/visual-guides.json` for website cards and builder.
  - `data/templates/*.json` or `data/templates/*/*.md` for detailed template academy content.
  - generated Skill reference files for agent consumption.
- Add a script that generates Skill references from the same template data.
- Add prompt save/export conventions so generated prompts can be kept, compared, and reused.

## Phase 4 - Optional Generation Workflow

This phase is optional because the project can stay useful without an image API.

- Add local generation only behind explicit configuration:
  - `ENABLE_IMAGEGEN=1`
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `OPENAI_IMAGE_MODEL`
- Support three runtime modes:
  - Local API mode: generate images and save outputs.
  - Host-native mode: pass the prompt to the user's image tool.
  - Advisor mode: only produce high-quality prompts and guidance.
- Add image-editing workflows later: background replacement, product retouching, object removal, local edit, and reference-image adaptation.

## Near-Term Development Checklist

- Make first-open language Chinese by default.
- Build a `Template Academy` section on the website.
- Convert 8 current scene cards into detailed templates.
- Add at least 20 more Chinese creator scenarios.
- Add a template detail modal/page.
- Add copy modes: natural prompt, JSON prompt, agent task.
- Add source attribution blocks for imported upstream cases.
- Add `ai-visual-patterns` Skill skeleton.
- Add a generator script for Skill references.
- Keep build verification as the minimum release gate.

## Review Notes

- Imported cases remain credited to upstream sources.
- New guidance content should be original and Chinese-creator focused.
- Images from upstream are used as seed examples first, then replaced gradually by self-generated images.
- The site should teach users how to think, not only provide copyable prompts.
