// js/modules/biometricAuth.js - Biometric Authentication for Privacy Mode
import { debug } from './debug.js';
import { showError, announceToScreenReader } from './ui.js';

/**
 * BiometricAuthManager handles WebAuthn-based authentication
 * for privacy mode using fingerprint, face ID, or other biometrics
 */
class BiometricAuthManager {
  constructor() {
    this.isSupported = this.checkSupport();
    this.credentialId = null;
    this.isRegistered = this.loadRegistrationState();
  }

  /**
   * Check if WebAuthn is supported in the current browser
   */
  checkSupport() {
    const supported = !!(navigator.credentials && navigator.credentials.create);
    if (!supported) {
      debug.log('WebAuthn not supported in this browser');
    }
    return supported;
  }

  /**
   * Load registration state from localStorage
   */
  loadRegistrationState() {
    try {
      const state = localStorage.getItem('biometricAuthState');
      if (state) {
        const parsed = JSON.parse(state);
        this.credentialId = parsed.credentialId;
        return true;
      }
    } catch (e) {
      debug.error('Failed to load biometric auth state:', e);
    }
    return false;
  }

  /**
   * Save registration state to localStorage
   */
  saveRegistrationState() {
    try {
      localStorage.setItem(
        'biometricAuthState',
        JSON.stringify({
          credentialId: this.credentialId,
          registeredAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      debug.error('Failed to save biometric auth state:', e);
    }
  }

  /**
   * Clear registration state
   */
  clearRegistrationState() {
    try {
      localStorage.removeItem('biometricAuthState');
      this.credentialId = null;
      this.isRegistered = false;
    } catch (e) {
      debug.error('Failed to clear biometric auth state:', e);
    }
  }

  /**
   * Register biometric authentication
   */
  async register() {
    if (!this.isSupported) {
      throw new Error('Biometric authentication is not supported on this device');
    }

    try {
      // Generate a random challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create credential options
      const createOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'Ryokushen Financial Tracker',
            id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode('ryokushen-user'),
            name: 'user@ryokushen',
            displayName: 'Ryokushen User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'none',
        },
      };

      debug.log('Creating biometric credential...');
      const credential = await navigator.credentials.create(createOptions);

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Store credential ID
      this.credentialId = this.arrayBufferToBase64(credential.rawId);
      this.isRegistered = true;
      this.saveRegistrationState();

      debug.log('Biometric authentication registered successfully');
      announceToScreenReader('Biometric authentication has been set up successfully');

      return true;
    } catch (error) {
      debug.error('Biometric registration failed:', error);

      // Provide user-friendly error messages
      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric registration was cancelled or not allowed');
      } else if (error.name === 'SecurityError') {
        throw new Error('Biometric authentication requires a secure context (HTTPS)');
      } else if (error.name === 'InvalidStateError') {
        throw new Error('This device is already registered');
      } else {
        throw new Error(`Failed to register biometric authentication: ${error.message}`);
      }
    }
  }

  /**
   * Authenticate using biometrics
   */
  async authenticate() {
    if (!this.isSupported) {
      throw new Error('Biometric authentication is not supported on this device');
    }

    if (!this.isRegistered || !this.credentialId) {
      throw new Error('Biometric authentication is not set up. Please register first.');
    }

    try {
      // Generate a random challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Get credential options
      const getOptions = {
        publicKey: {
          challenge,
          rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
          allowCredentials: [
            {
              id: this.base64ToArrayBuffer(this.credentialId),
              type: 'public-key',
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      };

      debug.log('Requesting biometric authentication...');
      const assertion = await navigator.credentials.get(getOptions);

      if (!assertion) {
        throw new Error('Authentication failed');
      }

      debug.log('Biometric authentication successful');
      announceToScreenReader('Biometric authentication successful');

      return true;
    } catch (error) {
      debug.error('Biometric authentication failed:', error);

      // Provide user-friendly error messages
      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric authentication was cancelled or not allowed');
      } else if (error.name === 'SecurityError') {
        throw new Error('Biometric authentication requires a secure context (HTTPS)');
      } else {
        throw new Error(`Biometric authentication failed: ${error.message}`);
      }
    }
  }

  /**
   * Check if biometric authentication is available and registered
   */
  isAvailable() {
    return this.isSupported && this.isRegistered;
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get browser/platform info for user guidance
   */
  getPlatformInfo() {
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();

    const info = {
      supportedMethods: [],
      platformName: 'your device',
    };

    // Detect platform
    if (platform.includes('mac') || ua.includes('macintosh')) {
      info.platformName = 'Mac';
      info.supportedMethods.push('Touch ID');
    } else if (platform.includes('win')) {
      info.platformName = 'Windows';
      info.supportedMethods.push('Windows Hello', 'Fingerprint', 'Face Recognition');
    } else if (ua.includes('android')) {
      info.platformName = 'Android';
      info.supportedMethods.push('Fingerprint', 'Face Unlock');
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      info.platformName = 'iOS';
      info.supportedMethods.push('Touch ID', 'Face ID');
    }

    return info;
  }
}

// Create singleton instance
export const biometricAuth = new BiometricAuthManager();

// Export convenience functions
export function isBiometricSupported() {
  return biometricAuth.isSupported;
}

export function isBiometricRegistered() {
  return biometricAuth.isRegistered;
}

export async function registerBiometric() {
  return biometricAuth.register();
}

export async function authenticateWithBiometric() {
  return biometricAuth.authenticate();
}

export function clearBiometricRegistration() {
  return biometricAuth.clearRegistrationState();
}

export function getBiometricPlatformInfo() {
  return biometricAuth.getPlatformInfo();
}

// Make biometricAuth available globally for debugging
if (typeof window !== 'undefined') {
  window.biometricAuth = biometricAuth;
}
