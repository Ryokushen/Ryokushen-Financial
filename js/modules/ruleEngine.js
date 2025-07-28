// js/modules/ruleEngine.js
import { debug } from './debug.js';
import database from '../database.js';
import { transactionManager } from './transactionManager.js';

class RuleEngine {
  constructor() {
    this.operators = {
      // String operators
      contains: (value, target) => {
        if (typeof value !== 'string' || typeof target !== 'string') {
          debug.log(`RuleEngine: contains operator - value or target not string. value: ${typeof value}, target: ${typeof target}`);
          return false;
        }
        const result = value.toLowerCase().includes(target.toLowerCase());
        debug.log(`RuleEngine: contains check - "${value}" contains "${target}"? ${result}`);
        return result;
      },

      equals: (value, target) => {
        return value === target;
      },

      equals_ignore_case: (value, target) => {
        if (typeof value !== 'string' || typeof target !== 'string') {
          return false;
        }
        return value.toLowerCase() === target.toLowerCase();
      },

      starts_with: (value, target) => {
        if (typeof value !== 'string' || typeof target !== 'string') {
          return false;
        }
        return value.toLowerCase().startsWith(target.toLowerCase());
      },

      ends_with: (value, target) => {
        if (typeof value !== 'string' || typeof target !== 'string') {
          return false;
        }
        return value.toLowerCase().endsWith(target.toLowerCase());
      },

      // Numeric operators
      greater_than: (value, target) => {
        return parseFloat(value) > parseFloat(target);
      },

      less_than: (value, target) => {
        return parseFloat(value) < parseFloat(target);
      },

      greater_than_or_equal: (value, target) => {
        return parseFloat(value) >= parseFloat(target);
      },

      less_than_or_equal: (value, target) => {
        return parseFloat(value) <= parseFloat(target);
      },

      between: (value, target) => {
        const num = parseFloat(value);
        const [min, max] = target.split(',').map(v => parseFloat(v.trim()));
        return num >= min && num <= max;
      },

      // Special operators
      regex: (value, pattern) => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(value);
        } catch (error) {
          debug.error('RuleEngine: Invalid regex pattern', pattern, error);
          return false;
        }
      },

      in_list: (value, list) => {
        const items = list.split(',').map(item => item.trim().toLowerCase());
        return items.includes(value.toLowerCase());
      },
    };
  }

  // Process a transaction through all rules
  async process(transaction, rules) {
    debug.log(`RuleEngine: Processing transaction through ${rules.length} rules`);

    for (const rule of rules) {
      if (!rule.enabled) {
        debug.log(`RuleEngine: Skipping disabled rule "${rule.name}"`);
        continue;
      }

      debug.log(`RuleEngine: Evaluating rule "${rule.name}"`);
      const matches = this.evaluateConditions(transaction, rule.conditions);

      if (matches) {
        debug.log(`RuleEngine: Rule "${rule.name}" matched!`);
        // Apply actions
        const results = await this.applyActions(transaction, rule.actions);

        return {
          matched: true,
          rule,
          ruleId: rule.id,
          actions: results,
        };
      } else {
        debug.log(`RuleEngine: Rule "${rule.name}" did not match`);
      }
    }

    debug.log('RuleEngine: No rules matched the transaction');
    return { matched: false };
  }

  // Find all rules that match a transaction (for preview/testing)
  findMatchingRules(transaction, rules) {
    const matches = [];

    for (const rule of rules) {
      if (this.evaluateConditions(transaction, rule.conditions)) {
        matches.push(rule);
      }
    }

    return matches;
  }

  // Evaluate rule conditions (supports nested groups)
  evaluateConditions(transaction, conditions) {
    if (!conditions) {
      return false;
    }

    // Handle single condition (backward compatibility)
    if (conditions.field && conditions.operator) {
      return this.evaluateCondition(transaction, conditions);
    }

    // Handle condition groups
    if (!conditions.items || conditions.items.length === 0) {
      return false;
    }

    const type = conditions.type || 'AND';

    // Special handling for NOT operator
    if (type === 'NOT') {
      // NOT should have exactly one child condition/group
      const childResult =
        conditions.items.length > 0
          ? this.evaluateConditionOrGroup(transaction, conditions.items[0])
          : false;
      return !childResult;
    }

    // Evaluate each item (which can be a condition or nested group)
    const results = conditions.items.map(item => this.evaluateConditionOrGroup(transaction, item));

    if (type === 'AND') {
      return results.every(result => result === true);
    } else if (type === 'OR') {
      return results.some(result => result === true);
    }

    return false;
  }

  // Helper to evaluate either a single condition or a nested group
  evaluateConditionOrGroup(transaction, item) {
    // If it has a 'type' property with items, it's a nested group
    if (item.type && item.items) {
      return this.evaluateConditions(transaction, item);
    }
    // Otherwise it's a single condition
    return this.evaluateCondition(transaction, item);
  }

  // Evaluate a single condition
  evaluateCondition(transaction, condition) {
    const { field, operator, value, case_sensitive } = condition;

    // Get the field value from the transaction
    let fieldValue = this.getFieldValue(transaction, field);

    debug.log(
      `RuleEngine: Evaluating condition - field: ${field}, operator: ${operator}, value: ${value}, fieldValue: ${fieldValue}`
    );

    // Special handling for empty/null/undefined values
    if (fieldValue === undefined || fieldValue === null) {
      fieldValue = ''; // Treat null/undefined as empty string
      debug.log(`RuleEngine: Field value is undefined/null for field: ${field}, treating as empty string`);
    }

    // Handle case sensitivity for string comparisons
    if (!case_sensitive && typeof fieldValue === 'string' && operator !== 'regex') {
      fieldValue = fieldValue.toLowerCase();
    }

    // Get the operator function
    const operatorFn = this.operators[operator];
    if (!operatorFn) {
      debug.error('RuleEngine: Unknown operator', operator);
      return false;
    }

    // Apply the operator
    const result = operatorFn(fieldValue, value);
    debug.log(`RuleEngine: Condition result: ${result}`);
    return result;
  }

  // Get field value from transaction
  getFieldValue(transaction, field) {
    switch (field) {
      case 'description':
        return transaction.description || '';
      case 'amount':
        return Math.abs(transaction.amount); // Use absolute value for comparisons
      case 'category':
        return transaction.category || '';
      case 'account':
        return transaction.account_id;
      case 'account_name':
        // Would need to be passed in or looked up
        return transaction.account_name || '';
      case 'type':
        return transaction.amount >= 0 ? 'income' : 'expense';
      case 'date':
        return transaction.date;
      case 'day_of_week':
        return new Date(transaction.date).getDay();
      case 'month':
        return new Date(transaction.date).getMonth() + 1;
      default:
        return transaction[field];
    }
  }

  // Apply rule actions to a transaction
  async applyActions(transaction, actions) {
    const results = [];

    for (const action of actions) {
      try {
        const result = await this.applyAction(transaction, action);
        results.push(result);
      } catch (error) {
        debug.error('RuleEngine: Error applying action', action, error);
        results.push({
          success: false,
          action: action.type,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Apply a single action
  async applyAction(transaction, action) {
    switch (action.type) {
      case 'set_category':
        // Update the transaction category using TransactionManager
        try {
          const updatedTransaction = await transactionManager.updateTransaction(transaction.id, {
            category: action.value,
          });

          return {
            success: true,
            action: 'set_category',
            value: action.value,
          };
        } catch (error) {
          throw new Error(`Failed to update category: ${error.message}`);
        }

      case 'add_tag':
        // Add a tag to the transaction (would need tags field in DB)
        // For now, we'll add it to the description
        const newDescription = transaction.description
          ? `${transaction.description} #${action.value}`
          : `#${action.value}`;

        try {
          const updatedTransaction = await transactionManager.updateTransaction(transaction.id, {
            description: newDescription,
          });

          return {
            success: true,
            action: 'add_tag',
            value: action.value,
          };
        } catch (error) {
          throw new Error(`Failed to add tag: ${error.message}`);
        }

      case 'add_note':
        // Add note to transaction (using description for now)
        const noteDescription = transaction.description
          ? `${transaction.description} | ${action.value}`
          : action.value;

        try {
          const updatedTransaction = await transactionManager.updateTransaction(transaction.id, {
            description: noteDescription,
          });

          return {
            success: true,
            action: 'add_note',
            value: action.value,
          };
        } catch (error) {
          throw new Error(`Failed to add note: ${error.message}`);
        }

      case 'alert':
        // Emit an event for the alert (UI can handle displaying it)
        const alertData = {
          transaction,
          message: action.value,
          timestamp: new Date().toISOString(),
        };

        // Store alert in a queue or emit event
        window.dispatchEvent(new CustomEvent('rule:alert', { detail: alertData }));

        return {
          success: true,
          action: 'alert',
          value: action.value,
        };

      default:
        return {
          success: false,
          action: action.type,
          error: 'Unknown action type',
        };
    }
  }
}

export const ruleEngine = new RuleEngine();
