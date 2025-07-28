// Debug Smart Rules event processing
console.log('🔍 Setting up Smart Rules event debugging...');

// Override addEventListener to log Smart Rules events
const originalAddEventListener = window.addEventListener;
window.addEventListener = function(type, listener, options) {
  if (type.includes('transaction:')) {
    console.log(`📡 Event listener registered for: ${type}`);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

// Log all transaction-related events
['transaction:added', 'transaction:created:withBalance', 'transaction:updated'].forEach(eventType => {
  window.addEventListener(eventType, (event) => {
    console.log(`🎯 Event fired: ${eventType}`, {
      hasDetail: !!event.detail,
      detail: event.detail,
      timestamp: new Date().toISOString()
    });
  });
});

// Check if Smart Rules is initialized
setTimeout(() => {
  if (window.smartRules) {
    console.log('✅ Smart Rules is initialized');
    console.log('📋 Smart Rules config:', window.smartRules.getConfig());
    console.log('📋 Rules loaded:', window.smartRules.rules.length);
  } else {
    console.log('❌ Smart Rules not found!');
  }
}, 1000);

console.log('Debug setup complete. Now create a transaction to see the event flow.');