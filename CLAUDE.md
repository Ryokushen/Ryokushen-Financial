# Ryokushen Financial - Claude Code Context

This file contains important context and conventions for Claude Code when working on the Ryokushen Financial project.

## Project Overview

Ryokushen Financial is a privacy-focused personal financial management application with unique time-budget features and voice control capabilities. Built with vanilla JavaScript for optimal performance.

## Custom Commands

### /progress
When you see this command, you should:
1. Summarize all accomplishments from the current session
2. Include: changes made, features implemented, bugs fixed, documentation updated
3. Add the summary to `progress.md` with the current date
4. Format: date header, bullet points of accomplishments, brief context

Example format:
```markdown
## 2025-07-18 Session Summary

### Accomplishments:
- Reset git branch to match remote repository
- Created comprehensive CLAUDE.md documentation
- Switched to credit_card_transactions branch
- [Other accomplishments...]

### Context:
Brief description of the session's focus and any important decisions made.
```

## CRITICAL: Feature Documentation Requirements

### When implementing ANY new feature:
1. **Check `feature-ideas.md`** - If the feature is listed there, mark it as implemented
2. **Update `current-features.md`** - Add the new feature with full details
3. **If feature is not in `feature-ideas.md`** - Add it there first, then mark as implemented

### Feature Documentation Format:
```markdown
### Feature Name ✅ IMPLEMENTED [Date]
- Original description...
- Implementation details...
```

## Preparation Guidelines

### Pre-Code Change Workflow
- **IMPORTANT**: Before making any code changes:
  - Thoroughly review `current-features.md` to understand existing project status
  - Check `feature-ideas.md` to identify planned features
  - Examine `progress.md` to understand recent developments and context
  - Verify current project state to prevent redundant work or conflicting implementations

## Frequently Used Commands

### Development Server
```bash
python3 server.py  # Start local dev server on port 8080
```

### Testing
```bash
npm test                 # Run all tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
```

### Git Operations
```bash
git status
git log --oneline -10
git diff
```

[Rest of the existing content remains unchanged]