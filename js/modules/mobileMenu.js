// js/modules/mobileMenu.js - Mobile menu functionality

import { eventManager } from './eventManager.js';

/**
 * Initialize mobile menu functionality
 */
export function initMobileMenu() {
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const tabNav = document.querySelector('.tab-nav');
  let backdrop = document.querySelector('.mobile-menu-backdrop');

  if (!menuToggle || !tabNav) {
    return;
  }

  // Create backdrop if it doesn't exist
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'mobile-menu-backdrop';
    document.body.appendChild(backdrop);
  }

  // Toggle menu on button click
  eventManager.addEventListener(menuToggle, 'click', e => {
    e.stopPropagation();
    const isOpen = tabNav.classList.contains('dropdown-open');
    
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  function openDropdown() {
    menuToggle.classList.add('active');
    tabNav.classList.add('dropdown-open');
    backdrop.classList.add('active');
    menuToggle.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown() {
    menuToggle.classList.remove('active');
    tabNav.classList.remove('dropdown-open');
    backdrop.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  // Close menu when clicking outside or on backdrop
  eventManager.addEventListener(document, 'click', e => {
    if (!tabNav.contains(e.target) && !menuToggle.contains(e.target)) {
      closeDropdown();
    }
  });

  eventManager.addEventListener(backdrop, 'click', () => {
    closeDropdown();
  });

  // Close menu when tab is selected
  const tabButtons = tabNav.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    eventManager.addEventListener(btn, 'click', () => {
      if (window.innerWidth <= 768) {
        closeDropdown();
      }
    });
  });

  // Handle resize events
  let resizeTimeout;
  eventManager.addEventListener(window, 'resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (window.innerWidth > 768) {
        // Reset menu state on larger screens
        closeDropdown();
      }
    }, 250);
  });

  // Add keyboard navigation
  eventManager.addEventListener(document, 'keydown', e => {
    if (e.key === 'Escape' && tabNav.classList.contains('dropdown-open')) {
      closeDropdown();
      menuToggle.focus(); // Return focus to toggle button
    }
  });

  // Initialize ARIA attributes
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-controls', 'mobile-navigation');
  tabNav.setAttribute('id', 'mobile-navigation');
  tabNav.setAttribute('aria-labelledby', 'mobile-menu-toggle');
}

/**
 * Check if device is mobile
 * @returns {boolean}
 */
export function isMobile() {
  return window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Add mobile-specific class to body
 */
export function addMobileClass() {
  if (isMobile()) {
    document.body.classList.add('is-mobile');
  } else {
    document.body.classList.remove('is-mobile');
  }

  // Update on resize
  let resizeTimeout;
  eventManager.addEventListener(window, 'resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(addMobileClass, 250);
  });
}
