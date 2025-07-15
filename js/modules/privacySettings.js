// js/modules/privacySettings.js - Privacy and Biometric Settings UI
import { debug } from './debug.js';
import { showError, announceToScreenReader } from './ui.js';
import { 
    isBiometricSupported, 
    isBiometricRegistered,
    getBiometricPlatformInfo,
    enableBiometricPrivacy,
    disableBiometricPrivacy,
    isBiometricPrivacyEnabled,
    setMasterPassword,
    hasMasterPassword
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
                        <div class="info-note" style="background: #E3F2FD; border-color: #1976D2; margin-bottom: 20px;">
                            <strong>How Privacy Mode Works:</strong>
                            <ul style="margin: 10px 0 0 20px; padding: 0;">
                                <li>Enable privacy mode instantly without authentication (for quick privacy)</li>
                                <li>Authentication required to disable privacy mode (prevents unauthorized access)</li>
                                <li>Use biometric authentication, master password, or both for maximum security</li>
                            </ul>
                        </div>

                        <h4>Master Password</h4>
                        <div class="info-note">
                            Set a master password as a backup authentication method or primary security option.
                        </div>
                        
                        <div class="master-password-section" style="margin-top: 15px;">
                            <div class="status-row">
                                <span class="status-label">Master Password:</span>
                                <span id="master-password-status" class="status-value"></span>
                            </div>
                            
                            <div class="master-password-actions" style="margin-top: 15px;">
                                <button id="set-master-password-btn" class="btn btn--primary" style="display: none;">
                                    Set Master Password
                                </button>
                                <button id="change-master-password-btn" class="btn btn--secondary" style="display: none;">
                                    Change Master Password
                                </button>
                            </div>
                        </div>

                        <hr style="margin: 25px 0;">

                        <h4>Biometric Authentication</h4>
                        <div class="info-note">
                            Use fingerprint, Face ID, or Touch ID for quick and secure authentication.
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
                                <li>Once complete, biometric authentication will be available when disabling privacy mode</li>
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
        const setPasswordBtn = document.getElementById('set-master-password-btn');
        const changePasswordBtn = document.getElementById('change-master-password-btn');

        if (setupBtn) {
            setupBtn.addEventListener('click', () => this.handleSetupBiometric());
        }

        if (disableBtn) {
            disableBtn.addEventListener('click', () => this.handleDisableBiometric());
        }

        if (setPasswordBtn) {
            setPasswordBtn.addEventListener('click', () => this.handleSetMasterPassword());
        }

        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => this.handleChangeMasterPassword());
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
            this.showSuccessMessage('Biometric authentication enabled! It will be required when disabling privacy mode.');
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

    async handleSetMasterPassword() {
        const password = await this.promptForNewPassword('Set Master Password');
        if (password) {
            try {
                await setMasterPassword(password);
                this.showSuccessMessage('Master password has been set successfully!');
                this.updateUI();
            } catch (error) {
                showError(error.message || 'Failed to set master password');
            }
        }
    }

    async handleChangeMasterPassword() {
        const password = await this.promptForNewPassword('Change Master Password', true);
        if (password) {
            try {
                await setMasterPassword(password);
                this.showSuccessMessage('Master password has been changed successfully!');
                this.updateUI();
            } catch (error) {
                showError(error.message || 'Failed to change master password');
            }
        }
    }

    async promptForNewPassword(title, requireOldPassword = false) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'password-setup-modal-overlay';
            modal.innerHTML = `
                <div class="password-setup-modal">
                    <div class="password-setup-modal-header">
                        <h3>${title}</h3>
                        <button class="password-setup-modal-close">&times;</button>
                    </div>
                    <div class="password-setup-modal-body">
                        ${requireOldPassword ? `
                            <div class="form-group">
                                <label for="old-password">Current Password:</label>
                                <input type="password" id="old-password" class="form-control" placeholder="Enter current password">
                            </div>
                        ` : ''}
                        <div class="form-group">
                            <label for="new-password">New Password:</label>
                            <input type="password" id="new-password" class="form-control" placeholder="At least 6 characters">
                        </div>
                        <div class="form-group">
                            <label for="confirm-password">Confirm Password:</label>
                            <input type="password" id="confirm-password" class="form-control" placeholder="Re-enter password">
                        </div>
                        <div class="password-requirements">
                            <small>Password must be at least 6 characters long</small>
                        </div>
                        <div class="password-setup-error" style="display: none; color: red; margin-top: 10px;"></div>
                    </div>
                    <div class="password-setup-modal-footer">
                        <button class="btn btn--secondary password-setup-cancel">Cancel</button>
                        <button class="btn btn--primary password-setup-submit">Save Password</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const newPasswordInput = modal.querySelector('#new-password');
            const confirmPasswordInput = modal.querySelector('#confirm-password');
            const errorDiv = modal.querySelector('.password-setup-error');
            const submitBtn = modal.querySelector('.password-setup-submit');
            const cancelBtn = modal.querySelector('.password-setup-cancel');
            const closeBtn = modal.querySelector('.password-setup-modal-close');

            const cleanup = () => {
                modal.remove();
            };

            const handleSubmit = async () => {
                const newPassword = newPasswordInput.value;
                const confirmPassword = confirmPasswordInput.value;

                // Reset error
                errorDiv.style.display = 'none';
                errorDiv.textContent = '';

                // Validate
                if (newPassword.length < 6) {
                    errorDiv.textContent = 'Password must be at least 6 characters';
                    errorDiv.style.display = 'block';
                    return;
                }

                if (newPassword !== confirmPassword) {
                    errorDiv.textContent = 'Passwords do not match';
                    errorDiv.style.display = 'block';
                    return;
                }

                cleanup();
                resolve(newPassword);
            };

            const handleCancel = () => {
                cleanup();
                resolve(null);
            };

            // Event listeners
            submitBtn.addEventListener('click', handleSubmit);
            cancelBtn.addEventListener('click', handleCancel);
            closeBtn.addEventListener('click', handleCancel);
            
            // Enter key handling
            [newPasswordInput, confirmPasswordInput].forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') handleSubmit();
                });
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) handleCancel();
            });

            // Focus first input
            if (requireOldPassword) {
                modal.querySelector('#old-password').focus();
            } else {
                newPasswordInput.focus();
            }
        });
    }

    updateUI() {
        // Update master password status
        const passwordStatus = document.getElementById('master-password-status');
        const setPasswordBtn = document.getElementById('set-master-password-btn');
        const changePasswordBtn = document.getElementById('change-master-password-btn');

        if (passwordStatus) {
            const hasPassword = hasMasterPassword();
            if (hasPassword) {
                passwordStatus.textContent = 'Set';
                passwordStatus.className = 'status-value enabled';
                if (setPasswordBtn) setPasswordBtn.style.display = 'none';
                if (changePasswordBtn) changePasswordBtn.style.display = 'inline-block';
            } else {
                passwordStatus.textContent = 'Not Set';
                passwordStatus.className = 'status-value disabled';
                if (setPasswordBtn) setPasswordBtn.style.display = 'inline-block';
                if (changePasswordBtn) changePasswordBtn.style.display = 'none';
            }
        }

        // Update biometric status
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

// Add CSS for animations and modal
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
    
    .biometric-status-container,
    .master-password-section {
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
    
    .info-note {
        background: #F5F5F5;
        border-left: 4px solid #2196F3;
        padding: 12px 16px;
        border-radius: 4px;
        margin-bottom: 15px;
    }
    
    /* Password setup modal styles */
    .password-setup-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .password-setup-modal {
        background: var(--color-background);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 450px;
        overflow: hidden;
    }
    
    .password-setup-modal-header {
        background: var(--color-primary);
        color: white;
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .password-setup-modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
    }
    
    .password-setup-modal-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s;
    }
    
    .password-setup-modal-close:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    
    .password-setup-modal-body {
        padding: 20px;
    }
    
    .password-setup-modal-body .form-group {
        margin-bottom: 15px;
    }
    
    .password-setup-modal-body label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: var(--color-text-secondary);
    }
    
    .password-setup-modal-body input {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 1rem;
    }
    
    .password-requirements {
        margin-top: 5px;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
    }
    
    .password-setup-modal-footer {
        padding: 15px 20px;
        background: var(--color-background-secondary);
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }
`;
document.head.appendChild(style);