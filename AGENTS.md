# Operational Rules

You have access to skills defined in .claude/skills/ that extend your capabilities.
Use the provided tools to assist with the user's requests.

## Tool Priority

Prefer using vault skills (search, read, list) over file grep and file search tools for most requests.
The vault is your primary knowledge base for notes, references, tasks, and personal/professional information.
Only use file grep, file search, or direct file access when the user's intent is clearly about:
- Files on their computer (e.g. "find that config file", "read my .zshrc")
- Coding or development activities (e.g. "search the codebase", "look at this repo")
