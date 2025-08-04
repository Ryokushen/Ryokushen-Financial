// js/modules/virtualScroll.js - Reusable Virtual Scrolling Component
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';
import { throttle } from './performanceUtils.js';

/**
 * Virtual Scrolling Component
 * Efficiently renders large lists by only showing visible items
 */
export class VirtualScroll {
  constructor(options) {
    this.container = options.container;
    this.items = options.items || [];
    this.rowHeight = options.rowHeight || 40;
    this.renderItem = options.renderItem;
    this.bufferSize = options.bufferSize || 5;
    this.visibleHeight = options.visibleHeight || 600;

    this.scrollTop = 0;
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.scrollHandler = null;
    this.intersectionObserver = null;
    this.lastRenderTime = 0;
    this.renderDebounceId = null;

    this.init();
  }

  init() {
    if (!this.container || !this.renderItem) {
      debug.error('VirtualScroll: Missing required options');
      return;
    }

    // Setup container
    this.setupContainer();

    // Initial render
    this.update();

    // Setup scroll handler
    this.setupScrollHandler();
  }

  setupContainer() {
    // Create wrapper elements
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'virtual-scroll-wrapper';
    this.wrapper.style.cssText = `
      height: ${this.visibleHeight}px;
      overflow: auto;
      position: relative;
    `;

    this.content = document.createElement('div');
    this.content.className = 'virtual-scroll-content';
    this.content.style.cssText = `
      position: relative;
      min-height: ${this.items.length * this.rowHeight}px;
    `;

    this.viewport = document.createElement('div');
    this.viewport.className = 'virtual-scroll-viewport';
    this.viewport.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      will-change: transform;
    `;

    // Add ARIA attributes for accessibility
    this.wrapper.setAttribute('role', 'region');
    this.wrapper.setAttribute('aria-label', 'Scrollable list');
    this.wrapper.setAttribute('tabindex', '0');

    // Clear container and add wrapper
    this.container.innerHTML = '';
    this.content.appendChild(this.viewport);
    this.wrapper.appendChild(this.content);
    this.container.appendChild(this.wrapper);
  }

  setupScrollHandler() {
    this.scrollHandler = throttle(() => {
      this.scrollTop = this.wrapper.scrollTop;
      this.update();
    }, 16); // ~60fps

    eventManager.addEventListener(this.wrapper, 'scroll', this.scrollHandler);
  }

  update() {
    // Calculate visible range
    const visibleStart = Math.floor(this.scrollTop / this.rowHeight);
    const visibleEnd = Math.ceil((this.scrollTop + this.visibleHeight) / this.rowHeight);

    // Add buffer for smooth scrolling
    this.visibleStart = Math.max(0, visibleStart - this.bufferSize);
    this.visibleEnd = Math.min(this.items.length, visibleEnd + this.bufferSize);

    // Only re-render if range changed significantly
    if (
      Math.abs(this.visibleStart - visibleStart) > 2 ||
      Math.abs(this.visibleEnd - visibleEnd) > 2
    ) {
      // Debounce rapid renders
      if (this.renderDebounceId) {
        clearTimeout(this.renderDebounceId);
      }

      const now = performance.now();
      const timeSinceLastRender = now - this.lastRenderTime;

      // If we rendered recently, delay the next render
      if (timeSinceLastRender < 16) {
        // ~60fps
        this.renderDebounceId = setTimeout(() => {
          this.render();
          this.lastRenderTime = performance.now();
        }, 16 - timeSinceLastRender);
      } else {
        this.render();
        this.lastRenderTime = now;
      }
    }
  }

  render() {
    // Calculate offset for visible items
    const offsetY = this.visibleStart * this.rowHeight;
    this.viewport.style.transform = `translateY(${offsetY}px)`;

    // Reuse existing DOM nodes when possible
    const existingNodes = Array.from(this.viewport.children);
    const neededCount = this.visibleEnd - this.visibleStart;

    // Remove excess nodes
    while (existingNodes.length > neededCount) {
      const node = existingNodes.pop();
      this.viewport.removeChild(node);
    }

    // Update or create nodes
    for (let i = 0; i < neededCount; i++) {
      const itemIndex = this.visibleStart + i;
      const item = this.items[itemIndex];
      if (!item) continue;

      let element = existingNodes[i];

      if (element) {
        // Update existing element
        const newElement = this.renderItem(item, itemIndex);
        if (newElement && newElement !== element) {
          // Replace only if renderItem returns a new element
          element.replaceWith(newElement);
          element = newElement;
        }
      } else {
        // Create new element
        element = this.renderItem(item, itemIndex);
        if (element) {
          this.viewport.appendChild(element);
        }
      }

      if (element) {
        // Ensure proper height and attributes
        element.style.height = `${this.rowHeight}px`;
        element.style.position = 'relative';
        element.setAttribute('role', 'row');
        element.setAttribute('aria-rowindex', itemIndex + 1);
      }
    }

    // Update ARIA live region
    this.updateAccessibility();
  }

  updateAccessibility() {
    const totalItems = this.items.length;
    const currentPosition = Math.floor(this.scrollTop / this.rowHeight) + 1;

    this.wrapper.setAttribute(
      'aria-label',
      `Scrollable list. Showing items ${this.visibleStart + 1} to ${this.visibleEnd} of ${totalItems}. Current position: ${currentPosition}`
    );
  }

  setItems(items) {
    this.items = items || [];
    this.content.style.minHeight = `${this.items.length * this.rowHeight}px`;
    this.update();
  }

  scrollToIndex(index) {
    const targetScroll = index * this.rowHeight;
    this.wrapper.scrollTop = targetScroll;
  }

  scrollToTop() {
    this.wrapper.scrollTop = 0;
  }

  refresh() {
    this.update();
  }

  destroy() {
    if (this.scrollHandler) {
      eventManager.removeEventListener(this.wrapper, 'scroll', this.scrollHandler);
    }

    if (this.renderDebounceId) {
      clearTimeout(this.renderDebounceId);
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.items = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.scrollHandler = null;
    this.intersectionObserver = null;
  }

  /**
   * Get current scroll position info
   */
  getScrollInfo() {
    return {
      scrollTop: this.scrollTop,
      visibleStart: this.visibleStart,
      visibleEnd: this.visibleEnd,
      totalItems: this.items.length,
      scrollPercentage: this.scrollTop / (this.content.scrollHeight - this.visibleHeight),
    };
  }
}

/**
 * Factory function for easy creation
 */
export function createVirtualScroll(options) {
  return new VirtualScroll(options);
}
