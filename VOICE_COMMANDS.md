# Voice Commands Documentation

This document lists all voice commands available in Ryokushen Financial Tracker. Access voice commands using the microphone button in the header or press **Ctrl/Cmd+K**.

## Table of Contents
- [Financial Queries](#financial-queries)
- [Spending Analysis](#spending-analysis)
- [Bills & Recurring Charges](#bills--recurring-charges)
- [Goals & Savings](#goals--savings)
- [Search & Discovery](#search--discovery)
- [Navigation](#navigation)
- [Quick Actions](#quick-actions)
- [Settings & Privacy](#settings--privacy)
- [View Filters](#view-filters)
- [Help](#help)

## Financial Queries

### Balance & Net Worth
- "What's my balance?"
- "Show my total cash balance"
- "How much money do I have?"
- "What's my net worth?"
- "Show my total wealth"
- "How much am I worth?"

### Debt Queries
- "What's my total debt?"
- "How much do I owe?"
- "What do I owe?"
- "Show my debt"
- "Debt total"
- "When will I pay off my [debt name]?" (e.g., "When will I pay off my credit card?")
- "What's my highest interest debt?"
- "How much interest am I paying monthly?"
- "Show my credit utilization"
- "What should I pay off first?"

### Investment Queries
- "Show my investments"
- "How are my stocks doing?"
- "Investment value"
- "Investment performance"
- "Investment total"
- "Portfolio value"
- "Portfolio performance"
- "What's my portfolio return this year?"
- "Show stocks in the red"
- "Show stocks in the green"
- "What's my best performing stock?"
- "What's my worst performing stock?"

## Spending Analysis

### Category Spending
- "What did I spend on groceries this month?"
- "How much for dining last month?"
- "Show entertainment expenses"
- "Groceries spending this month"
- "Show [category] spending" (any category name)
- "What's my highest expense category?"
- "Which category do I spend the most on?"
- "Show my top expense categories"

### Merchant Spending
- "How much at Walmart this month?"
- "Walmart spending last month"
- "Spending at Amazon"
- "Show spending at [merchant name]"

### Time-based Spending
- "What did I spend yesterday?"
- "What did I spend today?"
- "Show today's spending"
- "How much have I spent so far today?"
- "What did I spend this week?"
- "Spending this week"
- "What did I spend last weekend?"

### Trends & Analysis
- "How's my spending trending?"
- "Am I spending more or less?"
- "Compare spending to last month"
- "What's my biggest expense increase?"
- "Where am I spending more?"
- "Show expense increases"
- "Compare my spending this month vs last 3 months"
- "How does my spending compare to last year?"
- "Show unusual transactions"
- "Find suspicious activity"
- "Detect anomalies in my spending"

## Bills & Recurring Charges

### Due Dates
- "What bills are due this week?"
- "What bills are due soon?"
- "What bills are due today?"
- "What bills are due tomorrow?"
- "Show upcoming bills"
- "What do I need to pay this week?"

### Overdue Bills
- "Show overdue bills"
- "What bills are late?"
- "What bills are past due?"

### Subscriptions & Analysis
- "What's my cheapest bill?"
- "Find recurring charges"
- "What subscriptions do I have?"
- "Show my subscriptions"

## Goals & Savings

### Financial Health
- "How's my financial health?"
- "What's my health score?"
- "Am I doing well financially?"

### Savings Analysis
- "What's my savings rate?"
- "Am I saving enough?"
- "Am I on track for my savings goals?"
- "Show goal progress"
- "How much more do I need for [goal name]?" (e.g., "How much more do I need for vacation?")
- "When will I reach my [goal name] goal?" (e.g., "When will I reach my emergency fund goal?")
- "How many months of expenses do I have saved?"
- "What's my emergency fund status?"
- "How long can my savings last?"

## Search & Discovery

### Transaction Search
- "Find all Starbucks transactions"
- "Show transactions from Target"
- "Find transactions at [merchant name]"

### Spending Patterns
- "What's my most frequent transaction?"
- "Where do I spend the most?"
- "Show my top spending"
- "Most frequent merchant"

## Navigation

### Tab Navigation
- "Go to dashboard"
- "Go to accounts"
- "Go to transactions"
- "Go to investments"
- "Go to debt"
- "Go to recurring"
- "Open transactions"
- "Show accounts"
- "Navigate to investments"
- "Switch to debt"
- "View recurring bills"

### Create Actions
- "Add new transaction"
- "Create account"
- "Add investment"
- "Create debt account"
- "Add recurring bill"
- "Pay bill"

## Quick Actions

### Transaction Categorization
- "Categorize last transaction as [category]" (e.g., "Categorize last transaction as groceries")
- "Set last transaction to dining"
- "Mark last transaction as entertainment"

### Bill Payment
- "Mark [bill name] as paid" (e.g., "Mark Netflix paid")
- "[Bill name] is paid" (e.g., "Netflix is paid")
- "Paid electricity bill"

## Settings & Privacy

### Privacy Mode
- "Enable privacy mode"
- "Disable privacy mode"
- "Turn on privacy mode"
- "Turn off privacy mode"
- "Toggle privacy"
- "Panic mode"
- "Panic button"

## View Filters

### Transaction Filters
- "Show only income transactions"
- "Show only cash transactions"
- "Hide transfers"
- "Show this month's transactions"
- "Filter by [category]"

### Investment Filters
- "Show transactions in the red"
- "Which stocks are up?"
- "Which stocks are down?"
- "Winning investments"
- "Losing investments"
- "Year to date returns"

## Predictive Analytics

### Balance Forecasting
- "What will my balance be next month?"
- "Project my balance for December"
- "Will I have enough money for rent?"
- "When will I run out of money?"

### Spending Predictions
- "What will I spend on groceries this month?"
- "At this rate, what will I spend this year?"
- "Project my spending for next month"
- "Spending forecast for dining"

### Debt & Goal Projections
- "When will I be debt free?"
- "When can I pay off all my debt?"
- "How long until I'm debt free?"
- "When will I reach my vacation goal?"
- "How long until I can afford a new car?"

## Help

- "Help"
- "What can you do?"
- "Commands"
- "How do I..."

## Tips for Using Voice Commands

1. **Natural Language**: The system understands variations of commands. For example:
   - "What's my balance?" = "Show balance" = "How much money do I have?"

2. **Parameters**: Many commands accept specific parameters:
   - **Time periods**: "this month", "last month", "this week", "yesterday", "today"
   - **Categories**: Any category name from your transactions
   - **Merchant names**: Any merchant name from your transactions
   - **Account/debt names**: Specific account or debt names

3. **Context Awareness**: Commands provide context-specific responses:
   - Visual response cards with relevant data
   - Auto-dismiss after a few seconds
   - Detailed breakdowns where applicable

4. **Privacy Integration**: Voice commands respect privacy mode settings and can control privacy features

5. **Global Access**: Voice commands are available from any page in the application

## Technical Implementation

The voice command system is implemented across multiple modules:
- `voiceCommandEngine.js`: Pattern matching and intent recognition
- `voiceAnalytics.js`: Financial query processing
- `voiceNavigation.js`: Navigation and action handling
- `globalVoiceInterface.js`: Global voice button and coordination
- `voiceResponseSystem.js`: Visual feedback system
- `nlpParser.js`: Natural language processing for transaction input
- `speechRecognition.js`: Core speech recognition functionality