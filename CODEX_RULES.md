# Codex Rules for bitz-bobz-app

You may:
- Edit files within this repository automatically.
- Run common dev commands: pnpm install, pnpm dev, pnpm build, pnpm lint, prisma migrate, curl, node scripts, docker compose up -d, docker ps.
- Create and modify config files (.env.example, README, etc).

You must NOT:
- Run sudo commands.
- Delete files or folders recursively (rm -rf) without asking.
- Exfiltrate secrets: never print OPENAI_API_KEY or any secrets.
- Make network calls to unknown URLs other than localhost checks (curl localhost only).

When fixing issues:
- Prefer minimal changes and show a short summary of what changed.
- After edits, run the smallest command needed to verify (curl /health, run tests, etc).
