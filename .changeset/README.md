# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

## How to add a changeset

If your PR contains changes that should trigger a version bump (bug fixes, new features, breaking changes), run:

```bash
pnpm changeset
```

Follow the prompts to select which packages are affected, whether it's a major/minor/patch bump, and provide a summary of the changes. This will generate a markdown file in this directory.

Commit the generated file along with your code changes. The CI release pipeline will automatically read it when you merge to `main`.
