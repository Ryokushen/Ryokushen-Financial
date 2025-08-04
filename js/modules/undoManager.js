// js/modules/undoManager.js - Undo/Redo System for Critical Operations

import { debug } from './debug.js';
import { showSuccess, showError } from './ui.js';
import { eventManager } from './eventManager.js';

/**
 * UndoManager - Manages undo/redo operations using Command pattern
 */
class UndoManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxStackSize = 20; // Keep last 20 operations
    this.isExecuting = false;

    this.setupKeyboardShortcuts();
    this.setupUI();
  }

  /**
   * Execute a command and add it to the undo stack
   */
  async execute(command) {
    if (this.isExecuting) {
      debug.warn('Command execution already in progress');
      return;
    }

    try {
      this.isExecuting = true;

      // Execute the command
      await command.execute();

      // Add to undo stack
      this.undoStack.push(command);

      // Limit stack size
      if (this.undoStack.length > this.maxStackSize) {
        this.undoStack.shift();
      }

      // Clear redo stack (new action invalidates redo history)
      this.redoStack = [];

      // Update UI
      this.updateUI();

      // Store in session storage
      this.saveToSession();
    } catch (error) {
      debug.error('Command execution failed:', error);
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Undo the last operation
   */
  async undo() {
    if (this.undoStack.length === 0 || this.isExecuting) {
      debug.log('Nothing to undo or operation in progress');
      return false;
    }

    try {
      this.isExecuting = true;

      // Pop from undo stack
      const command = this.undoStack.pop();

      // Execute undo
      await command.undo();

      // Push to redo stack
      this.redoStack.push(command);

      // Update UI
      this.updateUI();
      this.saveToSession();

      // Show feedback
      showSuccess(`Undid: ${command.description}`);

      return true;
    } catch (error) {
      debug.error('Undo failed:', error);
      showError('Failed to undo operation');
      return false;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Redo the last undone operation
   */
  async redo() {
    if (this.redoStack.length === 0 || this.isExecuting) {
      debug.log('Nothing to redo or operation in progress');
      return false;
    }

    try {
      this.isExecuting = true;

      // Pop from redo stack
      const command = this.redoStack.pop();

      // Execute the command again
      await command.execute();

      // Push back to undo stack
      this.undoStack.push(command);

      // Update UI
      this.updateUI();
      this.saveToSession();

      // Show feedback
      showSuccess(`Redid: ${command.description}`);

      return true;
    } catch (error) {
      debug.error('Redo failed:', error);
      showError('Failed to redo operation');
      return false;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Clear all undo/redo history
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.updateUI();
    this.clearSession();
  }

  /**
   * Get current undo/redo status
   */
  getStatus() {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      lastUndo: this.undoStack[this.undoStack.length - 1]?.description || null,
      lastRedo: this.redoStack[this.redoStack.length - 1]?.description || null,
    };
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    eventManager.addEventListener(document, 'keydown', e => {
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.redo();
      }
    });
  }

  /**
   * Setup UI elements
   */
  setupUI() {
    // Create undo/redo buttons if they don't exist
    const toolbar = document.querySelector('.toolbar-actions');
    if (toolbar && !document.getElementById('undo-btn')) {
      const undoBtn = document.createElement('button');
      undoBtn.id = 'undo-btn';
      undoBtn.className = 'btn btn--small btn--secondary';
      undoBtn.innerHTML = '↶ Undo';
      undoBtn.title = 'Undo (Ctrl+Z)';
      undoBtn.disabled = true;

      const redoBtn = document.createElement('button');
      redoBtn.id = 'redo-btn';
      redoBtn.className = 'btn btn--small btn--secondary';
      redoBtn.innerHTML = '↷ Redo';
      redoBtn.title = 'Redo (Ctrl+Y)';
      redoBtn.disabled = true;

      eventManager.addEventListener(undoBtn, 'click', () => this.undo());
      eventManager.addEventListener(redoBtn, 'click', () => this.redo());

      toolbar.appendChild(undoBtn);
      toolbar.appendChild(redoBtn);
    }

    this.updateUI();
  }

  /**
   * Update UI buttons
   */
  updateUI() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const status = this.getStatus();

    if (undoBtn) {
      undoBtn.disabled = !status.canUndo;
      undoBtn.title = status.lastUndo ? `Undo: ${status.lastUndo} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
    }

    if (redoBtn) {
      redoBtn.disabled = !status.canRedo;
      redoBtn.title = status.lastRedo ? `Redo: ${status.lastRedo} (Ctrl+Y)` : 'Redo (Ctrl+Y)';
    }

    // Dispatch event for other UI components
    window.dispatchEvent(new CustomEvent('undo:statusChanged', { detail: status }));
  }

  /**
   * Save state to session storage
   */
  saveToSession() {
    try {
      const state = {
        undoStack: this.undoStack.map(cmd => this.serializeCommand(cmd)),
        redoStack: this.redoStack.map(cmd => this.serializeCommand(cmd)),
      };
      sessionStorage.setItem('undoState', JSON.stringify(state));
    } catch (error) {
      debug.warn('Failed to save undo state:', error);
    }
  }

  /**
   * Load state from session storage
   */
  loadFromSession() {
    try {
      const stored = sessionStorage.getItem('undoState');
      if (stored) {
        const state = JSON.parse(stored);
        // Note: Commands would need to be reconstructed from serialized data
        // This is a placeholder - actual implementation would depend on command types
        debug.log('Undo state loaded from session');
      }
    } catch (error) {
      debug.warn('Failed to load undo state:', error);
    }
  }

  /**
   * Clear session storage
   */
  clearSession() {
    sessionStorage.removeItem('undoState');
  }

  /**
   * Serialize a command for storage
   */
  serializeCommand(command) {
    return {
      type: command.constructor.name,
      description: command.description,
      data: command.serialize ? command.serialize() : {},
    };
  }
}

/**
 * Base Command class
 */
export class Command {
  constructor(description = 'Operation') {
    this.description = description;
    this.executed = false;
  }

  async execute() {
    throw new Error('Execute method must be implemented');
  }

  async undo() {
    throw new Error('Undo method must be implemented');
  }

  serialize() {
    return {};
  }
}

/**
 * Transaction Command - for adding/deleting transactions
 */
export class TransactionCommand extends Command {
  constructor(transaction, operation, transactionManager) {
    const desc =
      operation === 'add'
        ? `Add transaction: ${transaction.description || 'New Transaction'}`
        : `Delete transaction: ${transaction.description || 'Transaction'}`;
    super(desc);
    this.transaction = transaction;
    this.operation = operation; // 'add' or 'delete'
    this.transactionManager = transactionManager;
    this.savedTransaction = null;
    this.skipUndo = false; // Flag to skip undo if needed
  }

  async execute() {
    try {
      if (this.operation === 'add') {
        // When executing add, save the transaction
        this.savedTransaction = await this.transactionManager.addTransaction(this.transaction, {
          skipUndo: true, // Prevent recursive undo tracking
        });
      } else if (this.operation === 'delete') {
        // When executing delete, save full transaction data first
        if (!this.transaction.id) {
          throw new Error('Cannot delete transaction without ID');
        }
        // Get full transaction data before deletion
        const fullTransaction = await this.transactionManager.getTransaction(this.transaction.id);
        if (fullTransaction) {
          this.transaction = fullTransaction; // Store full data for undo
        }
        await this.transactionManager.deleteTransaction(this.transaction.id, {
          skipUndo: true,
        });
      }
      this.executed = true;
    } catch (error) {
      debug.error('TransactionCommand execute failed:', error);
      throw error;
    }
  }

  async undo() {
    try {
      if (this.operation === 'add' && this.savedTransaction) {
        // Undo add by deleting
        await this.transactionManager.deleteTransaction(this.savedTransaction.id, {
          skipUndo: true,
        });
        this.savedTransaction = null;
      } else if (this.operation === 'delete') {
        // Undo delete by re-adding (without the ID)
        const transactionData = { ...this.transaction };
        delete transactionData.id; // Remove ID so database creates new one
        this.savedTransaction = await this.transactionManager.addTransaction(transactionData, {
          skipUndo: true,
        });
      }
    } catch (error) {
      debug.error('TransactionCommand undo failed:', error);
      throw error;
    }
  }

  serialize() {
    return {
      transaction: this.transaction,
      operation: this.operation,
      savedTransaction: this.savedTransaction,
    };
  }
}

/**
 * Account Update Command
 */
export class AccountUpdateCommand extends Command {
  constructor(accountId, accountType, oldData, newData, database) {
    super(`Update ${accountType} account`);
    this.accountId = accountId;
    this.accountType = accountType;
    this.oldData = oldData;
    this.newData = newData;
    this.database = database;
  }

  async execute() {
    switch (this.accountType) {
      case 'cash':
        await this.database.updateCashAccount(this.accountId, this.newData);
        break;
      case 'debt':
        await this.database.updateDebtAccount(this.accountId, this.newData);
        break;
      case 'investment':
        await this.database.updateInvestmentAccount(this.accountId, this.newData);
        break;
    }
    this.executed = true;
  }

  async undo() {
    switch (this.accountType) {
      case 'cash':
        await this.database.updateCashAccount(this.accountId, this.oldData);
        break;
      case 'debt':
        await this.database.updateDebtAccount(this.accountId, this.oldData);
        break;
      case 'investment':
        await this.database.updateInvestmentAccount(this.accountId, this.oldData);
        break;
    }
  }
}

/**
 * Batch Command - for grouping multiple commands
 */
export class BatchCommand extends Command {
  constructor(description, commands) {
    super(description);
    this.commands = commands;
  }

  async execute() {
    for (const command of this.commands) {
      await command.execute();
    }
    this.executed = true;
  }

  async undo() {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo();
    }
  }
}

// Create singleton instance
export const undoManager = new UndoManager();
