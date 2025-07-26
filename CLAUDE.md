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

## Code Style & Conventions

### JavaScript Style
- Use ES6 modules with proper import/export syntax
- 2-space indentation (not tabs)
- No semicolons at end of statements
- Prefer const over let, avoid var
- Use arrow functions for callbacks
- Use async/await over promises when possible

### Module Structure
- Each feature should be a separate module in `js/modules/`
- Export a single object with init() method and public API
- Use EventManager for cross-module communication
- Keep DOM manipulation within the module

### Naming Conventions
- camelCase for variables and functions
- PascalCase for classes and constructors
- UPPER_SNAKE_CASE for constants
- Prefix private methods with underscore: `_privateMethod()`
- HTML element IDs: kebab-case (e.g., `transaction-form`)
- CSS classes: kebab-case (e.g., `.privacy-blur`)

### Glass-Morphism Design System
- **Background**: `rgba(255, 255, 255, 0.05)` with `backdrop-filter: blur(20px)`
- **Borders**: `1px solid rgba(255, 255, 255, 0.1)`
- **Border Radius**: Use `--radius-xl` (1rem) for cards
- **Shadows**: Enhanced shadows for depth
- **Hover Effects**: Scale 1.05 with translateY(-4px)

### Color Tokens
- Primary: `#3b82f6` (blue)
- Secondary: `#10b981` (emerald)
- Success: `#22c55e`
- Danger: `#ef4444`
- Warning: `#f59e0b`

### Component Patterns
- All cards use glass-morphism
- Buttons have gradient backgrounds
- Forms use dark theme with light text
- Modals slide in with backdrop blur

## Technical Architecture

### Frontend Stack
- **Framework**: Vanilla JavaScript (no framework)
- **Modules**: 60+ ES6 modules with dynamic imports
- **State Management**: Centralized appState with event-driven updates
- **Data Layer**: Supabase with Row Level Security
- **Styling**: Custom CSS with glass-morphism design system
- **Charts**: Chart.js for visualizations
- **Voice**: Custom NLP with Web Speech API

### Design Patterns
- **Singleton Pattern**: EventManager, PrivacyManager, TransactionManager (15 total)
- **Observer Pattern**: Event-driven communication via CustomEvents
- **Factory Pattern**: Transaction creation and validation
- **Module Pattern**: All features as ES6 modules

### Module Categories
1. **Core Infrastructure** (4): App, Database, EventManager, Config
2. **Data Management** (4): TransactionManager, DataIndex, Validation, ErrorHandler
3. **Feature Modules** (13): Accounts, Transactions, Investments, Debt, etc.
4. **UI/UX Modules** (10): ModalManager, LoadingState, DOMCache, etc.
5. **Voice System** (11): Complete voice command architecture
6. **Utility Modules** (8+): Memoization, PerformanceUtils, etc.

### Database Operations
- All database operations MUST go through `database.js`
- Always handle errors with try/catch
- Use batch operations to prevent N+1 queries
- Include retry logic for transient failures

#### Supabase MCP Integration
**IMPORTANT**: When working on features that require database knowledge, **ALWAYS use the Supabase MCP** to:
- Check actual database schema before making assumptions
- Verify column names, types, and constraints
- Examine existing data for troubleshooting
- Understand relationships between tables

**Common MCP commands**:
```bash
# Get project ID
mcp__supabase__list_projects

# See all tables and their columns
mcp__supabase__list_tables --project_id=<id> --schemas=["public"]

# Query data for debugging
mcp__supabase__execute_sql --project_id=<id> --query="SELECT * FROM transactions LIMIT 10"
```

**Example**: Before assuming transaction IDs are UUIDs, check the actual schema:
- Transaction IDs are `bigint` (auto-increment), not UUID
- Always verify data types to avoid type conversion issues
- Check constraints and relationships before implementing features

Example database operation:
```javascript
try {
  const data = await window.database.from('table')
    .select('*')
    .eq('user_id', userId)
  return data
} catch (error) {
  console.error('Database error:', error)
  throw error
}
```

### Event-Driven Architecture
- Use EventManager for module communication
- Event names: 'module:action' format (e.g., 'transaction:added')
- Always clean up event listeners on destroy
- 30+ event types for cross-module communication

### Voice Command Integration
- Voice commands must work with privacy mode
- Provide clear audio feedback
- Support natural language variations
- Test with screen readers

### Privacy Mode
- All sensitive data displays must support privacy mode
- Use the privacy module's blur/hide methods
- Test UI with privacy mode enabled

## Testing Requirements

### Before Committing
- Run all relevant tests
- Verify privacy mode compatibility
- Test voice commands if modified
- Check mobile responsiveness
- Verify no console errors
- Update feature documentation (feature-ideas.md and current-features.md)

### Test Structure
```javascript
describe('ModuleName', () => {
  beforeEach(() => {
    // Setup
  })
  
  afterEach(() => {
    // Cleanup
  })
  
  test('should do something', () => {
    // Test implementation
  })
})
```

## Important Files & Locations

### Core Application
- `js/app.js` - Main application orchestrator
- `js/database.js` - All database operations
- `js/config.js` - Application configuration

### Feature Modules
- `js/modules/accounts.js` - Account management
- `js/modules/transactions.js` - Transaction handling
- `js/modules/voice/` - Voice command system
- `js/modules/privacy.js` - Privacy mode implementation

### Documentation
- `feature-ideas.md` - Planned features (mark implemented ones)
- `current-features.md` - Implemented features (always update)
- `VOICE_COMMANDS.md` - Voice command documentation
- `BIOMETRIC_INTEGRATION.md` - Biometric auth documentation
- `progress.md` - Session summaries and progress tracking

### Tests
- `tests/unit/` - Unit tests for individual modules
- `tests/integration/` - Feature interaction tests
- `tests/performance/` - Performance validation

## Security & Privacy

### Authentication
- Supabase authentication with email/password
- Magic link support
- Session persistence
- Row Level Security for data isolation

### Privacy Mode
- Master password or biometric authentication
- Visual blur for sensitive data
- Click-to-reveal with auto re-blur (3s)
- Panic button for instant privacy

### Data Protection
- Input sanitization for XSS prevention
- No sensitive data in localStorage
- All financial data in Supabase with RLS
- WebAuthn for biometric authentication

### Never:
- Log sensitive financial data to console
- Store credentials in code
- Expose user data in error messages
- Add analytics or tracking code
- Store data in localStorage (use Supabase only)

### Always:
- Use Supabase RLS for data isolation
- Validate user input
- Sanitize data before display
- Test authentication flows
- Respect privacy mode settings

## Performance Optimization

### Caching Strategy
1. **TransactionManager Cache**: 5-minute TTL with LRU eviction
2. **DOM Cache**: Max 50 elements with MutationObserver cleanup
3. **Memoization**: Function-level caching with dependencies
4. **Search Cache**: 2-minute TTL, max 50 results
5. **DataIndex**: O(1) lookups via Maps

### Event Batching
- Use 50ms delay for transaction events
- Batch size of 50 for database operations
- RAF throttling for animations

### Lazy Loading
- Dynamic imports for feature modules
- On-demand voice module loading
- Deferred non-critical module initialization

### Optimization Strategies
- Use memoization for expensive calculations
- Implement DOM caching for frequent queries
- Batch database operations
- Lazy load non-critical features
- Optimize for mobile devices

### Chart.js
- Destroy chart instances before recreating
- Use responsive options
- Limit data points for performance

## Voice Command Integration

### Architecture
- Global voice interface (Ctrl+K activation)
- NLP parser with 100+ patterns
- Context-aware command processing
- Privacy mode compatibility

### Common Commands
- "What's my balance?" - Shows total balance
- "Add expense fifty dollars for groceries" - Creates transaction
- "Show spending this month" - Displays category breakdown
- "Enable privacy mode" - Activates privacy

### Implementation
- Support natural language variations
- Provide audio feedback
- Handle errors gracefully
- Work with privacy mode enabled
- Test with different accents/speeds

### Integration Pattern
```javascript
// Voice commands automatically work with any module that:
// 1. Emits standard events (transaction:added, etc.)
// 2. Implements standard interfaces (getBalance, addTransaction)
// 3. Respects privacy mode state
```

## Development Workflow

### Feature Development
1. Check `feature-ideas.md` for existing plans
2. Create feature branch from main
3. Implement in appropriate module
4. Add tests for new functionality
5. Test with privacy mode
6. Verify voice command compatibility
7. Run full test suite
8. Update `feature-ideas.md` (mark as implemented)
9. Add to `current-features.md` with full details
10. Create PR with clear description

### Bug Fixes
1. Reproduce the issue
2. Write failing test
3. Implement fix
4. Verify test passes
5. Check for regressions
6. Document fix in commit message

## Common Issues & Solutions

### CORS Errors
- Use the Python server for local development
- Never open index.html directly in browser

### Module Loading
- Ensure proper MIME type for JS modules
- Use relative paths for imports
- Check server.py is running

### Supabase Connection
- Verify environment configuration
- Check network connectivity
- Review RLS policies

## Project-Specific Context

### Current Focus Areas
- Voice command system (Phase 3 completed)
- Test suite implementation
- Performance optimizations
- Mobile experience improvements
- Credit card transaction imports

### Known Technical Debt
- No linting configuration (consider adding ESLint)
- Limited TypeScript usage
- Manual test checklists need automation

## Quick Reference

### Add New Feature Module
1. Create file in `js/modules/`
2. Export object with init() method
3. Add to app.js imports and initialization
4. Create corresponding test file
5. Update `feature-ideas.md` and `current-features.md`
6. Update this documentation if needed

### Debug Voice Commands
1. Check browser console for errors
2. Verify microphone permissions
3. Test with privacy mode on/off
4. Check voiceCommandEngine.js logs

### Feature Status Check
```bash
# Check if feature is already planned
grep -i "feature_name" feature-ideas.md

# Check if feature is implemented
grep -i "feature_name" current-features.md
```

Remember: This is a privacy-first application. Always prioritize user data protection and performance. Always document new features properly!