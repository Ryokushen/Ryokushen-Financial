// js/modules/ruleTemplates.js
import { debug } from './debug.js';

export const ruleTemplates = {
  // Common subscription services
  subscriptions: {
    name: 'Subscription Detection',
    description: 'Automatically categorize common subscription services',
    templates: [
      {
        id: 'netflix',
        name: 'Netflix Subscription',
        description: 'Categorize Netflix payments',
        rule: {
          name: 'Netflix Subscription',
          description: 'Automatically categorize Netflix payments as Entertainment',
          enabled: true,
          priority: 100,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'NETFLIX' },
              { field: 'description', operator: 'contains', value: 'NETFLIX.COM' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Entertainment' },
            { type: 'add_tag', value: 'subscription' },
          ],
        },
      },
      {
        id: 'spotify',
        name: 'Spotify Subscription',
        description: 'Categorize Spotify payments',
        rule: {
          name: 'Spotify Subscription',
          description: 'Automatically categorize Spotify payments as Entertainment',
          enabled: true,
          priority: 100,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'SPOTIFY' },
              { field: 'description', operator: 'contains', value: 'SPOTIFY USA' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Entertainment' },
            { type: 'add_tag', value: 'subscription' },
          ],
        },
      },
      {
        id: 'amazon_prime',
        name: 'Amazon Prime',
        description: 'Categorize Amazon Prime membership',
        rule: {
          name: 'Amazon Prime',
          description: 'Automatically categorize Amazon Prime as Shopping',
          enabled: true,
          priority: 100,
          conditions: {
            type: 'AND',
            items: [
              { field: 'description', operator: 'contains', value: 'AMAZON' },
              { field: 'description', operator: 'contains', value: 'PRIME' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Shopping' },
            { type: 'add_tag', value: 'subscription' },
          ],
        },
      },
      {
        id: 'gym_membership',
        name: 'Gym Membership',
        description: 'Categorize gym and fitness memberships',
        rule: {
          name: 'Gym Membership',
          description: 'Automatically categorize gym payments as Healthcare',
          enabled: true,
          priority: 100,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'PLANET FITNESS' },
              { field: 'description', operator: 'contains', value: '24 HOUR FITNESS' },
              { field: 'description', operator: 'contains', value: 'LA FITNESS' },
              { field: 'description', operator: 'contains', value: 'EQUINOX' },
              { field: 'description', operator: 'contains', value: 'ANYTIME FITNESS' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Healthcare' },
            { type: 'add_tag', value: 'fitness' },
          ],
        },
      },
    ],
  },

  // Income categorization
  income: {
    name: 'Income Detection',
    description: 'Automatically categorize different types of income',
    templates: [
      {
        id: 'salary',
        name: 'Salary/Paycheck',
        description: 'Categorize regular salary deposits',
        rule: {
          name: 'Salary Detection',
          description: 'Automatically categorize salary deposits',
          enabled: true,
          priority: 200,
          conditions: {
            type: 'AND',
            items: [
              { field: 'type', operator: 'equals', value: 'income' },
              {
                type: 'OR',
                items: [
                  { field: 'description', operator: 'contains', value: 'PAYROLL' },
                  { field: 'description', operator: 'contains', value: 'SALARY' },
                  { field: 'description', operator: 'contains', value: 'DIRECT DEP' },
                  { field: 'description', operator: 'contains', value: 'DIRECT DEPOSIT' },
                ],
              },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Income' },
            { type: 'add_tag', value: 'salary' },
          ],
        },
      },
      {
        id: 'tax_refund',
        name: 'Tax Refund',
        description: 'Categorize tax refunds',
        rule: {
          name: 'Tax Refund',
          description: 'Automatically categorize tax refunds',
          enabled: true,
          priority: 150,
          conditions: {
            type: 'AND',
            items: [
              { field: 'type', operator: 'equals', value: 'income' },
              {
                type: 'OR',
                items: [
                  { field: 'description', operator: 'contains', value: 'IRS' },
                  { field: 'description', operator: 'contains', value: 'TAX REF' },
                  { field: 'description', operator: 'contains', value: 'STATE TAX' },
                ],
              },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Misc' },
            { type: 'add_tag', value: 'tax-refund' },
          ],
        },
      },
    ],
  },

  // Dining and restaurants
  dining: {
    name: 'Dining & Restaurants',
    description: 'Categorize restaurant and food delivery transactions',
    templates: [
      {
        id: 'fast_food',
        name: 'Fast Food Chains',
        description: 'Categorize common fast food restaurants',
        rule: {
          name: 'Fast Food',
          description: 'Automatically categorize fast food as Food',
          enabled: true,
          priority: 80,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'MCDONALD' },
              { field: 'description', operator: 'contains', value: 'BURGER KING' },
              { field: 'description', operator: 'contains', value: 'SUBWAY' },
              { field: 'description', operator: 'contains', value: 'TACO BELL' },
              { field: 'description', operator: 'contains', value: 'WENDY' },
              { field: 'description', operator: 'contains', value: 'CHICK-FIL-A' },
              { field: 'description', operator: 'contains', value: 'CHIPOTLE' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Dining' },
            { type: 'add_tag', value: 'fast-food' },
          ],
        },
      },
      {
        id: 'food_delivery',
        name: 'Food Delivery Services',
        description: 'Categorize food delivery apps',
        rule: {
          name: 'Food Delivery',
          description: 'Automatically categorize food delivery as Food',
          enabled: true,
          priority: 90,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'DOORDASH' },
              { field: 'description', operator: 'contains', value: 'UBER EATS' },
              { field: 'description', operator: 'contains', value: 'GRUBHUB' },
              { field: 'description', operator: 'contains', value: 'POSTMATES' },
              { field: 'description', operator: 'contains', value: 'SEAMLESS' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Dining' },
            { type: 'add_tag', value: 'delivery' },
          ],
        },
      },
      {
        id: 'coffee_shops',
        name: 'Coffee Shops',
        description: 'Categorize coffee shop purchases',
        rule: {
          name: 'Coffee Shops',
          description: 'Automatically categorize coffee shops as Food',
          enabled: true,
          priority: 70,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'STARBUCKS' },
              { field: 'description', operator: 'contains', value: 'DUNKIN' },
              { field: 'description', operator: 'contains', value: 'PEET' },
              { field: 'description', operator: 'contains', value: 'COFFEE' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Dining' },
            { type: 'add_tag', value: 'coffee' },
          ],
        },
      },
    ],
  },

  // Transportation
  transportation: {
    name: 'Transportation',
    description: 'Categorize transportation-related expenses',
    templates: [
      {
        id: 'gas_stations',
        name: 'Gas Stations',
        description: 'Categorize gas station purchases',
        rule: {
          name: 'Gas Stations',
          description: 'Automatically categorize gas as Transportation',
          enabled: true,
          priority: 85,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'SHELL' },
              { field: 'description', operator: 'contains', value: 'CHEVRON' },
              { field: 'description', operator: 'contains', value: 'EXXON' },
              { field: 'description', operator: 'contains', value: 'MOBIL' },
              { field: 'description', operator: 'contains', value: 'BP GAS' },
              { field: 'description', operator: 'contains', value: 'ARCO' },
              { field: 'description', operator: 'contains', value: 'COSTCO GAS' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Transportation' },
            { type: 'add_tag', value: 'gas' },
          ],
        },
      },
      {
        id: 'rideshare',
        name: 'Rideshare Services',
        description: 'Categorize Uber/Lyft rides',
        rule: {
          name: 'Rideshare',
          description: 'Automatically categorize rideshare as Transportation',
          enabled: true,
          priority: 75,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'UBER' },
              { field: 'description', operator: 'contains', value: 'LYFT' },
              { field: 'description', operator: 'contains', value: 'TAXI' },
              { field: 'description', operator: 'contains', value: 'CAB' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Transportation' },
            { type: 'add_tag', value: 'rideshare' },
          ],
        },
      },
      {
        id: 'parking',
        name: 'Parking',
        description: 'Categorize parking expenses',
        rule: {
          name: 'Parking',
          description: 'Automatically categorize parking as Transportation',
          enabled: true,
          priority: 65,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'PARKING' },
              { field: 'description', operator: 'contains', value: 'PARK' },
              { field: 'description', operator: 'contains', value: 'METER' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Transportation' },
            { type: 'add_tag', value: 'parking' },
          ],
        },
      },
    ],
  },

  // Shopping
  shopping: {
    name: 'Shopping',
    description: 'Categorize shopping and retail transactions',
    templates: [
      {
        id: 'groceries',
        name: 'Grocery Stores',
        description: 'Categorize grocery shopping',
        rule: {
          name: 'Groceries',
          description: 'Automatically categorize groceries as Food',
          enabled: true,
          priority: 95,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'WHOLE FOODS' },
              { field: 'description', operator: 'contains', value: 'SAFEWAY' },
              { field: 'description', operator: 'contains', value: 'KROGER' },
              { field: 'description', operator: 'contains', value: 'TRADER JOE' },
              { field: 'description', operator: 'contains', value: 'WALMART' },
              { field: 'description', operator: 'contains', value: 'TARGET' },
              { field: 'description', operator: 'contains', value: 'ALBERTSONS' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Groceries' },
            { type: 'add_tag', value: 'groceries' },
          ],
        },
      },
      {
        id: 'online_shopping',
        name: 'Online Shopping',
        description: 'Categorize online shopping platforms',
        rule: {
          name: 'Online Shopping',
          description: 'Automatically categorize online shopping',
          enabled: true,
          priority: 60,
          conditions: {
            type: 'AND',
            items: [
              {
                type: 'OR',
                items: [
                  { field: 'description', operator: 'contains', value: 'AMAZON' },
                  { field: 'description', operator: 'contains', value: 'EBAY' },
                  { field: 'description', operator: 'contains', value: 'ETSY' },
                  { field: 'description', operator: 'contains', value: 'PAYPAL' },
                ],
              },
              {
                type: 'NOT',
                items: [{ field: 'description', operator: 'contains', value: 'PRIME' }],
              },
            ],
          },
          actions: [{ type: 'set_category', value: 'Shopping' }],
        },
      },
    ],
  },

  // Utilities and bills
  utilities: {
    name: 'Utilities & Bills',
    description: 'Categorize utility bills and recurring payments',
    templates: [
      {
        id: 'cell_phone',
        name: 'Cell Phone Bills',
        description: 'Categorize mobile phone bills',
        rule: {
          name: 'Cell Phone',
          description: 'Automatically categorize phone bills as Utilities',
          enabled: true,
          priority: 110,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'VERIZON' },
              { field: 'description', operator: 'contains', value: 'AT&T' },
              { field: 'description', operator: 'contains', value: 'T-MOBILE' },
              { field: 'description', operator: 'contains', value: 'SPRINT' },
              { field: 'description', operator: 'contains', value: 'CRICKET' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Utilities' },
            { type: 'add_tag', value: 'phone' },
          ],
        },
      },
      {
        id: 'internet',
        name: 'Internet Service',
        description: 'Categorize internet bills',
        rule: {
          name: 'Internet Service',
          description: 'Automatically categorize internet as Utilities',
          enabled: true,
          priority: 105,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'COMCAST' },
              { field: 'description', operator: 'contains', value: 'XFINITY' },
              { field: 'description', operator: 'contains', value: 'SPECTRUM' },
              { field: 'description', operator: 'contains', value: 'COX COMM' },
              { field: 'description', operator: 'contains', value: 'FIOS' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Utilities' },
            { type: 'add_tag', value: 'internet' },
          ],
        },
      },
      {
        id: 'electricity',
        name: 'Electric Bill',
        description: 'Categorize electricity bills',
        rule: {
          name: 'Electric Bill',
          description: 'Automatically categorize electric as Utilities',
          enabled: true,
          priority: 115,
          conditions: {
            type: 'OR',
            items: [
              { field: 'description', operator: 'contains', value: 'ELECTRIC' },
              { field: 'description', operator: 'contains', value: 'POWER' },
              { field: 'description', operator: 'contains', value: 'EDISON' },
              { field: 'description', operator: 'contains', value: 'PG&E' },
              { field: 'description', operator: 'contains', value: 'DUKE ENERGY' },
            ],
          },
          actions: [
            { type: 'set_category', value: 'Utilities' },
            { type: 'add_tag', value: 'electricity' },
          ],
        },
      },
    ],
  },
};

// Get all template categories
export function getTemplateCategories() {
  return Object.keys(ruleTemplates).map(key => ({
    id: key,
    name: ruleTemplates[key].name,
    description: ruleTemplates[key].description,
    templateCount: ruleTemplates[key].templates.length,
  }));
}

// Get templates for a specific category
export function getTemplatesByCategory(categoryId) {
  const category = ruleTemplates[categoryId];
  if (!category) {
    return [];
  }

  return category.templates;
}

// Get a specific template
export function getTemplate(categoryId, templateId) {
  const category = ruleTemplates[categoryId];
  if (!category) {
    return null;
  }

  return category.templates.find(t => t.id === templateId);
}

// Create a rule from template
export function createRuleFromTemplate(categoryId, templateId, customizations = {}) {
  const template = getTemplate(categoryId, templateId);
  if (!template) {
    return null;
  }

  // Deep clone the rule and apply customizations
  const rule = JSON.parse(JSON.stringify(template.rule));

  // Apply any customizations
  if (customizations.name) {
    rule.name = customizations.name;
  }
  if (customizations.description) {
    rule.description = customizations.description;
  }
  if (typeof customizations.enabled !== 'undefined') {
    rule.enabled = customizations.enabled;
  }
  if (typeof customizations.priority !== 'undefined') {
    rule.priority = customizations.priority;
  }

  return rule;
}

// Get suggested templates based on transaction patterns
export async function getSuggestedTemplates(transactions) {
  const suggestions = [];
  const seenMerchants = new Set();

  // Analyze transactions for patterns
  transactions.forEach(transaction => {
    const desc = transaction.description?.toUpperCase() || '';

    // Check for subscription patterns
    if (desc.includes('NETFLIX') && !seenMerchants.has('netflix')) {
      seenMerchants.add('netflix');
      suggestions.push({
        category: 'subscriptions',
        templateId: 'netflix',
        confidence: 0.9,
        reason: 'Found Netflix transactions',
      });
    }

    if (desc.includes('SPOTIFY') && !seenMerchants.has('spotify')) {
      seenMerchants.add('spotify');
      suggestions.push({
        category: 'subscriptions',
        templateId: 'spotify',
        confidence: 0.9,
        reason: 'Found Spotify transactions',
      });
    }

    // Check for gas station patterns
    const gasStations = ['SHELL', 'CHEVRON', 'EXXON', 'MOBIL', 'BP GAS'];
    for (const station of gasStations) {
      if (desc.includes(station) && !seenMerchants.has('gas')) {
        seenMerchants.add('gas');
        suggestions.push({
          category: 'transportation',
          templateId: 'gas_stations',
          confidence: 0.85,
          reason: 'Found gas station transactions',
        });
        break;
      }
    }

    // Check for food delivery
    const deliveryApps = ['DOORDASH', 'UBER EATS', 'GRUBHUB'];
    for (const app of deliveryApps) {
      if (desc.includes(app) && !seenMerchants.has('delivery')) {
        seenMerchants.add('delivery');
        suggestions.push({
          category: 'dining',
          templateId: 'food_delivery',
          confidence: 0.9,
          reason: 'Found food delivery transactions',
        });
        break;
      }
    }
  });

  return suggestions;
}
