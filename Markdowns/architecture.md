# Ryokushen Financial - Technical Architecture

## Overview

Ryokushen Financial is a vanilla JavaScript application with an event-driven architecture and modular design. Built without frameworks, it demonstrates enterprise-level patterns and performance optimizations while maintaining simplicity.

## Technology Stack

- **Frontend**: Vanilla ES6 JavaScript (no framework)
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth
- **Charts**: Chart.js
- **Voice**: Web Speech API
- **Biometric**: WebAuthn API
- **Historical Tracking**: Database snapshots with time-series comparison
- **Build Process**: None (native ES6 modules)

## Module Architecture

### Module Categories (65+ Total)

#### 1. Core Infrastructure (4 modules)
Essential modules that all others depend on:
- **app.js** - Main application orchestrator
- **database.js** - All database operations
- **eventManager.js** - Central event bus
- **config.js** - Application configuration

#### 2. Data Management (4 modules)
Centralized data handling:
- **transactionManager.js** - Transaction operations (singleton)
- **dataIndex.js** - O(1) data lookups
- **validation.js** - Data validation framework
- **errorHandler.js** - Centralized error handling

#### 3. Feature Modules (18 modules)
Business logic implementation:
- **accounts.js** - Account management
- **transactions.js** - Transaction UI
- **investments.js** - Investment tracking
- **debt.js** - Debt management
- **recurring.js** - Recurring bills
- **savings.js** - Goals tracking
- **smartRules.js** - Rule engine
- **timeBudgets.js** - Time conversion
- **dashboard.js** - Main dashboard
- **charts.js** - Chart generation
- **timeline.js** - Bill timeline
- **batchOperations.js** - Bulk actions
- **transactionImport.js** - Import wizard
- **cashFlowSankey.js** - Sankey diagram visualization
- **payCalculator.js** - Salary and tax calculations
- **simpleCharts.js** - Simplified chart implementations
- **bulkOperations.js** - Bulk transaction operations
- **transactionTemplates.js** - Transaction templates

#### 4. UI/UX Modules (12 modules)
User interface management:
- **modalManager.js** - Modal coordination
- **loadingState.js** - Loading indicators
- **domCache.js** - DOM element caching
- **ui.js** - UI helper functions
- **privacy.js** - Privacy mode
- **supabaseAuth.js** - Authentication UI
- **cashAccounts.js** - Cash account UI
- **investmentAccounts.js** - Investment UI
- **debtAccounts.js** - Debt account UI
- **rulesUI.js** - Rules interface
- **dataIntegrityUI.js** - Data integrity interface
- **advancedSearch.js** - Advanced search UI

#### 5. Voice System (11 modules)
Complete voice command architecture:
- **globalVoiceInterface.js** - Main coordinator
- **voiceInput.js** - Speech recognition
- **voiceCommandEngine.js** - NLP processing
- **voiceAnalytics.js** - Financial queries
- **voiceNavigation.js** - Navigation commands
- **voiceResponseSystem.js** - Visual feedback
- **voiceFeedback.js** - Audio feedback
- **nlpParser.js** - Natural language parsing
- **voiceSecurityCommands.js** - Security controls
- **speechToText.js** - Transcription
- **smartFormFiller.js** - Form automation

#### 6. Utility Modules (10+ modules)
Supporting functionality:
- **memoization.js** - Function caching
- **performanceUtils.js** - Debounce/throttle
- **utils.js** - Common utilities
- **financialMath.js** - Precise calculations
- **ruleEngine.js** - Rule processing
- **debug.js** - Debug logging
- **asyncLock.js** - Concurrency control
- **categories.js** - Category management
- **dataRepair.js** - Data integrity repair utilities
- **performanceDashboard.js** - Performance analytics

## Design Patterns

### Singleton Pattern (15 instances)
Used for services that need single instances:
```javascript
// Example: EventManager
class EventManager {
    constructor() {
        if (EventManager.instance) {
            return EventManager.instance;
        }
        this.listeners = new Map();
        EventManager.instance = this;
    }
}
export const eventManager = new EventManager();
```

Services using singleton:
- EventManager
- TransactionManager
- PrivacyManager
- ModalManager
- LoadingStateManager
- DataIndex
- DOMCache
- GlobalVoiceInterface
- VoiceCommandEngine
- VoiceResponseSystem
- Debug
- ErrorHandler
- SmartRules
- ValidationFramework
- AsyncLock

### Observer Pattern
Event-driven communication between modules:
```javascript
// Publishing events
eventManager.dispatchEvent('transaction:added', { transaction });

// Subscribing to events
eventManager.addEventListener(window, 'transaction:added', (event) => {
    updateBalance(event.detail.transaction);
});
```

### Factory Pattern
Transaction creation with validation:
```javascript
// TransactionManager acts as factory
const transaction = await transactionManager.createTransaction({
    type: 'expense',
    amount: 50.00,
    category: 'Food'
});
```

### Module Pattern
All features as ES6 modules with init:
```javascript
// Standard module structure
export default {
    async init() {
        this.setupEventListeners();
        await this.loadData();
        return this;
    },
    
    setupEventListeners() {
        // Event setup
    },
    
    // Public API
    addTransaction() { },
    updateTransaction() { }
}
```

## Data Flow

### Transaction Flow Example
```
User Input → Validation → TransactionManager → Database
     ↓            ↓              ↓                ↓
   Voice      ErrorHandler    Cache Update    Supabase
   Parser                         ↓
                              Event Dispatch
                                  ↓
                           UI Components Update
```

### Event Flow
```
Module A → EventManager → Module B, C, D
             (publish)      (subscribers)
```

### Data Caching Hierarchy
1. **Memory Cache** (TransactionManager) - 5 min TTL
2. **DOM Cache** - 50 elements max
3. **Search Cache** - 2 min TTL, 50 results
4. **Memoization** - Function-level caching
5. **DataIndex** - O(1) lookups

## Performance Architecture

### Caching Strategy
- **LRU Eviction**: Least recently used items removed
- **TTL Management**: Time-based expiration
- **Invalidation**: Event-based cache clearing
- **Memory Limits**: Prevent unbounded growth

### Event Optimization
- **Batching**: 50ms delay for transaction events
- **Throttling**: RAF for animations
- **Debouncing**: Search and validation
- **Queue Management**: Prevent event storms

### Module Loading
- **Dynamic Imports**: Load modules on demand
- **Lazy Initialization**: Defer non-critical modules
- **Progressive Enhancement**: Core features first

## Security Architecture

### Authentication
- Supabase Auth with JWT tokens
- Session management
- Email verification required
- Magic link support

### Data Protection
- Row Level Security (RLS) policies
- User data isolation
- Input sanitization
- XSS prevention

### Privacy Features
- Visual data blurring
- Biometric authentication
- Master password fallback
- Panic mode activation

## Module Dependencies

### Initialization Order (app.js)
```javascript
1. Core Infrastructure
   - EventManager
   - Database
   - Config
   
2. Data Management
   - TransactionManager
   - DataIndex
   - Validation
   
3. UI Foundation
   - ModalManager
   - LoadingState
   - Privacy
   
4. Feature Modules
   - Accounts
   - Transactions
   - Investments
   - etc.
   
5. Voice System (lazy)
   - Loaded on first use
```

### Dependency Graph
```
app.js
  ├── eventManager.js (no deps)
  ├── database.js → config.js
  ├── transactionManager.js → database.js, eventManager.js
  ├── accounts.js → database.js, transactionManager.js
  ├── transactions.js → transactionManager.js, modalManager.js
  └── voice/ → all feature modules
```

## Error Handling

### Centralized Error Management
```javascript
try {
    await riskyOperation();
} catch (error) {
    errorHandler.handle(error, {
        context: 'Transaction Creation',
        retry: true
    });
}
```

### Error Recovery
- Automatic retries for network errors
- Transaction rollback on failure
- User-friendly error messages
- Debug logging for development

## Testing Architecture

### Test Categories
- **Unit Tests**: Individual module testing
- **Integration Tests**: Module interaction
- **Performance Tests**: Load and speed
- **Voice Tests**: Command recognition

### Test Infrastructure
- Jest for test runner
- Mock Supabase client
- Event simulation
- Performance benchmarks

## Future Extensibility

### Plugin System (Planned)
- Third-party module support
- Hook system for extensions
- API for custom features

### Scalability Considerations
- WebWorker support for heavy operations
- IndexedDB for offline capability
- Service Worker for PWA features
- WebSocket for real-time updates

## Best Practices

### Code Organization
- One module per file
- Clear separation of concerns
- Consistent naming conventions
- Comprehensive JSDoc comments

### Performance
- Minimize DOM operations
- Use caching strategically
- Batch database operations
- Lazy load non-critical features

### Security
- Never trust client input
- Sanitize all user data
- Use parameterized queries
- Implement proper auth checks

### Maintainability
- Event-driven architecture
- Loose coupling between modules
- Clear module interfaces
- Comprehensive error handling