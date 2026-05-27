# Promo Video Maker TODO

## Product Direction

- Keep the project as a desktop-first Electron tool, with the independent repository as the development source of truth.
- Focus on a low-effort workflow for project promotion videos: screenshots plus scripts in, narrated MP4 out.
- Avoid turning it into a general video editor. The product should stay optimized for lazy, repeatable project demos.

## Near-Term Work

- Add project save/load so users can reopen a video draft later.
- Add template presets for Bilibili, Douyin, Xiaohongshu, and GitHub project intros.
- Add subtitle style controls: font size, position, background opacity, and text color.
- Add voiceover provider abstraction so macOS `say` can be replaced or supplemented by cloud TTS later.
- Add export progress reporting from Electron to the React interface.
- Add one-click output folder reveal after MP4 export.

## Later Work

- Package signed desktop installers for macOS first, then Windows.
- Add optional title card and ending card generation.
- Add batch import from a folder of screenshots.
- Add reusable brand presets for project name, logo, colors, and intro wording.
- Add an optional AI script helper that drafts narration from screenshot notes.
