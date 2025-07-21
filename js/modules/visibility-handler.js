// Visibility Handler Module
// Prevents unwanted refreshes when switching tabs

let isTabVisible = true;
let lastVisibilityChange = Date.now();
let preventAuthRefresh = false;

// Track tab visibility changes
export function initVisibilityHandler() {
  // Handle visibility change events
  document.addEventListener('visibilitychange', () => {
    const now = Date.now();
    const timeSinceLastChange = now - lastVisibilityChange;
    
    if (document.hidden) {
      // Tab is now hidden
      isTabVisible = false;
      console.log('Tab hidden');
    } else {
      // Tab is now visible
      isTabVisible = true;
      console.log('Tab visible again after', timeSinceLastChange, 'ms');
      
      // Prevent auth refresh for a short period after tab becomes visible
      preventAuthRefresh = true;
      setTimeout(() => {
        preventAuthRefresh = false;
      }, 1000); // 1 second grace period
    }
    
    lastVisibilityChange = now;
  });
  
  // Handle focus events as backup
  window.addEventListener('focus', () => {
    if (!isTabVisible) {
      isTabVisible = true;
      console.log('Window focused');
    }
  });
  
  window.addEventListener('blur', () => {
    isTabVisible = false;
    console.log('Window blurred');
  });
}

// Check if tab is currently visible
export function isTabCurrentlyVisible() {
  return isTabVisible;
}

// Check if we should prevent auth refresh
export function shouldPreventAuthRefresh() {
  return preventAuthRefresh;
}

// Prevent page unload unless user explicitly wants to leave
export function preventUnintendedRefresh() {
  // Only warn if there are unsaved changes or important state
  window.addEventListener('beforeunload', (e) => {
    // Check if this is a visibility-related refresh attempt
    if (preventAuthRefresh) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
}
