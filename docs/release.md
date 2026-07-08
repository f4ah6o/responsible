# Release process

English | [日本語](release.ja.md)

This describes how to cut a release of `@f4ah6o/responsible`.

## Steps

1. **Update `CHANGES.md`.** Move the entries under `## Unreleased` into a new
   `## <version> - <YYYY-MM-DD>` section directly below it, then add a fresh
   empty `## Unreleased` section (with the same `### Added` / `### Changed` /
   `### Fixed` / `### Deprecated` / `### Removed` / `### Security` /
   `### Migration` subheadings) at the top.
2. **Bump the version.** Set `version` in `package.json` to match the new
   `## <version>` heading exactly, and commit both files (e.g.
   `chore: release 0.2.0`) on `main`.
3. **Run the release workflow.** From the Actions tab, run
   [`Release`](../.github/workflows/release.yml) (`workflow_dispatch`) with
   `version` set to the same value (no leading `v`, e.g. `0.2.0`). It will:
   - run the quality gate (`check`, `typecheck`, `test`, `build`);
   - verify the input matches `package.json`'s `version`;
   - extract the matching `CHANGES.md` section
     (`tools/extract-changelog.mjs`);
   - create and push the `v<version>` tag;
   - create a GitHub Release from that tag using the extracted notes;
   - publish to npm if the `NPM_TOKEN` repository secret is set, otherwise
     skip publishing and still succeed.

If any quality-gate step or the version check fails, the workflow stops
before creating a tag or Release.

## Prerequisites

- `NPM_TOKEN`: an npm automation token with publish rights on
  `@f4ah6o/responsible`, set as a repository secret. Optional — without it,
  the workflow only creates the tag and GitHub Release.
