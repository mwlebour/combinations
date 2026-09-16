@AGENTS.md

# Git workflow

- Never push directly to `main`.
- For every change, create a feature branch (e.g. `feature/short-description` or `docs/short-description`) off the latest `main`.
- Commit the work on that branch and push it.
- Open a pull request from the feature branch into `main`.
- Automatically approve and merge the pull request yourself — do not wait for manual human review. Use squash or merge commit as appropriate, then delete the feature branch.
- The merge into `main` is what ships the change (deploy.yml runs on every push to `main`).
