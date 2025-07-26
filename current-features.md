# Current Features - Ryokushen Financial Tracker

> Last Updated: January 26, 2025

This document provides a comprehensive overview of all currently implemented features in the Ryokushen Financial Tracker application.

## Table of Contents
- [Core Financial Features](#core-financial-features)
- [Smart Rules Engine](#smart-rules-engine) 
- [Time Budget System](#time-budget-system)
- [User Interface & Experience](#user-interface--experience)
- [Voice & Natural Language](#voice--natural-language)
- [Technical Infrastructure](#technical-infrastructure)
- [Authentication & User Management](#authentication--user-management)
- [Privacy & Security](#privacy--security)
- [Performance Optimizations](#performance-optimizations)

## Recent Updates (January 2025)
- 🆕 **TransactionManager System** - Centralized transaction management with atomic operations
- 🆕 **EventManager Integration** - Enhanced event-driven architecture for better performance
- 🆕 **Batch Transaction Operations** - Import/export capabilities for bulk data handling

## Previous Updates (July 2025)
- **Visual Bills Calendar** - Interactive monthly calendar view for recurring bills
- **Smart Rules Engine** - Automatic transaction categorization and processing
- **Time Budget System** - Convert expenses to hours of work

---

## Core Financial Features

### 📊 Account Management

#### Cash Accounts
- **Supported Types**: Checking, Savings, Money Market, Other
- **Features**:
  - Create, edit, and delete accounts
  - Track balances with automatic transaction updates
  - Set initial balance on creation
  - Add institution name and notes
  - Active/inactive status management
  - Unique name validation
  - Real-time balance calculations

#### Investment Accounts
- **Supported Types**: 401(k), IRA, Roth IRA, Brokerage, HSA, 529, Pension, Savings Account, Other
- **Features**:
  - Multiple account management
  - Individual holdings tracking (stocks/securities)
  - Real-time stock price updates via Finnhub API
  - Portfolio value calculations
  - Day change tracking
  - Manual balance option for non-stock accounts
  - Batch price updates

#### Debt Accounts
- **Supported Types**: Credit Card, Student Loan, Mortgage, Auto Loan, Personal Loan, HELOC, Other
- **Features**:
  - Balance and interest rate tracking
  - Minimum payment management
  - Due date monitoring
  - Credit limit tracking (credit cards)
  - Credit utilization calculations
  - Support for $0 balance accounts

### 💸 Transaction Management

#### Transaction Entry
- **Data Fields**: Date, Account, Category, Description, Amount
- **Status Tracking**: Cleared/Pending
- **Voice Input**: Natural language transaction entry
- **Smart Features**:
  - Auto-categorization from voice input
  - Account balance auto-update
  - Transfer detection and handling
  - Debt payment processing

#### Categories
Income, Housing, Transportation, Food, Healthcare, Entertainment, Shopping, Utilities, Insurance, Debt, Savings, Education, Personal Care, Gifts, Taxes, Fees, Travel, Transfer, Other, Uncategorized (default for new transactions)

#### Management Features
- Edit transactions with automatic recalculation
- Delete with balance restoration
- Filter by category
- Recent transactions display
- Recurring payment linking

#### TransactionManager System (NEW - January 2025)
- **Centralized Management**: All transaction operations through single manager
- **Atomic Operations**: Automatic rollback on failure prevents data corruption
- **Smart Caching**: 5-minute TTL cache for improved performance
- **Batch Operations**: Bulk import/export support (CSV, JSON, QIF formats)
- **Event Batching**: 50ms delay for performance optimization
- **Balance Tracking**: Automatic balance updates and reversals
- **Validation Engine**: Comprehensive data validation before operations
- **Search & Analytics**: Advanced transaction search and statistics
- **Export Formats**: Multiple export options for data portability
- **Error Recovery**: Automatic retry logic for transient failures

#### Transaction Templates (NEW - Phase 2, January 2025)
- **Template Creation**: Save frequently used transactions as reusable templates
- **Quick Entry**: Create transactions from templates with one click
- **Pattern Detection**: Automatically suggest templates based on usage patterns
- **Template Management**: Full CRUD operations for templates
- **Smart Conversion**: Convert existing transactions to templates
- **Flexible Overrides**: Override any template field when creating transactions

#### Smart Defaults & Pattern Recognition (NEW - Phase 2, January 2025)
- **Pattern Matching**: Multi-level matching system for transaction suggestions
  - Exact description matches (95% confidence)
  - Partial description matches (up to 70% confidence)
  - Category-based defaults (30% confidence)
  - Template-based suggestions (70% confidence)
- **Merchant Suggestions**: Auto-complete for transaction descriptions
- **Amount Prediction**: Suggests amounts based on historical patterns
- **Account Selection**: Recommends most likely account for transactions
- **Learning System**: Framework for recording and learning from corrections
- **Confidence Scoring**: Indicates reliability of suggestions

---

## Smart Rules Engine

### 🤖 Automatic Transaction Processing

#### Rule Components
- **Rule Details**: Name, description, priority (0-999), enabled status
- **Pattern Matching**: Field-based conditions with multiple operators
- **Actions**: Automated modifications to matching transactions
- **Statistics**: Match count and last matched tracking

#### Condition Fields
- **Description**: Transaction description text
- **Amount**: Transaction amount (absolute value)
- **Category**: Current transaction category
- **Transaction Type**: Income or Expense

#### Available Operators
- **Text Operators**: Contains, Equals, Starts With, Ends With, Matches Pattern (Regex)
- **Numeric Operators**: Equals, Greater Than, Less Than, Greater/Less Than or Equal, Between

#### Complex Conditions (Phase 2 - July 19, 2025)
- **Nested Groups**: Support for complex (A AND B) OR (C AND D) logic
- **Mixed Logic**: Combine AND, OR, and NOT operators
- **Unlimited Nesting**: Create sophisticated rule conditions
- **Visual Builder**: Planned for future update

#### Rule Templates
- **6 Categories**: Pre-built rules for common scenarios
  - **Subscriptions**: Netflix, Spotify, Amazon Prime, Gym memberships
  - **Income**: Salary/paycheck detection, tax refunds
  - **Dining**: Fast food chains, food delivery, coffee shops
  - **Transportation**: Gas stations, rideshare, parking
  - **Shopping**: Grocery stores, online shopping
  - **Utilities**: Phone bills, internet, electricity
- **30+ Templates**: Ready-to-use rules for popular services
- **Template UI**: Browse categories, preview rules, one-click creation
- **Smart Suggestions**: Based on transaction patterns (planned)

#### Supported Actions
- **Set Category**: Automatically categorize transactions
- **Add Tag**: Append hashtags to descriptions
- **Add Note**: Append notes to descriptions

#### Management Features
- Create, edit, and delete rules
- Enable/disable toggle per rule
- Priority-based execution order
- Apply rules to existing transactions
- Rule match notifications

#### Uncategorized Transaction Enhancement (July 19, 2025)
- **Default Category**: New transactions now default to "Uncategorized" instead of requiring immediate categorization
- **Automatic Processing**: Smart Rules automatically process uncategorized transactions when created
- **Visual Indicators**: Warning badge (⚠️) displays count of uncategorized transactions in the Rules tab
- **Quick Identification**: Users can easily find transactions that need manual categorization
- **Improved Workflow**: Allows bulk transaction entry followed by rule-based or manual categorization

#### Technical Implementation
- Database schema with RLS policies
- Event-driven architecture
- Privacy mode compatible
- Real-time processing on transaction creation
- Batch processing for existing transactions
- Automatic rule application on uncategorized transactions

### 📅 Bills & Recurring Payments

#### Bill Management
- **Frequencies**: Daily, Weekly, Biweekly, Monthly, Quarterly, Annually
- **Payment Methods**: Cash account or Credit card
- **Features**:
  - Active/inactive status
  - Next due date auto-calculation
  - 30-day upcoming bills forecast
  - Notes field
  - Last paid date tracking

#### Recurring Transaction Generation (NEW - Phase 2, January 2025)
- **Automatic Generation**: Create transactions for due bills automatically
- **Preview Mode**: See upcoming bills without creating transactions
- **Batch Processing**: Handle multiple bills in one operation
- **Smart Scheduling**: Calculates next due dates based on frequency
- **Payment Method Support**: Works with both cash and credit cards
- **Flexible Options**:
  - Generate for bills due today only
  - Generate for bills due in next N days
  - Dry run mode for testing
  - Progress tracking for batch operations

#### Visual Calendar View (NEW - July 19, 2025)
- **Monthly Calendar Display**: Visual grid showing all bill due dates
  - 7-day week view with weekday headers
  - Distinct weekend cell coloring
  - Empty day indicators for better visual clarity
  - Support for multiple bills per day
- **Color-Coded Categories**: Bills colored by spending category
  - Each category has unique color assignment
  - Visual indicators with colored borders
  - Bills displayed as compact event cards
- **Interactive Features**:
  - Click days to view all bills for that date
  - Quick pay actions directly from calendar
  - Smooth month navigation with Previous/Next buttons
  - Today button for quick return to current date
  - Hover effects for better interactivity
  - Click event debouncing to prevent lag
- **Summary Metrics**: 
  - Monthly bill totals with count
  - Income placeholders (Phase 2)
  - Net flow calculation
  - Real-time updates on bill changes
- **View Toggle**: 
  - Seamless switch between calendar and list views
  - Persistent data across view changes
  - View preference remembered in session
- **Privacy Mode**: 
  - Sensitive amounts blur on demand
  - Works with global privacy settings
  - Maintains functionality while hiding data
- **Dark Theme Integration**:
  - Custom dark color scheme
  - High contrast for readability
  - Today highlighted with accent border
- **Technical Features**:
  - Event regeneration on month change
  - Efficient date calculations
  - Responsive design for mobile
  - Data persistence across navigation

#### Pay Schedule Configuration
- **Frequency Options**:
  - Weekly (select day of week)
  - Bi-weekly (every 2 weeks from start date)
  - Semi-monthly (select two days of month)
  - Monthly (select day of month)
- **Pay Schedule Modal**:
  - Clean form interface for adding schedules
  - Dynamic field display based on frequency
  - Multiple pay schedules support
  - Net pay amount entry
- **Schedule Management**:
  - View all active pay schedules
  - Delete individual schedules
  - Real-time calendar updates
  - Edit functionality (planned)
- **Calendar Integration**:
  - Pay events shown in green
  - Income summary in month header
  - Net cash flow calculation
  - Pay events sorted by date
- **Database Features**:
  - Secure pay_schedules table
  - Row Level Security policies
  - Automatic timestamp updates
  - User data isolation

#### Payment Processing
- One-click bill payment
- Automatic transaction creation
- Payment history tracking
- Monthly/annual totals
- Due date notifications

### 🎯 Savings Goals

#### Goal Features
- Link to savings or investment accounts
- Target amount and optional date
- Visual progress indicators
- Contribution tracking
- Goal completion detection
- Support for deleted account handling

#### Contribution Management
- Transfer from any cash/investment account
- Automatic transaction creation
- Progress percentage calculation
- Contribution reversal on transaction deletion

### 📈 Investment Features

#### Portfolio Management
- Multiple holdings per account
- Real-time price updates
- Total portfolio value
- Day change calculations
- Individual holding performance

#### Investment Calculators
- **Extra Contribution Calculator**: Project growth with monthly additions
- **Retirement Goal Calculator**: Required monthly savings calculation
- **Portfolio Growth Calculator**: Long-term projections
- **Scenarios**: 9%, 12%, 15% return rates
- **Features**: Inflation adjustments, CAGR calculations

### 💳 Debt Management

#### Debt Tracking
- Comprehensive account details
- Interest calculations
- Payment scheduling
- Credit utilization monitoring

#### Payoff Strategies
- **Snowball Method**: Smallest balance first
- **Avalanche Method**: Highest interest first
- **Analysis Features**:
  - Strategy comparison
  - Interest savings calculations
  - Payoff timeline
  - Month-by-month schedule
  - Debt-free date projection

### 📊 Financial Analytics & KPIs

#### Key Performance Indicators
- **Emergency Fund Ratio**: Months of expenses covered
- **Debt-to-Income Ratio**: Monthly payments vs income
- **Savings Rate**: Percentage of income saved
- **Financial Health Score**: A+ to D letter grade

#### Dashboard Metrics
- Net worth calculation
- Asset summaries
- Liability tracking
- Monthly expense totals
- Recent activity feed
- 30-day bill timeline

---

## Time Budget System

### ⏱️ Overview
The Time Budget System transforms financial expenses into time worked, providing a unique perspective on spending by showing how many hours or minutes of work each purchase represents.

### Configuration
- **Wage Settings**: Hourly rate input
- **Tax Rate**: Percentage for after-tax calculations
- **Enable/Disable**: Toggle system on/off
- **Settings Storage**: Persistent configuration

### Time Conversion Features
- **Expense to Time**: Convert any expense to hours/minutes of work
- **After-Tax Calculations**: Accurate time based on net income
- **Real-Time Updates**: Instant conversion as you spend
- **Multiple Formats**: "2h 15m" or "2.25 hours"

### Dashboard Widget
- **Visual Display**: Prominent time budget widget on dashboard
- **Period Metrics**: Today, This Week, This Month time totals
- **Progress Indicator**: Visual gauge of time worked for expenses
- **Quick Settings**: Direct link to configuration
- **Privacy Mode**: Blurs sensitive time/wage information

### Voice Integration
- **Time Queries**: "How much time did I spend on groceries?"
- **Last Purchase**: "How much work was my last purchase?"
- **Category Analysis**: "How many hours for dining this month?"
- **Natural Responses**: "Your coffee cost 15 minutes of work"

### Analytics Features
- **Time-Based Reports**: See spending in time instead of dollars
- **Category Breakdown**: Hours worked per spending category
- **Historical Tracking**: Time trends over periods
- **Goal Setting**: Set time-based spending limits

---

## User Interface & Experience

### 🧭 Navigation System

#### Tab Navigation
- Six main sections: Dashboard, Accounts, Transactions, Investments, Debt, Recurring
- Active tab highlighting
- ARIA labels for accessibility
- Keyboard navigation support
- Screen reader announcements

### 📊 Data Visualization

#### Chart Types
- Line charts for trends
- Doughnut charts for allocations
- Bar charts for comparisons
- Gauge charts for KPIs

#### Chart Features
- Responsive sizing
- Interactive tooltips
- Privacy mode support
- Auto-refresh on data changes
- Mobile-optimized layouts

### 🪟 Modal System

#### Modal Manager Features
- Centralized control
- Escape key support
- Click-outside to close
- Form validation integration
- Auto-reset on close
- Screen reader announcements
- Focus management

### 📱 Responsive Design

#### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

#### Mobile Optimizations
- Touch-friendly controls
- Simplified navigation
- Optimized chart layouts
- Reduced font sizes
- Overflow prevention

### ♿ Accessibility

#### ARIA Support
- Comprehensive ARIA labels
- Role attributes
- Live regions for updates
- Screen reader announcements

#### Keyboard Navigation
- Tab order management
- Escape key handlers
- Keyboard shortcuts (Ctrl+K for voice)
- Focus indicators

### 🎨 Theme & Appearance

#### Design System
- CSS custom properties
- Consistent color palette
- Typography scale
- Spacing system
- Border radius standards

#### Dark Mode
- Automatic detection (prefers-color-scheme)
- Optimized color contrasts
- Chart theme switching

---

## Voice & Natural Language

### 🎤 Voice Input System

#### Phase 1: Basic Speech-to-Text ✅
- Voice button in transaction form
- Real-time transcription
- Privacy mode compatibility
- Visual feedback

#### Phase 2: Smart NLP Parsing ✅
- Natural language amount extraction
- Date parsing ("yesterday", "last Friday")
- Category inference
- Merchant recognition
- Auto-form filling

#### Phase 3: Global Voice Commands ✅
- System-wide voice button (header)
- Keyboard shortcut (Ctrl/Cmd+K)
- Visual response cards
- Auto-dismiss responses
- Privacy mode integration

### 🗣️ Voice Command Categories

#### Financial Queries
- Balance and net worth
- Debt summaries
- Investment performance
- Spending analysis
- Bill status
- Goal progress

#### Navigation Commands
- "Go to [section]"
- "Open [tab]"
- "Create new [item]"

#### Quick Actions
- Transaction categorization
- Bill payment marking
- Privacy mode toggle

#### Advanced Analytics
- Comparative spending
- Trend analysis
- Anomaly detection
- Future projections

### 🧠 Natural Language Processing

#### Query Types Supported
- **Temporal**: "last month", "next quarter", "year to date"
- **Categorical**: "groceries spending", "dining expenses"
- **Merchant-based**: "Walmart transactions", "Amazon spending"
- **Predictive**: "balance next month", "when debt free"
- **Comparative**: "this vs last month", "year over year"

#### Smart Features
- Fuzzy matching for merchants
- Category synonyms
- Time period inference
- Context awareness
- Confidence scoring

---

## Technical Infrastructure

### 💾 Data Persistence

#### Database: Supabase
- **Tables**: cash_accounts, transactions, investment_accounts, debt_accounts, recurring_bills, savings_goals, holdings
- **Features**:
  - Real-time operations
  - Error handling
  - Automatic retries
  - Connection management

### ⚡ Performance Optimizations

#### Caching Systems
- **Memoization**: Function result caching with TTL
- **DOM Cache**: Reduced query operations
- **API Cache**: 5-minute stock price cache
- **Balance Cache**: Automatic invalidation

#### Batch Operations
- Prevents N+1 queries
- Groups database operations
- Async lock mechanism
- Race condition prevention

### 🔧 Error Handling

#### Error Management
- Centralized error handler
- Retry logic (network errors)
- User-friendly messages
- Detailed debug logging
- Global error boundaries

#### Recovery Features
- Automatic reconnection
- Operation timeout handling
- Graceful degradation
- State restoration

### 🏗️ Architecture

#### Module System
- ES6 modules
- Clear separation of concerns
- Dependency injection
- Event-driven communication

#### Core Systems
- **EventManager**: Centralized event handling with automatic cleanup
- **LoadingState**: UI state management
- **ModalManager**: Dialog control
- **ValidationFramework**: Form validation
- **DebugSystem**: Conditional logging
- **TransactionManager**: Centralized transaction operations with atomic support

### 🔌 External Integrations

#### Finnhub Stock API
- Real-time price updates
- Rate limiting (100ms)
- Error handling
- API key management
- Fallback strategies

---

## Authentication & User Management

### 🔐 User Authentication

#### Authentication System (Supabase)
- **Secure Login**: Email and password authentication
- **Magic Link Support**: Passwordless login via email
- **Session Management**: Persistent sessions with automatic refresh
- **Account Creation**: Sign up with email verification requirement

#### Password Management
- **Password Reset**: Email-based password recovery flow
- **Secure Reset Form**: Dedicated password reset interface
- **Password Requirements**: Minimum 8 characters enforced
- **Update Password**: Change password through reset flow

### 👤 User Interface

#### Header Integration
- **User Info Display**: Email shown in header (right-aligned)
- **Logout Button**: Styled logout with hover effects
- **Responsive Design**: Mobile-optimized with email hidden on small screens
- **Clean Layout**: Non-intrusive positioning

#### Email Verification
- **Verification Banner**: Warning displayed for unverified emails
- **Resend Functionality**: One-click email resend with status feedback
- **Persistent Notice**: Sticky banner at top of page
- **Visual Indicators**: Warning icon and clear messaging

### 🔒 Security Features

#### Session Security
- **Auto-logout**: Session expiry handling
- **Secure Storage**: Encrypted session tokens
- **Auth State Sync**: Real-time auth state updates across tabs
- **Protected Routes**: Authentication required for app access

#### Data Isolation
- **User-specific Data**: Each user's financial data is isolated
- **Row-level Security**: Database-level access control
- **No Data Sharing**: Complete data privacy between users

### 🚀 Authentication Flow

#### Sign Up Process
1. User enters email and password
2. Account created with unverified status
3. Verification email sent automatically
4. User must verify email to access full features
5. Automatic login after verification

#### Login Process
1. Email/password or magic link option
2. Session established on successful auth
3. Automatic redirect to main app
4. Session persists across browser sessions

#### Password Reset Flow
1. User requests reset from login page
2. Reset email sent with secure token
3. Click link opens password reset form
4. New password saved and user logged in

---

## Privacy & Security

### 🔐 Privacy Mode

#### Features
- Toggle button in header
- Panic button (Ctrl+Shift+P)
- Visual data blurring
- Click-to-reveal (3 seconds)
- Persistent state
- Voice command support

#### Coverage
- All financial numbers
- Account details
- Transaction descriptions
- Chart tooltips
- Voice responses

### 🛡️ Security Measures

#### Data Protection
- Local storage only
- No server transmission
- Input sanitization
- XSS prevention
- Parameterized queries

#### Privacy Features
- No user accounts required
- No analytics tracking
- No external data sharing
- Complete data ownership

---

## Performance Optimizations

### 🚀 Speed Enhancements

#### Rendering
- Virtual DOM updates
- Batch DOM operations
- Debounced chart updates
- Lazy loading
- Request animation frame

#### Data Processing
- Memoized calculations
- Indexed lookups
- Efficient sorting
- Minimal re-computation
- Background processing

### 📱 Mobile Performance

#### Optimizations
- Reduced chart complexity
- Touch event optimization
- Minimal animations
- Efficient scrolling
- Memory management

---

## Feature Limitations

### Not Currently Implemented
- Export/Report generation
- Multi-language support
- Custom voice commands
- Cloud sync
- Multi-user support
- Mobile app
- Offline mode
- Data import from banks
- Budget tracking
- Recurring income
- Tax calculations
- Investment research tools

### Browser Requirements
- Modern browser with ES6 support
- Web Speech API for voice features
- LocalStorage for data persistence
- Internet connection for stock prices

---

*This document is regularly updated as new features are added to the application.*