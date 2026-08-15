# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0-beta] - 2026-08-15

### Bug Fixes

- Correct duplicate closing div in Customize tab markup of WelcomeScreen - ([6257ac8](https://github.com/Hephaestus-Studio/aether-api/commit/6257ac8386558583a69d2a07de5735562a741647))
- Use relative calc variables for footer copyright, version, and card subtitles in CSS - ([ab65c9d](https://github.com/Hephaestus-Studio/aether-api/commit/ab65c9d98c88349bf733b5fa0bf91f3ff11e1e50))
- Migrate all hardcoded font sizes across workspace CSS modules to use relative UI variables - ([e068199](https://github.com/Hephaestus-Studio/aether-api/commit/e068199f82bcea0f95d14a7fc1b063e9a09a7e8e))
- Resolve monaco editor lifecycle dispose issue and stabilize response tab view - ([d465ac7](https://github.com/Hephaestus-Studio/aether-api/commit/d465ac761fdd2bc673eac1bc180f2fd791d4e832))
- _(terminal)_ Buffer startup prompt output, handle exit process, and polish tab styling - ([51f9cde](https://github.com/Hephaestus-Studio/aether-api/commit/51f9cde07a44302f661f34d3b1757514921a5182))
- _(response)_ Fix collision detection and tab collapse in ResponseViewer - ([7a77b1c](https://github.com/Hephaestus-Studio/aether-api/commit/7a77b1c6c7bb4112d454651857597b3066e4f37a))
- _(editor)_ Make Monaco editor in BodyEditor fit full height - ([a99df38](https://github.com/Hephaestus-Studio/aether-api/commit/a99df383e3cbb566bb31403a7b46aaa54530cff1))
- _(ui)_ Fix URL variable caret offset and redesign explorer tree layout - ([c8a2af9](https://github.com/Hephaestus-Studio/aether-api/commit/c8a2af962d1f29b5bfc0c0df87d3838ba87bc08f))
- _(response)_ Support pretty copy and fix raw mode content display in Monaco editor - ([8cfa483](https://github.com/Hephaestus-Studio/aether-api/commit/8cfa483e7c13b51394e9b25023152b4b80b844e2))
- Resolve empty pretty response body by computing formatted content with useMemo and syncing Monaco on ready - ([6448fb9](https://github.com/Hephaestus-Studio/aether-api/commit/6448fb96a44a2ae05491027e32eabe9ac5d6e954))
- Remove duplicate Format Document entry in Monaco context menu by using editor.addCommand - ([602f405](https://github.com/Hephaestus-Studio/aether-api/commit/602f40594318667cf8b96f728f029aca77750420))
- Ensure dark theme and background for Monaco editor in DocsEditor - ([b824df8](https://github.com/Hephaestus-Studio/aether-api/commit/b824df89dc46718021cfb76bafc9c04878fa52f8))
- Correct text response detection, folder save states, and body content caching - ([48cd290](https://github.com/Hephaestus-Studio/aether-api/commit/48cd290a684715eb4a092375ba244a1f90d1be90))

### Documentation

- Update README with custom banner and YAML format description - ([8226ae7](https://github.com/Hephaestus-Studio/aether-api/commit/8226ae7299056b19e6eac240098b95c75a5b5df4))
- _(changelog)_ Update CHANGELOG.md for v0.2.0-beta [skip ci] - ([3060baf](https://github.com/Hephaestus-Studio/aether-api/commit/3060baf08ae289c6db7516f3fa3e2fbf18d71a30))
- _(changelog)_ Update CHANGELOG.md for v0.2.0-beta [skip ci] - ([8276ef0](https://github.com/Hephaestus-Studio/aether-api/commit/8276ef05ffc6e6b5a69aa7d5749d7d18c721c9cd))

### Features

- Implement core API data models, error handling, and logger setup - ([4b574fe](https://github.com/Hephaestus-Studio/aether-api/commit/4b574fe40cf351480f72865703de182ce6e49135))
- _(engine)_ Add core request engine modules including HTTP client, variable resolver, yaml parser, fractional indexer, and fs scanner - ([22505ef](https://github.com/Hephaestus-Studio/aether-api/commit/22505ef2a0c151324a357a107e90af06ffd7817c))
- _(backend)_ Implement workspace, collection, request, environment commands and fs watcher with standard rustdoc comments - ([6342744](https://github.com/Hephaestus-Studio/aether-api/commit/6342744019798b4f1183317876e5be42c1aefb8f))
- Integrate tauri dialog plugin, dynamic collection creation, and VS Code-style Git status decorations in explorer - ([35dd39b](https://github.com/Hephaestus-Studio/aether-api/commit/35dd39b7d833535a20ee24b5222d431827e07a66))
- _(backend)_ Add tracing logs and enable terminal stdout output - ([fd43b02](https://github.com/Hephaestus-Studio/aether-api/commit/fd43b02d594bd153da56d672b3bd9b5f0cd351d5))
- Redesign explorer, request editor, and session restore - ([ef5bc60](https://github.com/Hephaestus-Studio/aether-api/commit/ef5bc600dc9ec4daef2feea1579fa3e7b7a84ed1))
- Standard UI redesign, multi-protocol selector, tauri timing metrics resolver & typography tokens unification - ([a3dca34](https://github.com/Hephaestus-Studio/aether-api/commit/a3dca34ad972362fb54d39d3549a82dc6f5e407c))
- Redesign workspace with side-by-side layout and integrate interactive terminal panel - ([72f5760](https://github.com/Hephaestus-Studio/aether-api/commit/72f5760c15ae529c88b7a6bdc3fbf5a64f061357))
- Redesign Welcome Screen using multi-window architecture with aligned dual-pane headers - ([620327d](https://github.com/Hephaestus-Studio/aether-api/commit/620327d2b515feebfeee83b40f92dfa70bef5c0b))
- Add minimum width and height to welcome window to protect layout responsiveness - ([cae322b](https://github.com/Hephaestus-Studio/aether-api/commit/cae322bcec0ed650020d039a6e65643fd4184ac3))
- Make welcome screen action buttons fully responsive to prevent crowding at minimum size - ([e0a1e7e](https://github.com/Hephaestus-Studio/aether-api/commit/e0a1e7eb56571724de2e6edb8e5602682fbc5524))
- Implement Zustand configStore and apply native OS & Monaco typography best practices - ([47ee6f1](https://github.com/Hephaestus-Studio/aether-api/commit/47ee6f17e469d88d70b932ce70f455ab19133e39))
- Enhance Welcome Screen responsiveness with grid card transformations and vertical settings rows - ([8a3d413](https://github.com/Hephaestus-Studio/aether-api/commit/8a3d413c6442fdf1e161cf7587faa2c3691f4420))
- Move Customize settings description to page header and expand aligned header heights to 72px - ([bfd2c64](https://github.com/Hephaestus-Studio/aether-api/commit/bfd2c64e0d2c1136cacf3d0b8f580e8eeeb896f0))
- Hide recentHeader when recents list is empty to prevent action redundancy - ([95feac0](https://github.com/Hephaestus-Studio/aether-api/commit/95feac072feb004af00ba53df03fe748d2f6addb))
- Move copyright footer from sidebar to right panel content footer - ([63be339](https://github.com/Hephaestus-Studio/aether-api/commit/63be339aaf401a2d45e19402a6a12fc8d1655533))
- Style welcome screen sidebar navigation items to match user design reference - ([f2ec0e0](https://github.com/Hephaestus-Studio/aether-api/commit/f2ec0e0167e1ecbefa6f6b855159fb0e73811343))
- Implement JetBrains-style typography scaling with separate UI and Editor font controls - ([bd58fc6](https://github.com/Hephaestus-Studio/aether-api/commit/bd58fc63687e7f9a586f7e518146bb10207fbe51))
- Align settings panel to a single column centered on the screen - ([c48041d](https://github.com/Hephaestus-Studio/aether-api/commit/c48041d598e9a58396ed95fb0c36ce4bd494525d))
- Change primary accent theme color from indigo/purple to blue - ([2699d07](https://github.com/Hephaestus-Studio/aether-api/commit/2699d076512348605bb78aca4e6e11e3d708ca3e))
- Drop light theme support completely and enforce dark theme across the entire application - ([ed0875d](https://github.com/Hephaestus-Studio/aether-api/commit/ed0875dec60a93a9c015f347ace908eab6764df4))
- _(editor)_ Redesign HTTP method selector dropdown with custom method support - ([08b0308](https://github.com/Hephaestus-Studio/aether-api/commit/08b03081511509cd44afb02e1854d819a6164bde))
- Add collision-aware responsive layouts, cleanup response body UI - ([e79c486](https://github.com/Hephaestus-Studio/aether-api/commit/e79c4860293638542d2981d6bd8232f95302e841))
- _(env)_ Improve environment management, layout fitting and placeholder resolution - ([137cbeb](https://github.com/Hephaestus-Studio/aether-api/commit/137cbeb16bd89630146f1fadd24481fa0dc293f5))
- _(terminal)_ Implement native multi-tab terminal with portable-pty and xterm.js - ([a653016](https://github.com/Hephaestus-Studio/aether-api/commit/a6530164ad42dcdcc7c6b3ef89f8b54e0bef0b9d))
- _(status)_ Add dynamic status code colors and fix tab collision detection - ([598d403](https://github.com/Hephaestus-Studio/aether-api/commit/598d403db5bbc841343d78df64fa726b9c34aa7c))
- _(ui)_ Refine sidebar, method selector, protocol menu and add drag-drop to params/headers - ([124fba1](https://github.com/Hephaestus-Studio/aether-api/commit/124fba179a1c7b8f2c0077c631e3cdbf2a4d4140))
- _(ui)_ Add outer window border for frameless app windows - ([4e6713e](https://github.com/Hephaestus-Studio/aether-api/commit/4e6713edaad959f8144c267b9f924806eb1740e8))
- _(response)_ Add wrap and unwrap lines toggle to response body editor - ([51f9173](https://github.com/Hephaestus-Studio/aether-api/commit/51f9173320621f86d1dcb71b245c658d0ca14fdd))
- _(ui/engine)_ Refine workspace layout, environment panel, and request execution - ([35a0b8f](https://github.com/Hephaestus-Studio/aether-api/commit/35a0b8f5ac88e93b01fe74c3bf13daf27bd7dc90))
- Add Code Snippet Generator, cURL paste import, and Auth editor UI improvements - ([3596428](https://github.com/Hephaestus-Studio/aether-api/commit/35964288ecb7c3b6dc66193c678eb75d3c22dec9))
- Add About dialog to Help menu - ([6715e0c](https://github.com/Hephaestus-Studio/aether-api/commit/6715e0c704cd9faae2ff8c486ea94fdb045a2d7c))
- Add binary body payload support, format context menu, undo/redo inputs, and Ctrl+S shortcut - ([0ec2ad8](https://github.com/Hephaestus-Studio/aether-api/commit/0ec2ad80a38d0f7978d8d232877fec344ad3c3bc))
- Auto open tab and switch focus on duplicate request - ([990c4a1](https://github.com/Hephaestus-Studio/aether-api/commit/990c4a1ef61015a26d643351d9c6cb30d8802f31))
- Implement keep-alive request tabs and fix body editor sync - ([3a7c262](https://github.com/Hephaestus-Studio/aether-api/commit/3a7c262347316ccb75c89b479e7c54fb51116562))
- Add unsaved changes modal, optimize editor performance, and fix sidebar & snippet bugs - ([9fb362f](https://github.com/Hephaestus-Studio/aether-api/commit/9fb362fb999dd88f2527d86ccb3030dfb05fe924))
- Redesign ParamsEditor and HeadersEditor with custom CSS modules, glowing drop indicators, and quick reorder buttons - ([81266e4](https://github.com/Hephaestus-Studio/aether-api/commit/81266e404c70dd082e2978941993b03ddb39a8c8))
- Apply unified table styles, micro drag preview, vibrant drop indicators, and quick reorder buttons to Environment Panel - ([62f3cf4](https://github.com/Hephaestus-Studio/aether-api/commit/62f3cf4eb25b5f1528f33d40d7a76e0ef1919ea9))
- Add Collection and Folder editor with Authorization and Headers inheritance - ([f200729](https://github.com/Hephaestus-Studio/aether-api/commit/f20072955892adb89fb50bcc0771a4735a409d05))
- Add rich Markdown Docs Editor with Edit, Split, and Preview modes - ([ea6933e](https://github.com/Hephaestus-Studio/aether-api/commit/ea6933ec27121e75248adc77151bf49bb66a4061))
- _(security)_ Implement in-memory master key with AES-256-GCM encryption and UX optimizations - ([b259658](https://github.com/Hephaestus-Studio/aether-api/commit/b259658bd1e7e2416e54ee0baa73a143763d670e))
- Add variable placeholder autocomplete, secret masking, and separate master key modals - ([3209404](https://github.com/Hephaestus-Studio/aether-api/commit/3209404d5bee02632b36ed4441bfc4406d35818f))
- _(ui)_ Configure minimum 1s display duration for splashscreen - ([c855507](https://github.com/Hephaestus-Studio/aether-api/commit/c855507c721cdeb8a84e7fec310ec2309ff8cb71))
- _(ui)_ Redesign about dialog, relocate env selector to titlebar, and add tab search (Ctrl+Shift+A) - ([b1ccaf3](https://github.com/Hephaestus-Studio/aether-api/commit/b1ccaf3bb7ee4085bfeb1dff39ded66223f8396f))

### Maintenance

- Init project - ([d88079a](https://github.com/Hephaestus-Studio/aether-api/commit/d88079a81fba0150598f75a3eb9263abafe46ac3))
- Setup project dependencies, permissions, and workspace configuration - ([7e655fe](https://github.com/Hephaestus-Studio/aether-api/commit/7e655fe75db633d7503129f8a8daef2af994289b))
- _(tauri)_ Resolve compiler warnings and clippy lints across backend modules - ([c3d1351](https://github.com/Hephaestus-Studio/aether-api/commit/c3d1351ef79f90d6d166d1b6f5646804994cefdc))
- Update node version to 24 and configure pnpm version for release workflow - ([b4f4a37](https://github.com/Hephaestus-Studio/aether-api/commit/b4f4a37388fbb327c5b2a6046565429801d59b9c))
- Fix multiple pnpm versions error by using package.json packageManager - ([9fa4540](https://github.com/Hephaestus-Studio/aether-api/commit/9fa4540e225fe1ea74c20afe8fd951366f71381c))

### Refactoring

- Remove redundant table headers and title labels in Params and Headers editors - ([c0c4fbd](https://github.com/Hephaestus-Studio/aether-api/commit/c0c4fbd3b5e6d8bafe4abfcb08d91fd9b765a5b8))

### Styling

- Redesign UnsavedChangesModal to match Aether dark theme with structured header and request card - ([f5debd0](https://github.com/Hephaestus-Studio/aether-api/commit/f5debd0affce22bdf587f3c90d5656249a7f8790))
- Improve file tree alignment with chevron spacer, centered guide lines, and mini-badge method tags - ([b1cd484](https://github.com/Hephaestus-Studio/aether-api/commit/b1cd48480a94ad784ab4cb7669eff7c730d63327))
- Only show input border on focus and compact custom drag preview to actual row size - ([7745f5a](https://github.com/Hephaestus-Studio/aether-api/commit/7745f5a4933be05993186e9b2c1a730402149bb7))
- Replace drag preview with mini inline capsule pill matching screenshot - ([7ca8ee9](https://github.com/Hephaestus-Studio/aether-api/commit/7ca8ee97723a7a118572a18d5eb69087ebeecd5d))
- Render vibrant drop insertion line and anchor dot directly on table cells for clear visual reorder feedback - ([ab3f457](https://github.com/Hephaestus-Studio/aether-api/commit/ab3f457ad2c1d104689221dcac1381d990fcf742))
- Reduce drag preview to ultra-compact micro badge - ([33bac79](https://github.com/Hephaestus-Studio/aether-api/commit/33bac799877d1d2e2714d830dcbcc4d4c3a42341))
- Align folder and collection type badges tightly next to name input - ([16ce33b](https://github.com/Hephaestus-Studio/aether-api/commit/16ce33befaeace935a52589d7eb83c5c10bf1561))
- Modernize body type pill tabs, dropdowns, and clean auto header descriptions - ([1950e5b](https://github.com/Hephaestus-Studio/aether-api/commit/1950e5be494c5ef0d5cf7bc1959b9c48817379da))

### Build

- Generate application icons for desktop, android, and ios using tauri icon - ([d2fefe2](https://github.com/Hephaestus-Studio/aether-api/commit/d2fefe202e673796672317eccc27645b96d45d15))
  [0.2.0-beta]: https://github.com/Hephaestus-Studio/aether-api/releases/tag/v0.2.0-beta

<!-- generated by git-cliff -->
