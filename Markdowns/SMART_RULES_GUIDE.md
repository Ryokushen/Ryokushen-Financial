# Smart Rules Engine User Guide

**Version:** Phase 1 (Basic Rules)  
**Status:** Active Development  
**Last Updated:** July 19, 2025

## Overview

The Smart Rules Engine automatically processes your transactions based on customizable rules. Set up patterns to automatically categorize transactions, add tags, append notes, or trigger alerts - saving you time and ensuring consistency in your financial tracking.

## Getting Started

### Accessing Smart Rules
1. Click the **"Rules"** tab in the main navigation
2. You'll see your rules dashboard with:
   - Summary statistics (Active Rules, Total Matches)
   - List of existing rules
   - Controls to add new rules

### Your First Rule

**Example: Auto-categorize Starbucks purchases**

1. Click **"Add Rule"**
2. Fill in the rule details:
   - **Name:** "Categorize Starbucks"
   - **Description:** "Auto-categorize coffee purchases"
   - **Priority:** 10 (higher numbers run first)
3. Set up the condition:
   - **Field:** Description
   - **Operator:** Contains
   - **Value:** "STARBUCKS"
4. Configure the action:
   - **Action Type:** Set Category
   - **Category:** Dining
5. Ensure **"Enable Rule"** is checked
6. Click **"Save Rule"**

## Rule Components

### 1. Rule Details
- **Name:** Descriptive identifier for your rule
- **Description:** Optional explanation of what the rule does
- **Priority:** Number (0-999) - higher priority rules execute first
- **Enabled:** Toggle to activate/deactivate the rule

### 2. Conditions (What to Match)

#### Available Fields:
- **Description:** Transaction description text
- **Amount:** Transaction amount (absolute value)
- **Category:** Current transaction category
- **Transaction Type:** Income or Expense

#### Text Operators:
- **Contains:** Text includes the specified value
- **Equals:** Text exactly matches the value
- **Starts With:** Text begins with the value
- **Ends With:** Text ends with the value
- **Matches Pattern (Regex):** Advanced pattern matching

#### Numeric Operators (for Amount field):
- **Equals:** Exact amount match
- **Greater Than:** Amount is larger than value
- **Less Than:** Amount is smaller than value
- **Greater Than or Equal:** Amount is at least the value
- **Less Than or Equal:** Amount is at most the value
- **Between:** Amount falls within range (use format: "10,50")

### 3. Actions (What to Do)

#### Available Actions:
- **Set Category:** Changes the transaction category
- **Add Tag:** Appends a hashtag to the description
- **Add Note:** Appends a note to the description

*Future actions: Set merchant, modify amount, create reminders*

## Rule Examples

### Basic Categorization
```
Name: Auto-categorize Netflix
Condition: Description contains "NETFLIX"
Action: Set Category to "Entertainment"
```

### Amount-based Rules
```
Name: Flag Large Expenses
Condition: Amount greater than 500
Action: Add Tag "#large-expense"
```

### Multiple Conditions (Phase 2)
```
Name: Weekend Dining Alert
Condition: Category equals "Dining" AND Day of Week in "Saturday,Sunday"
Action: Add Note "Weekend dining expense"
```

## Managing Rules

### Rule List
- **Toggle Switch:** Enable/disable rules instantly
- **Edit Button:** Modify existing rules
- **Delete Button:** Remove rules permanently
- **Rule Stats:** Shows match count and last matched date

### Rule Priority
Rules execute in priority order (highest first). If multiple rules could match the same transaction, the higher priority rule runs first.

### Apply to Existing Transactions
Click **"Apply to Existing"** to run all active rules against your current transaction history. This is useful when:
- Creating new rules for existing data
- Re-running rules after modifications
- Bulk categorizing imported transactions

## Best Practices

### 1. Start Simple
Begin with basic categorization rules before adding complex logic.

### 2. Use Descriptive Names
Name rules clearly: "Auto-categorize Gas Stations" vs "Rule 1"

### 3. Set Appropriate Priorities
- High priority (90-99): Critical categorization rules
- Medium priority (50-89): General categorization
- Low priority (10-49): Tagging and notes
- Lowest priority (1-9): Alerts and notifications

### 4. Test Before Applying
Create a rule and verify it works on new transactions before applying to existing data.

### 5. Regular Maintenance
Review and update rules as your spending patterns change.

## Current Limitations (Phase 1)

- **Single Condition Only:** Each rule can have only one condition (AND/OR logic coming in Phase 2)
- **Basic Actions:** Limited to category, tags, and notes
- **No Scheduling:** Rules apply immediately, no time-based conditions
- **Manual Statistics:** Rule statistics update when rules execute

## Troubleshooting

### Rule Not Matching
1. Check that the rule is **enabled**
2. Verify the **field** and **operator** are correct
3. Ensure the **value** matches exactly (case-sensitive for some operators)
4. Check rule **priority** - higher priority rules may override

### Unexpected Results
1. Review rule **priority** order
2. Check for **conflicting rules**
3. Use **"Apply to Existing"** cautiously - it processes ALL transactions

### Performance Issues
- Limit to essential rules (recommend < 20 active rules)
- Use specific conditions rather than broad patterns
- Higher priority for frequently used rules

## Coming Soon (Future Phases)

### Phase 2 - Advanced Features
- **Complex Conditions:** AND/OR logic, multiple criteria
- **Rule Templates:** Pre-built rules for common scenarios
- **Voice Commands:** "Create rule to categorize Amazon as Shopping"
- **Merchant Detection:** Automatic merchant field population
- **Date/Time Conditions:** Weekend rules, monthly patterns

### Phase 3 - Intelligence
- **Smart Suggestions:** AI-powered rule recommendations
- **Analytics Dashboard:** Rule effectiveness insights
- **Import/Export:** Share rules between users
- **Conditional Formatting:** Visual indicators for rule-processed transactions

## Support

### Getting Help
- Check this guide for common scenarios
- Use the **test on existing transactions** feature to verify rules
- Start with simple rules and build complexity gradually

### Reporting Issues
If you encounter problems:
1. Note the specific rule configuration
2. Describe the expected vs actual behavior
3. Check browser console for error messages

---

*This guide will be updated as new features are released. Check the version number and last updated date for the latest information.*