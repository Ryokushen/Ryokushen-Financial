// js/modules/mobileMenu.js - Mobile menu functionality

import { eventManager } from './eventManager.js';

/**
 * Initialize mobile menu functionality
 */
export function initMobileMenu() {
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const tabNav = document.querySelector('.tab-nav');

  if (!menuToggle || !tabNav) {
    return;
  }

  // Toggle menu on button click
  eventManager.addEventListener(menuToggle, 'click', e => {
    e.stopPropagation();
    menuToggle.classList.toggle('active');
    tabNav.classList.toggle('mobile-open');

    // Toggle body scroll
    if (tabNav.classList.contains('mobile-open')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  // Close menu when clicking outside
  eventManager.addEventListener(document, 'click', e => {
    if (!tabNav.contains(e.target) && !menuToggle.contains(e.target)) {
      menuToggle.classList.remove('active');
      tabNav.classList.remove('mobile-open');
      document.body.style.overflow = '';
    }
  });

  // Close menu when tab is selected
  const tabButtons = tabNav.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    eventManager.addEventListener(btn, 'click', () => {
      if (window.innerWidth <= 768) {
        menuToggle.classList.remove('active');
        tabNav.classList.remove('mobile-open');
        document.body.style.overflow = '';
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
        menuToggle.classList.remove('active');
        tabNav.classList.remove('mobile-open');
        document.body.style.overflow = '';
      }
    }, 250);
  });

  // Handle swipe gestures
  let touchStartX = 0;
  let touchEndX = 0;

  eventManager.addEventListener(tabNav, 'touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });

  eventManager.addEventListener(tabNav, 'touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    const swipeThreshold = 50;
    const swipeDistance = touchStartX - touchEndX;

    // Swipe left to close
    if (swipeDistance > swipeThreshold) {
      menuToggle.classList.remove('active');
      tabNav.classList.remove('mobile-open');
      document.body.style.overflow = '';
    }
  }

  // Add keyboard navigation
  eventManager.addEventListener(document, 'keydown', e => {
    if (e.key === 'Escape' && tabNav.classList.contains('mobile-open')) {
      menuToggle.classList.remove('active');
      tabNav.classList.remove('mobile-open');
      document.body.style.overflow = '';
      menuToggle.focus(); // Return focus to toggle button
    }
  });
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
