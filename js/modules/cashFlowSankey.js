/**
 * Cash Flow Sankey Visualization Module
 * Provides Monarch Money-style Sankey diagrams for income and expense flow
 */

import { formatCurrency } from './utils.js';
import { isPrivacyMode } from './privacy.js';
import db from '../database.js';

export const cashFlowSankey = {
  container: null,
  initialized: false,
  currentPeriod: 'month',
  privacyMode: false,
  currentZoom: 1,
  currentPanX: 0,
  currentPanY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  lastRenderedData: null,

  /**
   * Initialize the cash flow visualization
   */
  async init() {
    this.privacyMode = isPrivacyMode();
    this.initialized = true;
    await this.loadData();
  },

  /**
   * Load transaction data from database
   */
  async loadData() {
    try {
      const startDate = this.getStartDate();
      const endDate = new Date();

      const { data: transactions, error } = await db.supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      const processedData = this.processTransactions(transactions);
      this.render(processedData);
    } catch (error) {
      console.error('Error loading cash flow data:', error);
      this.showError('Failed to load transaction data');
    }
  },

  /**
   * Get start date based on current period
   */
  getStartDate() {
    const now = new Date();
    switch (this.currentPeriod) {
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter':
        return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  },

  /**
   * Process transactions into Sankey format
   */
  processTransactions(transactions) {
    const incomeByCategory = {};
    const expensesByCategory = {};
    let totalIncome = 0;
    let totalExpenses = 0;

    transactions.forEach(transaction => {
      const rawAmount = parseFloat(transaction.amount);
      const amount = Math.abs(rawAmount);

      // Check the sign of the original amount to determine type
      if (rawAmount > 0) {
        // Income (positive amounts)
        const category = transaction.category || 'Other Income';
        incomeByCategory[category] = (incomeByCategory[category] || 0) + amount;
        totalIncome += amount;
      } else if (rawAmount < 0) {
        // Expense (negative amounts)
        const category = transaction.category || 'Other';

        // Skip transfers between own accounts
        if (category.toLowerCase() === 'transfer') {
          return;
        }

        expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
        totalExpenses += amount;
      }
      // Skip zero amounts
    });

    // Convert to nodes and links format
    const nodes = [];
    const links = [];
    let nodeIndex = 0;
    const nodeMap = {};

    // Add income nodes
    Object.entries(incomeByCategory).forEach(([category, amount]) => {
      nodes.push({
        name: category,
        category: 'income',
        value: amount,
        index: nodeIndex,
      });
      nodeMap[category] = nodeIndex++;
    });

    // Add central "Total Income" node
    nodes.push({
      name: 'Total Income',
      category: 'pool',
      value: totalIncome,
      index: nodeIndex,
    });
    const incomePoolIndex = nodeIndex++;

    // Add expense nodes
    Object.entries(expensesByCategory).forEach(([category, amount]) => {
      nodes.push({
        name: category,
        category: this.getExpenseType(category),
        value: amount,
        index: nodeIndex,
      });
      nodeMap[category] = nodeIndex++;
    });

    // Create links from income to pool
    Object.entries(incomeByCategory).forEach(([category, amount]) => {
      links.push({
        source: nodeMap[category],
        target: incomePoolIndex,
        value: amount,
      });
    });

    // Create links from pool to expenses
    Object.entries(expensesByCategory).forEach(([category, amount]) => {
      links.push({
        source: incomePoolIndex,
        target: nodeMap[category],
        value: amount,
      });
    });

    return { nodes, links, totalIncome, totalExpenses };
  },

  /**
   * Categorize expense types for coloring
   */
  getExpenseType(category) {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('saving') || lowerCategory.includes('investment')) {
      return 'savings';
    } else if (lowerCategory.includes('debt') || lowerCategory.includes('loan')) {
      return 'debt';
    } else {
      return 'expense';
    }
  },

  /**
   * Render the Sankey diagram
   */
  render(data) {
    if (!this.container) {
      this.container = document.getElementById('cash-flow-sankey-container');
      if (!this.container) {
        console.error('Cash flow container not found');
        return;
      }
    }

    // Clear existing content
    this.container.innerHTML = '';

    // Create zoom controls
    const zoomControls = document.createElement('div');
    zoomControls.className = 'sankey-zoom-controls';
    zoomControls.innerHTML = `
      <button class="zoom-btn" id="zoom-in" title="Zoom In">+</button>
      <button class="zoom-btn" id="zoom-out" title="Zoom Out">−</button>
      <button class="zoom-btn" id="zoom-reset" title="Reset View">⟲</button>
      <span class="zoom-level">${Math.round(this.currentZoom * 100)}%</span>
    `;
    this.container.appendChild(zoomControls);

    // Create scrollable wrapper
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'sankey-scroll-wrapper';

    // Create the visualization structure
    const flowContainer = document.createElement('div');
    flowContainer.className = 'sankey-flow-container';
    flowContainer.style.transform = `scale(${this.currentZoom}) translate(${this.currentPanX}px, ${this.currentPanY}px)`;
    flowContainer.innerHTML = `
            <div class="sankey-column" id="income-column"></div>
            <div class="sankey-column" id="pool-column"></div>
            <div class="sankey-column" id="expense-column"></div>
            <svg class="sankey-flows-svg" id="flows-svg"></svg>
        `;

    scrollWrapper.appendChild(flowContainer);
    this.container.appendChild(scrollWrapper);

    // Set up event listeners
    this.setupZoomControls();
    this.setupPanControls(scrollWrapper);

    // Store data for redraws
    this.lastRenderedData = data;

    // Render nodes
    this.renderNodes(data.nodes);

    // Wait for layout then draw flows
    requestAnimationFrame(() => {
      this.drawFlows(data.links, data.nodes);
    });

    // Update statistics
    this.updateStats(data);
  },

  /**
   * Render node elements
   */
  renderNodes(nodes) {
    const incomeColumn = document.getElementById('income-column');
    const poolColumn = document.getElementById('pool-column');
    const expenseColumn = document.getElementById('expense-column');

    nodes.forEach(node => {
      const nodeEl = this.createNodeElement(node);

      if (node.category === 'income') {
        incomeColumn.appendChild(nodeEl);
      } else if (node.category === 'pool') {
        poolColumn.appendChild(nodeEl);
      } else {
        expenseColumn.appendChild(nodeEl);
      }
    });
  },

  /**
   * Create a node element
   */
  createNodeElement(node) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'sankey-node';
    nodeEl.dataset.index = node.index;
    nodeEl.dataset.name = node.name;
    nodeEl.dataset.value = node.value;

    const color = this.getNodeColor(node.name, node.category);
    nodeEl.style.background = `linear-gradient(135deg, ${color}20, ${color}10)`;
    nodeEl.style.borderColor = `${color}40`;

    const value = this.privacyMode || isPrivacyMode() ? '•••••' : formatCurrency(node.value);

    nodeEl.innerHTML = `
            <div class="sankey-node-label">${node.name}</div>
            <div class="sankey-node-value" data-sensitive="true">${value}</div>
        `;

    // Add hover effect
    nodeEl.addEventListener('mouseenter', () => {
      nodeEl.style.transform = 'translateX(5px)';
    });
    nodeEl.addEventListener('mouseleave', () => {
      nodeEl.style.transform = '';
    });

    return nodeEl;
  },

  /**
   * Get color for a node
   */
  getNodeColor(nodeName, category) {
    const colorMap = {
      // Income colors (greens)
      Salary: '#4ade80',
      Freelance: '#34d399',
      Investments: '#10b981',
      Dividends: '#059669',
      'Other Income': '#16a34a',

      // Pool color
      'Total Income': '#9333ea',

      // Expense colors
      Housing: '#f87171',
      Rent: '#f87171',
      Mortgage: '#ef4444',
      Transportation: '#fb923c',
      'Food & Dining': '#fbbf24',
      Groceries: '#fcd34d',
      Restaurants: '#f59e0b',
      Utilities: '#a78bfa',
      Insurance: '#60a5fa',
      Entertainment: '#f472b6',
      Shopping: '#c084fc',
      Healthcare: '#818cf8',
      Education: '#94a3b8',
      Savings: '#4ade80',
      'Savings Account': '#4ade80',
      Investment: '#10b981',
      'Investment Account': '#10b981',
      Debt: '#f87171',
      Other: '#e5e7eb',
    };

    return colorMap[nodeName] || (category === 'income' ? '#4ade80' : '#94a3b8');
  },

  /**
   * Draw SVG flow paths
   */
  drawFlows(links, nodes) {
    const svg = document.getElementById('flows-svg');
    if (!svg) {
      return;
    }

    const flowContainer = svg.parentElement;
    const containerRect = flowContainer.getBoundingClientRect();
    svg.innerHTML = '';

    // Create defs for gradients
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);

    // Create node map for quick lookup
    const nodeMap = {};
    nodes.forEach(node => {
      nodeMap[node.index] = node;
    });

    // Draw each link
    links.forEach((link, index) => {
      const sourceNode = document.querySelector(`[data-index="${link.source}"]`);
      const targetNode = document.querySelector(`[data-index="${link.target}"]`);

      if (!sourceNode || !targetNode) {
        return;
      }

      const sourceRect = sourceNode.getBoundingClientRect();
      const targetRect = targetNode.getBoundingClientRect();

      // Account for zoom scale in coordinate calculations
      const scale = this.currentZoom;
      const startX = (sourceRect.right - containerRect.left) / scale;
      const startY = (sourceRect.top + sourceRect.height / 2 - containerRect.top) / scale;
      const endX = (targetRect.left - containerRect.left) / scale;
      const endY = (targetRect.top + targetRect.height / 2 - containerRect.top) / scale;

      // Calculate stroke width based on value
      const maxValue = Math.max(...links.map(l => l.value));
      const strokeWidth = Math.max(2, Math.min(50, (link.value / maxValue) * 50));

      // Create gradient
      const gradientId = `gradient-${index}`;
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      gradient.setAttribute('id', gradientId);

      const sourceNodeData = nodeMap[link.source];
      const targetNodeData = nodeMap[link.target];

      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute(
        'stop-color',
        this.getNodeColor(sourceNodeData.name, sourceNodeData.category)
      );
      stop1.setAttribute('stop-opacity', '0.6');
      gradient.appendChild(stop1);

      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute(
        'stop-color',
        this.getNodeColor(targetNodeData.name, targetNodeData.category)
      );
      stop2.setAttribute('stop-opacity', '0.6');
      gradient.appendChild(stop2);

      defs.appendChild(gradient);

      // Create path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midX = (startX + endX) / 2;
      path.setAttribute(
        'd',
        `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`
      );
      path.setAttribute('stroke', `url(#${gradientId})`);
      path.setAttribute('stroke-width', strokeWidth);
      path.setAttribute('fill', 'none');
      path.setAttribute('class', 'sankey-flow-path');

      // Add interactivity
      path.style.cursor = 'pointer';
      path.addEventListener('mouseenter', e => {
        path.style.strokeOpacity = '0.9';
        this.showTooltip(e, sourceNodeData.name, targetNodeData.name, link.value);
      });

      path.addEventListener('mousemove', e => {
        this.updateTooltipPosition(e);
      });

      path.addEventListener('mouseleave', () => {
        path.style.strokeOpacity = '';
        this.hideTooltip();
      });

      svg.appendChild(path);
    });
  },

  /**
   * Show tooltip on hover
   */
  showTooltip(event, source, target, value) {
    let tooltip = document.getElementById('sankey-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'sankey-tooltip';
      tooltip.className = 'sankey-tooltip';
      document.body.appendChild(tooltip);
    }

    const displayValue = this.privacyMode || isPrivacyMode() ? '•••••' : formatCurrency(value);

    tooltip.innerHTML = `
            <strong>${source} → ${target}</strong><br>
            ${displayValue}
        `;
    tooltip.style.display = 'block';
    this.updateTooltipPosition(event);
  },

  /**
   * Update tooltip position
   */
  updateTooltipPosition(event) {
    const tooltip = document.getElementById('sankey-tooltip');
    if (tooltip) {
      tooltip.style.left = `${event.pageX + 10}px`;
      tooltip.style.top = `${event.pageY - 10}px`;
    }
  },

  /**
   * Hide tooltip
   */
  hideTooltip() {
    const tooltip = document.getElementById('sankey-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  },

  /**
   * Update statistics display
   */
  updateStats(data) {
    const updateStat = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = this.privacyMode || isPrivacyMode() ? '•••••' : formatCurrency(value);
      }
    };

    updateStat('sankey-total-income', data.totalIncome);
    updateStat('sankey-total-expenses', data.totalExpenses);
    updateStat('sankey-net-savings', data.totalIncome - data.totalExpenses);

    const savingsRate =
      data.totalIncome > 0
        ? (((data.totalIncome - data.totalExpenses) / data.totalIncome) * 100).toFixed(1)
        : 0;

    const rateElement = document.getElementById('sankey-savings-rate');
    if (rateElement) {
      rateElement.textContent = this.privacyMode || isPrivacyMode() ? '•••' : `${savingsRate}%`;
    }
  },

  /**
   * Change time period
   */
  async setPeriod(period) {
    this.currentPeriod = period;
    await this.loadData();
  },

  /**
   * Toggle privacy mode
   */
  togglePrivacy() {
    this.privacyMode = isPrivacyMode();
    this.loadData();
  },

  /**
   * Set up zoom controls
   */
  setupZoomControls() {
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const zoomReset = document.getElementById('zoom-reset');
    const flowContainer = document.querySelector('.sankey-flow-container');

    zoomIn?.addEventListener('click', () => {
      this.currentZoom = Math.min(this.currentZoom + 0.1, 3);
      this.updateTransform(flowContainer);
    });

    zoomOut?.addEventListener('click', () => {
      this.currentZoom = Math.max(this.currentZoom - 0.1, 0.5);
      this.updateTransform(flowContainer);
    });

    zoomReset?.addEventListener('click', () => {
      this.currentZoom = 1;
      this.currentPanX = 0;
      this.currentPanY = 0;
      this.updateTransform(flowContainer);
    });

    // Mouse wheel zoom
    this.container.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.currentZoom = Math.max(0.5, Math.min(3, this.currentZoom + delta));
        this.updateTransform(flowContainer);
      }
    });
  },

  /**
   * Set up pan controls
   */
  setupPanControls(scrollWrapper) {
    const flowContainer = document.querySelector('.sankey-flow-container');

    // Mouse drag to pan
    scrollWrapper.addEventListener('mousedown', e => {
      if (e.button === 0) {
        // Left click
        this.isDragging = true;
        this.dragStartX = e.clientX - this.currentPanX;
        this.dragStartY = e.clientY - this.currentPanY;
        scrollWrapper.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', e => {
      if (this.isDragging) {
        this.currentPanX = e.clientX - this.dragStartX;
        this.currentPanY = e.clientY - this.dragStartY;
        this.updateTransform(flowContainer);
      }
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      const wrapper = document.querySelector('.sankey-scroll-wrapper');
      if (wrapper) {
        wrapper.style.cursor = 'grab';
      }
    });

    // Touch support for mobile
    let touchStartX = 0;
    let touchStartY = 0;

    scrollWrapper.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      touchStartX = touch.clientX - this.currentPanX;
      touchStartY = touch.clientY - this.currentPanY;
    });

    scrollWrapper.addEventListener('touchmove', e => {
      e.preventDefault();
      const touch = e.touches[0];
      this.currentPanX = touch.clientX - touchStartX;
      this.currentPanY = touch.clientY - touchStartY;
      this.updateTransform(flowContainer);
    });
  },

  /**
   * Update transform of the flow container
   */
  updateTransform(container) {
    if (container) {
      container.style.transform = `scale(${this.currentZoom}) translate(${this.currentPanX}px, ${this.currentPanY}px)`;
      container.style.transformOrigin = '0 0';

      // Update zoom level display
      const zoomLevel = document.querySelector('.zoom-level');
      if (zoomLevel) {
        zoomLevel.textContent = `${Math.round(this.currentZoom * 100)}%`;
      }

      // Redraw flows to fix coordinate alignment
      if (this.lastRenderedData) {
        requestAnimationFrame(() => {
          this.drawFlows(this.lastRenderedData.links, this.lastRenderedData.nodes);
        });
      }
    }
  },

  /**
   * Export diagram as image
   */
  async exportDiagram() {
    // TODO: Implement export functionality
    console.log('Export functionality to be implemented');
  },

  /**
   * Show error message
   */
  showError(message) {
    if (this.container) {
      this.container.innerHTML = `
                <div class="error-state">
                    <p>${message}</p>
                </div>
            `;
    }
  },
};
