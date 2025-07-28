// js/modules/dataTransform.js

import { debug } from './debug.js';

/**
 * Converts snake_case to camelCase
 */
export function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Converts camelCase to snake_case
 */
export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Transforms object keys from snake_case to camelCase
 */
export function transformToCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => transformToCamelCase(item));
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = snakeToCamel(key);
      result[camelKey] = transformToCamelCase(obj[key]);
      return result;
    }, {});
  }

  return obj;
}

/**
 * Transforms object keys from camelCase to snake_case
 */
export function transformToSnakeCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => transformToSnakeCase(item));
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = transformToSnakeCase(obj[key]);
      return result;
    }, {});
  }

  return obj;
}

/**
 * Data schemas for consistent transformation
 */
export const DataSchemas = {
  transaction: {
    fromDB: data => ({
      id: data.id,
      date: data.date,
      accountId: data.account_id,
      category: data.category,
      description: data.description,
      amount: parseFloat(data.amount),
      cleared: data.cleared,
      debtAccountId: data.debt_account_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }),
    toDB: data => ({
      date: data.date,
      account_id: data.accountId,
      category: data.category,
      description: data.description,
      amount: data.amount,
      cleared: data.cleared,
      debt_account_id: data.debtAccountId,
    }),
  },

  cashAccount: {
    fromDB: data => ({
      id: data.id,
      name: data.name,
      type: data.type,
      institution: data.institution,
      notes: data.notes,
      isActive: data.is_active,
      balance: 0, // Calculated separately
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }),
    toDB: data => ({
      name: data.name,
      type: data.type,
      institution: data.institution,
      notes: data.notes,
      is_active: data.isActive !== undefined ? data.isActive : true,
    }),
  },

  debtAccount: {
    fromDB: data => ({
      id: data.id,
      name: data.name,
      type: data.type,
      institution: data.institution,
      balance: parseFloat(data.balance),
      interestRate: parseFloat(data.interest_rate),
      minimumPayment: parseFloat(data.minimum_payment),
      creditLimit: data.credit_limit ? parseFloat(data.credit_limit) : null,
      dueDate: data.due_date,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }),
    toDB: data => ({
      name: data.name,
      type: data.type,
      institution: data.institution,
      balance: data.balance,
      interest_rate: data.interestRate,
      minimum_payment: data.minimumPayment,
      credit_limit: data.creditLimit,
      due_date: data.dueDate,
      notes: data.notes,
    }),
  },

  recurringBill: {
    fromDB: data => ({
      id: data.id,
      name: data.name,
      category: data.category,
      amount: parseFloat(data.amount),
      frequency: data.frequency,
      nextDue: data.next_due,
      accountId: data.account_id,
      paymentMethod: data.payment_method || 'cash',
      debtAccountId: data.debt_account_id,
      notes: data.notes,
      active: data.active !== false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }),
    toDB: data => ({
      name: data.name,
      category: data.category,
      amount: data.amount,
      frequency: data.frequency,
      next_due: data.nextDue,
      account_id: data.accountId,
      payment_method: data.paymentMethod,
      debt_account_id: data.debtAccountId,
      notes: data.notes,
      active: data.active,
    }),
  },

  savingsGoal: {
    fromDB: data => ({
      id: data.id,
      name: data.name,
      targetAmount: parseFloat(data.target_amount),
      currentAmount: parseFloat(data.current_amount),
      linkedAccountId: data.linked_account_id,
      targetDate: data.target_date,
      description: data.description,
      createdDate: data.created_date,
      completedDate: data.completed_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }),
    toDB: data => ({
      name: data.name,
      target_amount: data.targetAmount,
      current_amount: data.currentAmount,
      linked_account_id: data.linkedAccountId,
      target_date: data.targetDate,
      description: data.description,
      created_date: data.createdDate,
      completed_date: data.completedDate,
    }),
  },

  investmentAccount: {
    fromDB: data => ({
      id: data.id,
      name: data.name,
      institution: data.institution,
      accountType: data.account_type,
      balance: parseFloat(data.balance),
      dayChange: parseFloat(data.day_change),
      holdings: data.holdings || [],
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }),
    toDB: data => ({
      name: data.name,
      institution: data.institution,
      account_type: data.accountType,
      balance: data.balance,
      day_change: data.dayChange,
      notes: data.notes,
    }),
  },

  holding: {
    fromDB: data => ({
      id: data.id,
      accountId: data.account_id,
      symbol: data.symbol,
      company: data.company,
      shares: parseFloat(data.shares),
      currentPrice: parseFloat(data.current_price),
      value: parseFloat(data.value),
      lastUpdated: data.last_updated,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }),
    toDB: data => ({
      account_id: data.accountId,
      symbol: data.symbol,
      company: data.company,
      shares: data.shares,
      current_price: data.currentPrice,
      value: data.value,
    }),
  },
};

/**
 * Transform array of data from database format to frontend format
 */
export function transformFromDB(dataArray, schemaName) {
  const schema = DataSchemas[schemaName];
  if (!schema || !schema.fromDB) {
    debug.warn(`No schema found for ${schemaName}, using generic transformation`);
    return transformToCamelCase(dataArray);
  }

  if (Array.isArray(dataArray)) {
    return dataArray.map(item => schema.fromDB(item));
  }

  return schema.fromDB(dataArray);
}

/**
 * Transform data from frontend format to database format
 */
export function transformToDB(data, schemaName) {
  const schema = DataSchemas[schemaName];
  if (!schema || !schema.toDB) {
    debug.warn(`No schema found for ${schemaName}, using generic transformation`);
    return transformToSnakeCase(data);
  }

  return schema.toDB(data);
}
