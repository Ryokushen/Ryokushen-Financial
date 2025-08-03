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
    if (Math.abs(this.visibleStart - visibleStart) > 2 || 
        Math.abs(this.visibleEnd - visibleEnd) > 2) {
      this.render();
    }
  }
  
  render() {
    // Clear viewport
    this.viewport.innerHTML = '';
    
    // Calculate offset for visible items
    const offsetY = this.visibleStart * this.rowHeight;
    this.viewport.style.transform = `translateY(${offsetY}px)`;
    
    // Render visible items
    const fragment = document.createDocumentFragment();
    
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      const item = this.items[i];
      if (!item) continue;
      
      const element = this.renderItem(item, i);
      if (element) {
        // Ensure proper height
        element.style.height = `${this.rowHeight}px`;
        element.style.position = 'relative';
        
        // Add ARIA attributes
        element.setAttribute('role', 'row');
        element.setAttribute('aria-rowindex', i + 1);
        
        fragment.appendChild(element);
      }
    }
    
    this.viewport.appendChild(fragment);
    
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
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.items = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;
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
      scrollPercentage: this.scrollTop / (this.content.scrollHeight - this.visibleHeight)
    };
  }
}

/**
 * Factory function for easy creation
 */
export function createVirtualScroll(options) {
  return new VirtualScroll(options);
}