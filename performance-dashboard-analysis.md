# Performance Dashboard Module Loading Analysis

## Module Loading Chain

### 1. Initial Import in app.js (Line 29)
```javascript
import { performanceDashboard } from './modules/performanceDashboard.js';
```
- The module is imported at the top level of app.js
- This is a named import of the exported singleton instance
- The import happens during initial app load

### 2. Tab Switch Handler in ui.js (Lines 115-133)
When the performance tab is clicked:
```javascript
else if (tabName === 'performance') {
    // Initialize performance dashboard when switching to it
    try {
      // Use dynamic import to avoid circular dependency issues
      import('./performanceDashboard.js')
        .then(module => {
          if (module.performanceDashboard) {
            debug.log('Initializing performance dashboard from ui.js');
            module.performanceDashboard.init();
          } else {
            debug.error('performanceDashboard not found in module');
          }
        })
        .catch(error => {
          debug.error('Failed to load performance dashboard module:', error);
        });
    } catch (error) {
      debug.error('Failed to initialize performance dashboard:', error);
    }
  }
```

### 3. Module Structure in performanceDashboard.js
- The module exports a singleton instance: `export const performanceDashboard = new PerformanceDashboard()`
- It imports simpleCharts module for charting functionality
- The init() method sets up event listeners and loads data

## Identified Issues

### Issue 1: Double Import Pattern
- The module is imported statically in app.js but never initialized there
- When switching tabs, ui.js uses dynamic import to re-import the same module
- This creates potential for multiple initialization attempts

### Issue 2: Circular Dependency Risk
- performanceDashboard imports from ui.js (showError, showSuccess)
- ui.js dynamically imports performanceDashboard
- This creates a circular dependency pattern

### Issue 3: Chart.js Loading Timing
- Chart.js is loaded via CDN in index.html
- The performanceDashboard checks for window.Chart availability
- There's a timing issue where Chart.js might not be fully loaded when the tab is clicked

### Issue 4: Event Listener Setup
- Event listeners are set up in setupEventListeners() during init()
- If elements don't exist when init() is called, listeners won't be attached
- There's a 100ms delay added to wait for DOM, but this might not be sufficient

## Recommendations

1. **Remove the static import from app.js** - It's not being used and creates confusion
2. **Use a single import pattern** - Either static with explicit initialization or dynamic
3. **Add Chart.js loading verification** before attempting to use it
4. **Implement proper error boundaries** for module loading failures
5. **Add debugging output** to trace the exact loading sequence

## Module Loading Flow Diagram

```
app.js loads
  ↓
performanceDashboard imported (but not initialized)
  ↓
User clicks performance tab
  ↓
ui.js switchTab('performance') called
  ↓
Dynamic import of performanceDashboard module
  ↓
performanceDashboard.init() called
  ↓
Sets up event listeners
  ↓
Loads dashboard data
  ↓
Attempts to render charts (may fail if Chart.js not ready)
```

## Console Error Investigation Steps

To debug loading issues:
1. Check browser console for specific error messages
2. Verify Chart.js is loaded: `console.log('Chart.js loaded:', !!window.Chart)`
3. Check if performanceDashboard is initialized: `console.log('Dashboard:', window.performanceDashboard)`
4. Trace module loading: Add debug statements at each step
5. Check for DOM element availability when init() runs