// js/modules/privacySettings.js - Privacy and Biometric Settings UI
import { debug } from './debug.js';
import { showError, announceToScreenReader } from './ui.js';
import { 
    isBiometricSupported, 
    isBiometricRegistered,
    getBiometricPlatformInfo,
    enableBiometricPrivacy,
    disableBiometricPrivacy,
    isBiometricPrivacyEnabled
} from './privacy.js';

class PrivacySettingsManager {
    constructor() {
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        this.isInitialized = true;
        this.createSettingsUI();
        this.attachEventListeners();
        this.updateUI();
    }

    createSettingsUI() {
        // Find settings container
        const settingsTab = document.getElementById('settings');
        if (!settingsTab) {
            debug.error('Settings tab not found');
            return;
        }

        // Create privacy settings card after time settings
        const privacySettingsHTML = `
            <div class="card" style="margin-top: 20px;">
                <div class="card__header">
                    <h3>Privacy & Security Settings</h3>
                </div>
                <div class="card__body">
                    <div class="privacy-settings-section">
                        <h4>Biometric Authentication</h4>
                        <div class="info-note">
                            <strong>Enhanced Security:</strong> Require biometric authentication (fingerprint, Face ID, Touch ID) to enable privacy mode.
                        </div>
                        
                        <div class="biometric-status-container">
                            <div class="status-row">
                                <span class="status-label">Device Support:</span>
                                <span id="biometric-support-status" class="status-value"></span>
                            </div>
                            <div class="status-row">
                                <span class="status-label">Current Status:</span>
                                <span id="biometric-status" class="status-value"></span>
                            </div>
                            <div id="biometric-platform-info" class="platform-info" style="display: none;">
                                <small class="form-text"></small>
                            </div>
                        </div>

                        <div class="biometric-actions" style="margin-top: 20px;">
                            <button id="setup-biometric-btn" class="btn btn--primary" style="display: none;">
                                Set Up Biometric Authentication
                            </button>
                            <button id="disable-biometric-btn" class="btn btn--secondary" style="display: none;">
                                Disable Biometric Authentication
                            </button>
                        </div>

                        <div id="biometric-setup-guide" class="setup-guide" style="display: none; margin-top: 20px;">
                            <h5>Setup Instructions:</h5>
                            <ol>
                                <li>Click the button above to start setup</li>
                                <li>Your browser will prompt for biometric authentication</li>
                                <li>Follow the on-screen instructions to scan your fingerprint or face</li>
                                <li>Once complete, biometric authentication will be required to enable privacy mode</li>
                            </ol>
                        </div>
                    </div>

                    <hr style="margin: 30px 0;">

                    <div class="privacy-settings-section">
                        <h4>Privacy Mode Options</h4>
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" id="privacy-auto-timeout" disabled>
                                Auto-disable privacy mode after 15 minutes of inactivity
                                <small class="form-text">(Coming soon)</small>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" id="privacy-blur-partial" disabled>
                                Partial blur - show first and last digits
                                <small class="form-text">(Coming soon)</small>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Find the settings container and append our privacy settings
        const settingsContainer = settingsTab.querySelector('.settings-container');
        if (settingsContainer) {
            settingsContainer.insertAdjacentHTML('beforeend', privacySettingsHTML);
        }
    }

    attachEventListeners() {
        const setupBtn = document.getElementById('setup-biometric-btn');
        const disableBtn = document.getElementById('disable-biometric-btn');

        if (setupBtn) {
            setupBtn.addEventListener('click', () => this.handleSetupBiometric());
        }

        if (disableBtn) {
            disableBtn.addEventListener('click', () => this.handleDisableBiometric());
        }
    }

    async handleSetupBiometric() {
        const setupBtn = document.getElementById('setup-biometric-btn');
        if (!setupBtn) return;

        try {
            setupBtn.disabled = true;
            setupBtn.textContent = 'Setting up...';

            await enableBiometricPrivacy();
            
            announceToScreenReader('Biometric authentication has been enabled successfully');
            this.showSuccessMessage('Biometric authentication enabled! Privacy mode will now require biometric verification.');
            this.updateUI();
        } catch (error) {
            debug.error('Biometric setup failed:', error);
            showError(error.message || 'Failed to set up biometric authentication');
        } finally {
            setupBtn.disabled = false;
            setupBtn.textContent = 'Set Up Biometric Authentication';
        }
    }

    handleDisableBiometric() {
        if (confirm('Are you sure you want to disable biometric authentication for privacy mode?')) {
            try {
                disableBiometricPrivacy();
                announceToScreenReader('Biometric authentication has been disabled');
                this.showSuccessMessage('Biometric authentication disabled.');
                this.updateUI();
            } catch (error) {
                debug.error('Failed to disable biometric:', error);
                showError('Failed to disable biometric authentication');
            }
        }
    }

    updateUI() {
        const supportStatus = document.getElementById('biometric-support-status');
        const currentStatus = document.getElementById('biometric-status');
        const platformInfo = document.getElementById('biometric-platform-info');
        const setupBtn = document.getElementById('setup-biometric-btn');
        const disableBtn = document.getElementById('disable-biometric-btn');
        const setupGuide = document.getElementById('biometric-setup-guide');

        if (!supportStatus || !currentStatus) return;

        const isSupported = isBiometricSupported();
        const isRegistered = isBiometricRegistered();
        const isEnabled = isBiometricPrivacyEnabled();

        // Update support status
        if (isSupported) {
            supportStatus.textContent = 'Supported';
            supportStatus.className = 'status-value supported';
            
            // Show platform-specific info
            const platformData = getBiometricPlatformInfo();
            if (platformInfo && platformData.supportedMethods.length > 0) {
                platformInfo.style.display = 'block';
                platformInfo.querySelector('.form-text').textContent = 
                    `Your ${platformData.platformName} device supports: ${platformData.supportedMethods.join(', ')}`;
            }
        } else {
            supportStatus.textContent = 'Not Supported';
            supportStatus.className = 'status-value unsupported';
            
            if (platformInfo) {
                platformInfo.style.display = 'block';
                platformInfo.querySelector('.form-text').textContent = 
                    'Biometric authentication requires a compatible device and HTTPS connection.';
            }
        }

        // Update current status
        if (!isSupported) {
            currentStatus.textContent = 'Unavailable';
            currentStatus.className = 'status-value disabled';
        } else if (isEnabled) {
            currentStatus.textContent = 'Enabled';
            currentStatus.className = 'status-value enabled';
        } else {
            currentStatus.textContent = 'Disabled';
            currentStatus.className = 'status-value disabled';
        }

        // Show/hide buttons
        if (setupBtn && disableBtn) {
            if (isSupported && !isEnabled) {
                setupBtn.style.display = 'inline-block';
                disableBtn.style.display = 'none';
                if (setupGuide) setupGuide.style.display = 'block';
            } else if (isSupported && isEnabled) {
                setupBtn.style.display = 'none';
                disableBtn.style.display = 'inline-block';
                if (setupGuide) setupGuide.style.display = 'none';
            } else {
                setupBtn.style.display = 'none';
                disableBtn.style.display = 'none';
                if (setupGuide) setupGuide.style.display = 'none';
            }
        }
    }

    showSuccessMessage(message) {
        // Create a temporary success message
        const messageEl = document.createElement('div');
        messageEl.className = 'success-message';
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => messageEl.remove(), 300);
        }, 3000);
    }
}

// Create and export singleton instance
export const privacySettings = new PrivacySettingsManager();

// Initialize when settings tab is opened
export function initializePrivacySettings() {
    privacySettings.init();
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .biometric-status-container {
        background: var(--color-surface);
        padding: 15px;
        border-radius: 8px;
        margin-top: 15px;
    }
    
    .status-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .status-row:last-child {
        margin-bottom: 0;
    }
    
    .status-label {
        font-weight: 500;
        color: var(--color-text-secondary);
    }
    
    .status-value {
        font-weight: 600;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 0.875rem;
    }
    
    .status-value.supported {
        background: #E8F5E9;
        color: #2E7D32;
    }
    
    .status-value.unsupported {
        background: #FFEBEE;
        color: #C62828;
    }
    
    .status-value.enabled {
        background: #E3F2FD;
        color: #1565C0;
    }
    
    .status-value.disabled {
        background: #F5F5F5;
        color: #616161;
    }
    
    .platform-info {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--color-border);
    }
    
    .setup-guide {
        background: var(--color-background-secondary);
        padding: 20px;
        border-radius: 8px;
        border: 1px solid var(--color-border);
    }
    
    .setup-guide h5 {
        margin-bottom: 15px;
        color: var(--color-primary);
    }
    
    .setup-guide ol {
        margin: 0;
        padding-left: 20px;
    }
    
    .setup-guide li {
        margin-bottom: 10px;
        line-height: 1.5;
    }
    
    .privacy-settings-section {
        margin-bottom: 30px;
    }
    
    .privacy-settings-section:last-child {
        margin-bottom: 0;
    }
`;
document.head.appendChild(style);