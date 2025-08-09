// js/config.js
const SUPABASE_CONFIG = {
  url: 'https://rplbjnknqxdyjgsuavcp.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbGJqbmtucXhkeWpnc3VhdmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NjY2OTIsImV4cCI6MjA2NzQ0MjY5Mn0.09RYF_oOrH8mmPjLo7fulai7ofwW5k94Y3_CIJbn6rI',
};

// Finnhub API Configuration
const FINNHUB_CONFIG = {
  // Get your free API key from: https://finnhub.io/dashboard
  // Free tier allows 60 API calls per minute
  apiKey: localStorage.getItem('finnhub_api_key') || 'YOUR_API_KEY_HERE',
  baseUrl: 'https://finnhub.io/api/v1',
};

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
window.supabaseClient = supabase;

// Export configurations
window.finnhubConfig = FINNHUB_CONFIG;

// API Key Management Functions
window.setFinnhubApiKey = function (apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    alert('Please enter a valid API key');
    return false;
  }

  localStorage.setItem('finnhub_api_key', apiKey.trim());
  FINNHUB_CONFIG.apiKey = apiKey.trim();

  // Update the service if it exists
  if (window.stockApiService) {
    window.stockApiService.apiKey = apiKey.trim();
  }

  if (window.DEBUG || localStorage.getItem('debug') === 'true') {
    if (window.debug) {
      window.debug.log('Finnhub API key updated successfully');
    }
  }
  return true;
};

window.getFinnhubApiKey = function () {
  return FINNHUB_CONFIG.apiKey;
};

window.clearFinnhubApiKey = function () {
  localStorage.removeItem('finnhub_api_key');
  FINNHUB_CONFIG.apiKey = '';
  if (window.DEBUG || localStorage.getItem('debug') === 'true') {
    if (window.debug) {
      window.debug.log('Finnhub API key cleared');
    }
  }
};

// Check if API key is configured
window.isFinnhubConfigured = function () {
  const key = FINNHUB_CONFIG.apiKey;
  return key && key !== 'YOUR_API_KEY_HERE' && key.trim() !== '';
};

// API Key Setup Modal HTML (to be added to your index.html)
const API_KEY_MODAL_HTML = `
<div id="api-key-modal" class="modal" tabindex="-1" role="dialog" aria-labelledby="api-key-modal-title">
    <div class="modal-content">
        <div class="modal-header">
            <h3 id="api-key-modal-title">Configure Stock API</h3>
            <button class="close-btn" id="close-api-key-modal" aria-label="Close modal">&times;</button>
        </div>
        <div class="modal-body">
            <div class="info-note">
                <strong>Free Finnhub API Key Required</strong><br>
                To update stock prices automatically, you need a free API key from Finnhub.
                <ol style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Visit <a href="https://finnhub.io/dashboard" target="_blank">finnhub.io/dashboard</a></li>
                    <li>Sign up for a free account</li>
                    <li>Copy your API key</li>
                    <li>Paste it below</li>
                </ol>
                Free tier includes 60 API calls per minute.
            </div>
            <form id="api-key-form">
                <div class="form-group">
                    <label class="form-label" for="finnhub-api-key">Finnhub API Key</label>
                    <input type="text" id="finnhub-api-key" class="form-control" 
                           placeholder="Enter your Finnhub API key" required>
                    <small class="form-text">Your API key will be stored locally in your browser</small>
                </div>
                <div class="form-group">
                    <button type="button" id="test-api-key" class="btn btn--secondary">Test API Key</button>
                    <span id="api-test-result" style="margin-left: 0.5rem;"></span>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn--secondary" id="cancel-api-key-btn">Cancel</button>
                    <button type="submit" class="btn btn--primary" id="save-api-key-btn">Save & Enable</button>
                </div>
            </form>
        </div>
    </div>
</div>
`;

// Add the modal to the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add the API key modal to the page if it doesn't exist
  if (!document.getElementById('api-key-modal')) {
    document.body.insertAdjacentHTML('beforeend', API_KEY_MODAL_HTML);
    setupApiKeyModal();
  }

  // Show setup modal if API key is not configured
  if (!window.isFinnhubConfigured()) {
    if (window.debug) {
      window.debug.log('Finnhub API key not configured. Stock price updates will be disabled.');
    }
  }
});

function setupApiKeyModal() {
  const modal = document.getElementById('api-key-modal');
  const form = document.getElementById('api-key-form');
  const input = document.getElementById('finnhub-api-key');
  const testBtn = document.getElementById('test-api-key');
  const testResult = document.getElementById('api-test-result');

  // Load existing API key
  if (window.isFinnhubConfigured()) {
    input.value = window.getFinnhubApiKey();
  }

  // Modal controls
  document.getElementById('close-api-key-modal')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  document.getElementById('cancel-api-key-btn')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // Test API key - FIXED: Added timeout protection
  testBtn?.addEventListener('click', async () => {
    const apiKey = input.value.trim();
    if (!apiKey) {
      testResult.innerHTML =
        '<span style="color: var(--color-error);">Please enter an API key</span>';
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    testResult.innerHTML = '<span style="color: var(--color-info);">Testing connection...</span>';

    try {
      // Add timeout protection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${apiKey}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        } else {
          throw new Error(`API returned ${response.status}`);
        }
      }

      const data = await response.json();

      if (data.c && data.c > 0) {
        testResult.innerHTML = `<span style="color: var(--color-success);">✓ API key works! AAPL: $${data.c.toFixed(
          2
        )}</span>`;
      } else {
        testResult.innerHTML =
          '<span style="color: var(--color-error);">✗ Invalid API key or connection failed</span>';
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        testResult.innerHTML =
          '<span style="color: var(--color-error);">✗ Connection timeout - please try again</span>';
      } else {
        testResult.innerHTML = `<span style="color: var(--color-error);">✗ ${error.message}</span>`;
      }
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test API Key';
    }
  });

  // Save API key
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const apiKey = input.value.trim();

    if (window.setFinnhubApiKey(apiKey)) {
      modal.classList.remove('active');
      alert('API key saved! Stock price updates are now enabled.');

      // Reload the page to reinitialize services
      window.location.reload();
    }
  });
}

// Global function to open API configuration
window.openApiKeyModal = function () {
  const modal = document.getElementById('api-key-modal');
  if (modal) {
    modal.classList.add('active');
    const input = document.getElementById('finnhub-api-key');
    if (input && window.isFinnhubConfigured()) {
      input.value = window.getFinnhubApiKey();
    }
  }
};
