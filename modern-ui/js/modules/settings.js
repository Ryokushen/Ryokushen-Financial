// Settings Module

import config from '../config.js'

// Render settings page
export async function renderSettings(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  container.innerHTML = `
    <div class="settings-page">
      <div class="page-header mb-6">
        <h2>Settings</h2>
      </div>
      
      <div class="settings-sections">
        <div class="settings-section glass-panel mb-6">
          <h3 class="mb-4">Appearance</h3>
          <div class="settings-item">
            <label>Theme</label>
            <select class="input-glass" id="theme-select">
              <option value="dark" ${appState.theme === 'dark' ? 'selected' : ''}>Dark</option>
              <option value="light" ${appState.theme === 'light' ? 'selected' : ''}>Light</option>
              <option value="system" ${appState.theme === 'system' ? 'selected' : ''}>System</option>
            </select>
          </div>
        </div>
        
        <div class="settings-section glass-panel mb-6">
          <h3 class="mb-4">Privacy</h3>
          <div class="settings-item">
            <label>
              <input type="checkbox" ${appState.privacyMode ? 'checked' : ''}>
              Enable Privacy Mode
            </label>
            <p class="text-sm text-secondary mt-2">Hide sensitive financial information</p>
          </div>
        </div>
        
        <div class="settings-section glass-panel">
          <h3 class="mb-4">About</h3>
          <p class="text-secondary">Ryokushen Financial v${config.APP_CONFIG.version}</p>
          <p class="text-sm text-tertiary mt-2">A privacy-focused personal finance manager</p>
        </div>
      </div>
    </div>
  `
}