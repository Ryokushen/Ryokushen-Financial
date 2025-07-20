// Settings Module - Modern Design

import { formatCurrency, maskCurrency } from './ui.js'

// Mock settings data
const mockSettings = {
  privacyMode: false,
  masterPasswordSet: false,
  biometricEnabled: true,
  twoFactorEnabled: false,
  autoLockTimeout: '5 minutes',
  requireAuthOnLaunch: true,
  crashReports: true,
  usageAnalytics: false,
  securityScore: 85
}

// Mock activity data
const mockActivity = [
  {
    id: '1',
    action: 'Successful login',
    device: 'MacBook Pro • Safari • Arlington, TN',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  },
  {
    id: '2',
    action: 'Password changed',
    device: 'iPhone 14 • App • Arlington, TN',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
  },
  {
    id: '3',
    action: 'Biometric authentication enabled',
    device: 'MacBook Pro • Touch ID',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
  }
]

// Format time ago
function formatTimeAgo(date) {
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  } else if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''} ago`
  } else {
    const weeks = Math.floor(days / 7)
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  }
}

// Detect biometric support
function detectBiometricSupport() {
  // Mock detection - in real app would use WebAuthn API
  const userAgent = navigator.userAgent
  const isMac = /Mac/.test(userAgent)
  const isWindows = /Windows/.test(userAgent)
  const isMobile = /Mobile/.test(userAgent)
  
  if (isMac) {
    return { supported: true, type: 'Touch ID' }
  } else if (isWindows) {
    return { supported: true, type: 'Windows Hello' }
  } else if (isMobile) {
    return { supported: true, type: 'Fingerprint/Face ID' }
  }
  
  return { supported: false, type: null }
}

// Calculate security score improvements
function getSecurityImprovements(settings) {
  const improvements = []
  
  if (!settings.twoFactorEnabled) {
    improvements.push('Enable Two-Factor Authentication (+10 points)')
  }
  
  if (!settings.masterPasswordSet) {
    improvements.push('Set Master Password (+5 points)')
  }
  
  return improvements
}

// Render settings page
export async function renderSettings(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  const settings = mockSettings
  const activity = mockActivity
  const biometric = detectBiometricSupport()
  const improvements = getSecurityImprovements(settings)
  
  container.innerHTML = `
    <div class="settings-page">
      <!-- Page Header -->
      <div class="page-header">
        <h1 class="page-title">Privacy & Security Settings</h1>
        <p class="page-subtitle">Manage your account security and privacy preferences</p>
      </div>

      <!-- Security Score Card -->
      <div class="security-score-card">
        <div class="score-info">
          <div class="score-label">Your Security Score</div>
          <div class="score-value">${settings.securityScore}/100</div>
          <div class="score-status">${settings.securityScore >= 80 ? 'Good protection' : 'Needs improvement'} • ${improvements.length} improvement${improvements.length !== 1 ? 's' : ''} available</div>
        </div>
        <div class="score-visual">🛡️</div>
      </div>

      <!-- Settings Grid -->
      <div class="settings-grid">
        <!-- Privacy Mode -->
        <div class="setting-card">
          <div class="setting-header">
            <div class="setting-info">
              <h2 class="setting-title">
                <span class="setting-icon">🔒</span>
                Privacy Mode
              </h2>
              <p class="setting-description">Control how your app behaves for enhanced privacy</p>
            </div>
          </div>
          
          <div class="info-box">
            <div class="info-title">How Privacy Mode Works:</div>
            <ul class="info-list">
              <li>Enable privacy mode instantly without authentication (for quick privacy)</li>
              <li>Authentication required to disable privacy mode (prevents unauthorized access)</li>
              <li>Use biometric authentication, master password, or both for maximum security</li>
            </ul>
          </div>

          <div class="toggle-group">
            <span class="toggle-label">Enable Privacy Mode</span>
            <div class="toggle-switch${settings.privacyMode ? ' active' : ''}" id="privacy-mode-toggle">
              <div class="toggle-slider"></div>
            </div>
          </div>
        </div>

        <!-- Master Password -->
        <div class="setting-card">
          <div class="setting-header">
            <div class="setting-info">
              <h2 class="setting-title">
                <span class="setting-icon">🔑</span>
                Master Password
              </h2>
              <p class="setting-description">Set a master password as a backup authentication method or primary security option</p>
            </div>
          </div>

          ${!settings.masterPasswordSet ? `
            <div class="password-form">
              <div class="form-group">
                <label class="form-label">Master Password</label>
                <input type="password" class="form-input" id="master-password" placeholder="Enter a strong password">
              </div>
              <div class="password-actions">
                <button type="button" class="btn btn-primary" id="set-password-btn">Set Password</button>
              </div>
            </div>
          ` : `
            <div class="status-text">Master password is currently set</div>
            <div class="password-actions">
              <button type="button" class="btn btn-primary" id="change-password-btn">Change Password</button>
              <button type="button" class="btn btn-secondary" id="remove-password-btn">Remove Password</button>
            </div>
          `}
        </div>

        <!-- Biometric Authentication -->
        <div class="setting-card">
          <div class="setting-header">
            <div class="setting-info">
              <h2 class="setting-title">
                <span class="setting-icon">👆</span>
                Biometric Authentication
              </h2>
              <p class="setting-description">Use fingerprint, Face ID, or Touch ID for quick and secure authentication</p>
            </div>
          </div>

          <div class="status-row">
            <span class="status-row-label">Device Support:</span>
            <span class="status-badge ${biometric.supported ? 'status-supported' : 'status-disabled'}">${biometric.supported ? 'Supported' : 'Not Supported'}</span>
          </div>

          ${biometric.supported ? `
            <div class="status-row">
              <span class="status-row-label">Current Status:</span>
              <span class="status-badge ${settings.biometricEnabled ? 'status-enabled' : 'status-disabled'}">${settings.biometricEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>

            <div class="device-info">
              Your device supports: ${biometric.type}
            </div>

            ${settings.biometricEnabled ? `
              <button class="btn btn-danger" id="disable-biometric-btn">Disable Biometric Authentication</button>
            ` : `
              <button class="btn btn-primary" id="enable-biometric-btn">Enable Biometric Authentication</button>
            `}
          ` : `
            <div class="status-text">Your device does not support biometric authentication.</div>
          `}
        </div>

        <!-- Two-Factor Authentication -->
        <div class="setting-card">
          <div class="setting-header">
            <div class="setting-info">
              <h2 class="setting-title">
                <span class="setting-icon">📱</span>
                Two-Factor Authentication
              </h2>
              <p class="setting-description">Add an extra layer of security with 2FA</p>
            </div>
            <span class="status-badge ${settings.twoFactorEnabled ? 'status-enabled' : 'status-disabled'}">${settings.twoFactorEnabled ? 'Enabled' : 'Not Enabled'}</span>
          </div>

          <p class="status-text">
            Protect your account with time-based one-time passwords (TOTP) using an authenticator app.
          </p>

          ${settings.twoFactorEnabled ? `
            <div class="btn-group">
              <button class="btn btn-secondary" id="view-backup-codes-btn">View Backup Codes</button>
              <button class="btn btn-danger" id="disable-2fa-btn">Disable 2FA</button>
            </div>
          ` : `
            <button class="btn btn-primary" id="enable-2fa-btn">Enable 2FA</button>
          `}
        </div>

        <!-- Session Management -->
        <div class="setting-card">
          <div class="setting-header">
            <div class="setting-info">
              <h2 class="setting-title">
                <span class="setting-icon">⏱️</span>
                Session Management
              </h2>
              <p class="setting-description">Control your app session timeout settings</p>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Auto-lock after inactivity</label>
            <select class="form-select" id="auto-lock-select">
              <option value="immediately"${settings.autoLockTimeout === 'immediately' ? ' selected' : ''}>Immediately</option>
              <option value="1 minute"${settings.autoLockTimeout === '1 minute' ? ' selected' : ''}>After 1 minute</option>
              <option value="5 minutes"${settings.autoLockTimeout === '5 minutes' ? ' selected' : ''}>After 5 minutes</option>
              <option value="15 minutes"${settings.autoLockTimeout === '15 minutes' ? ' selected' : ''}>After 15 minutes</option>
              <option value="never"${settings.autoLockTimeout === 'never' ? ' selected' : ''}>Never</option>
            </select>
          </div>

          <div class="toggle-group">
            <span class="toggle-label">Require authentication on app launch</span>
            <div class="toggle-switch${settings.requireAuthOnLaunch ? ' active' : ''}" id="require-auth-toggle">
              <div class="toggle-slider"></div>
            </div>
          </div>
        </div>

        <!-- Data & Privacy -->
        <div class="setting-card">
          <div class="setting-header">
            <div class="setting-info">
              <h2 class="setting-title">
                <span class="setting-icon">🔐</span>
                Data & Privacy
              </h2>
              <p class="setting-description">Manage your data and privacy preferences</p>
            </div>
          </div>

          <div class="toggle-group">
            <span class="toggle-label">Enable crash reports</span>
            <div class="toggle-switch${settings.crashReports ? ' active' : ''}" id="crash-reports-toggle">
              <div class="toggle-slider"></div>
            </div>
          </div>

          <div class="toggle-group">
            <span class="toggle-label">Share usage analytics</span>
            <div class="toggle-switch${settings.usageAnalytics ? ' active' : ''}" id="usage-analytics-toggle">
              <div class="toggle-slider"></div>
            </div>
          </div>

          <div class="setting-actions">
            <div class="btn-group">
              <button class="btn btn-secondary" id="export-data-btn">Export My Data</button>
              <button class="btn btn-danger" id="delete-account-btn">Delete Account</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="activity-section">
        <div class="activity-header">
          <h2 class="activity-title">Recent Security Activity</h2>
          <button class="btn btn-secondary" id="view-all-activity-btn">View All</button>
        </div>
        <div class="activity-list">
          ${activity.map(item => `
            <div class="activity-item">
              <div class="activity-info">
                <span class="activity-action">${item.action}</span>
                <span class="activity-device">${item.device}</span>
              </div>
              <span class="activity-time">${formatTimeAgo(item.timestamp)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
  
  // Set up event handlers
  setupSettingsEventHandlers(appState)
}

// Set up event handlers
function setupSettingsEventHandlers(appState) {
  // Privacy mode toggle
  const privacyModeToggle = document.getElementById('privacy-mode-toggle')
  if (privacyModeToggle) {
    privacyModeToggle.addEventListener('click', () => {
      toggleSetting(privacyModeToggle, 'privacyMode')
    })
  }
  
  // Require auth toggle
  const requireAuthToggle = document.getElementById('require-auth-toggle')
  if (requireAuthToggle) {
    requireAuthToggle.addEventListener('click', () => {
      toggleSetting(requireAuthToggle, 'requireAuthOnLaunch')
    })
  }
  
  // Crash reports toggle
  const crashReportsToggle = document.getElementById('crash-reports-toggle')
  if (crashReportsToggle) {
    crashReportsToggle.addEventListener('click', () => {
      toggleSetting(crashReportsToggle, 'crashReports')
    })
  }
  
  // Usage analytics toggle
  const usageAnalyticsToggle = document.getElementById('usage-analytics-toggle')
  if (usageAnalyticsToggle) {
    usageAnalyticsToggle.addEventListener('click', () => {
      toggleSetting(usageAnalyticsToggle, 'usageAnalytics')
    })
  }
  
  // Auto-lock select
  const autoLockSelect = document.getElementById('auto-lock-select')
  if (autoLockSelect) {
    autoLockSelect.addEventListener('change', (e) => {
      handleAutoLockChange(e.target.value)
    })
  }
  
  // Master password buttons
  const setPasswordBtn = document.getElementById('set-password-btn')
  if (setPasswordBtn) {
    setPasswordBtn.addEventListener('click', () => handleSetMasterPassword())
  }
  
  const changePasswordBtn = document.getElementById('change-password-btn')
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => handleChangeMasterPassword())
  }
  
  const removePasswordBtn = document.getElementById('remove-password-btn')
  if (removePasswordBtn) {
    removePasswordBtn.addEventListener('click', () => handleRemoveMasterPassword())
  }
  
  // Biometric buttons
  const enableBiometricBtn = document.getElementById('enable-biometric-btn')
  if (enableBiometricBtn) {
    enableBiometricBtn.addEventListener('click', () => handleEnableBiometric())
  }
  
  const disableBiometricBtn = document.getElementById('disable-biometric-btn')
  if (disableBiometricBtn) {
    disableBiometricBtn.addEventListener('click', () => handleDisableBiometric())
  }
  
  // 2FA buttons
  const enable2faBtn = document.getElementById('enable-2fa-btn')
  if (enable2faBtn) {
    enable2faBtn.addEventListener('click', () => handleEnable2FA())
  }
  
  const disable2faBtn = document.getElementById('disable-2fa-btn')
  if (disable2faBtn) {
    disable2faBtn.addEventListener('click', () => handleDisable2FA())
  }
  
  const viewBackupCodesBtn = document.getElementById('view-backup-codes-btn')
  if (viewBackupCodesBtn) {
    viewBackupCodesBtn.addEventListener('click', () => handleViewBackupCodes())
  }
  
  // Data & privacy buttons
  const exportDataBtn = document.getElementById('export-data-btn')
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => handleExportData())
  }
  
  const deleteAccountBtn = document.getElementById('delete-account-btn')
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', () => handleDeleteAccount())
  }
  
  // Activity button
  const viewAllActivityBtn = document.getElementById('view-all-activity-btn')
  if (viewAllActivityBtn) {
    viewAllActivityBtn.addEventListener('click', () => handleViewAllActivity())
  }
}

// Toggle setting helper
function toggleSetting(toggleElement, settingKey) {
  toggleElement.classList.toggle('active')
  const isEnabled = toggleElement.classList.contains('active')
  
  // Update mock settings
  mockSettings[settingKey] = isEnabled
  
  // TODO: Save to database
  console.log(`Setting ${settingKey} changed to:`, isEnabled)
  
  // Show notification
  showNotification(`${settingKey} ${isEnabled ? 'enabled' : 'disabled'}`, 'success')
}

// Handle auto-lock timeout change
function handleAutoLockChange(value) {
  mockSettings.autoLockTimeout = value
  console.log('Auto-lock timeout changed to:', value)
  showNotification('Auto-lock timeout updated', 'success')
}

// Master password handlers
async function handleSetMasterPassword() {
  const passwordInput = document.getElementById('master-password')
  const password = passwordInput?.value
  
  if (!password || password.length < 8) {
    showNotification('Password must be at least 8 characters long', 'error')
    return
  }
  
  // TODO: Save password securely
  mockSettings.masterPasswordSet = true
  showNotification('Master password set successfully', 'success')
  
  // Refresh the page to show new state
  const { showPage } = await import('../app.js')
  showPage('settings')
}

async function handleChangeMasterPassword() {
  const { modalManager } = await import('../app.js')
  
  const modalContent = `
    <h2>Change Master Password</h2>
    <form id="change-password-form">
      <div class="form-group">
        <label class="form-label">Current Password</label>
        <input type="password" class="form-input" id="current-password" required>
      </div>
      <div class="form-group">
        <label class="form-label">New Password</label>
        <input type="password" class="form-input" id="new-password" required>
      </div>
      <div class="form-group">
        <label class="form-label">Confirm New Password</label>
        <input type="password" class="form-input" id="confirm-password" required>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="submit" class="btn btn-primary">Change Password</button>
      </div>
    </form>
  `
  
  modalManager.show(modalContent)
  
  document.getElementById('change-password-form').addEventListener('submit', (e) => {
    e.preventDefault()
    // TODO: Validate and change password
    modalManager.close()
    showNotification('Master password changed successfully', 'success')
  })
}

async function handleRemoveMasterPassword() {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Remove Master Password?',
    message: 'Are you sure you want to remove your master password? You will lose this authentication method.',
    confirmText: 'Remove Password',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    mockSettings.masterPasswordSet = false
    showNotification('Master password removed', 'success')
    
    // Refresh the page
    const { showPage } = await import('../app.js')
    showPage('settings')
  }
}

// Biometric handlers
async function handleEnableBiometric() {
  try {
    // TODO: Use WebAuthn API to enable biometric
    mockSettings.biometricEnabled = true
    showNotification('Biometric authentication enabled', 'success')
    
    // Refresh the page
    const { showPage } = await import('../app.js')
    showPage('settings')
  } catch (error) {
    showNotification('Failed to enable biometric authentication', 'error')
  }
}

async function handleDisableBiometric() {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Disable Biometric Authentication?',
    message: 'Are you sure you want to disable biometric authentication?',
    confirmText: 'Disable',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    mockSettings.biometricEnabled = false
    showNotification('Biometric authentication disabled', 'success')
    
    // Refresh the page
    const { showPage } = await import('../app.js')
    showPage('settings')
  }
}

// 2FA handlers
async function handleEnable2FA() {
  const { modalManager } = await import('../app.js')
  
  const modalContent = `
    <h2>Enable Two-Factor Authentication</h2>
    <div style="text-align: center; padding: 20px;">
      <p style="margin-bottom: 20px;">Scan this QR code with your authenticator app:</p>
      <div style="width: 200px; height: 200px; background: #fff; border-radius: 10px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: #000;">
        QR CODE PLACEHOLDER
      </div>
      <p style="font-size: 12px; color: #8b8b9a; margin-bottom: 20px;">Or enter this key manually: ABCD-EFGH-IJKL-MNOP</p>
      <div class="form-group">
        <label class="form-label">Enter verification code from your app:</label>
        <input type="text" class="form-input" id="verification-code" placeholder="123456" maxlength="6">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="button" class="btn btn-primary" id="verify-2fa-btn">Verify & Enable</button>
      </div>
    </div>
  `
  
  modalManager.show(modalContent)
  
  document.getElementById('verify-2fa-btn').addEventListener('click', () => {
    const code = document.getElementById('verification-code').value
    if (code && code.length === 6) {
      mockSettings.twoFactorEnabled = true
      modalManager.close()
      showNotification('Two-factor authentication enabled successfully', 'success')
      
      // Refresh the page
      import('../app.js').then(({ showPage }) => showPage('settings'))
    } else {
      showNotification('Please enter a valid 6-digit code', 'error')
    }
  })
}

async function handleDisable2FA() {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Disable Two-Factor Authentication?',
    message: 'Are you sure you want to disable 2FA? This will reduce your account security.',
    confirmText: 'Disable 2FA',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    mockSettings.twoFactorEnabled = false
    showNotification('Two-factor authentication disabled', 'success')
    
    // Refresh the page
    const { showPage } = await import('../app.js')
    showPage('settings')
  }
}

async function handleViewBackupCodes() {
  const { modalManager } = await import('../app.js')
  
  const backupCodes = [
    '1a2b-3c4d-5e6f',
    '7g8h-9i0j-1k2l',
    '3m4n-5o6p-7q8r',
    '9s0t-1u2v-3w4x',
    '5y6z-7a8b-9c0d'
  ]
  
  const modalContent = `
    <h2>Backup Codes</h2>
    <p style="margin-bottom: 20px; color: #8b8b9a;">Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.</p>
    <div style="background: #16161f; border: 1px solid #2a2a3a; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
      ${backupCodes.map(code => `<div style="font-family: monospace; margin: 8px 0; font-size: 16px;">${code}</div>`).join('')}
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick="navigator.clipboard.writeText('${backupCodes.join('\\n')}'); window.modalManager.showNotification('Backup codes copied to clipboard', 'success')">Copy Codes</button>
      <button type="button" class="btn btn-primary" onclick="window.modalManager.close()">Done</button>
    </div>
  `
  
  modalManager.show(modalContent)
}

// Data & privacy handlers
async function handleExportData() {
  showNotification('Preparing data export...', 'info')
  
  // TODO: Generate actual data export
  setTimeout(() => {
    showNotification('Data export ready for download', 'success')
  }, 2000)
}

async function handleDeleteAccount() {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Delete Account?',
    message: 'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
    confirmText: 'Delete Account',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    showNotification('Account deletion initiated. You will receive a confirmation email.', 'info')
  }
}

// Activity handler
async function handleViewAllActivity() {
  const { modalManager } = await import('../app.js')
  
  const modalContent = `
    <h2>Security Activity Log</h2>
    <div class="activity-list">
      ${mockActivity.map(item => `
        <div class="activity-item">
          <div class="activity-info">
            <span class="activity-action">${item.action}</span>
            <span class="activity-device">${item.device}</span>
          </div>
          <span class="activity-time">${formatTimeAgo(item.timestamp)}</span>
        </div>
      `).join('')}
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary" onclick="window.modalManager.close()">Close</button>
    </div>
  `
  
  modalManager.show(modalContent)
}

// Show notification helper
function showNotification(message, type = 'info') {
  // Create or update notification element
  let notification = document.getElementById('settings-notification')
  if (!notification) {
    notification = document.createElement('div')
    notification.id = 'settings-notification'
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 10px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      transition: all 0.3s ease;
    `
    document.body.appendChild(notification)
  }
  
  // Set background color based on type
  const colors = {
    success: '#4ade80',
    error: '#ef4444',
    info: '#3b82f6'
  }
  
  notification.style.background = colors[type] || colors.info
  notification.textContent = message
  notification.style.opacity = '1'
  notification.style.transform = 'translateY(0)'
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0'
    notification.style.transform = 'translateY(-20px)'
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 300)
  }, 3000)
}

// Export functions
export default {
  renderSettings
}