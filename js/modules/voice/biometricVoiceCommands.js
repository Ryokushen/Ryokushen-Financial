// js/modules/voice/biometricVoiceCommands.js - Voice commands for biometric privacy
import { debug } from '../debug.js';
import {
  isBiometricSupported,
  isBiometricRegistered,
  getBiometricPlatformInfo,
} from '../biometricAuth.js';
import {
  isBiometricPrivacyEnabled,
  enableBiometricPrivacy,
  disableBiometricPrivacy,
  hasMasterPassword,
  setMasterPassword,
} from '../privacy.js';

/**
 * Handle biometric-related voice commands
 */
export async function handleBiometricVoiceCommand(command) {
  const lowerCommand = command.toLowerCase();

  // Check privacy security status
  if (
    lowerCommand.includes('privacy security status') ||
    lowerCommand.includes('authentication status')
  ) {
    const isSupported = isBiometricSupported();
    const isBiometricEnabled = isBiometricPrivacyEnabled();
    const hasPassword = hasMasterPassword();

    const status = [];
    if (isBiometricEnabled) {
      status.push('biometric authentication');
    }
    if (hasPassword) {
      status.push('master password');
    }

    if (status.length === 0) {
      return {
        success: true,
        message:
          'No authentication is currently set up. Privacy mode can be disabled by anyone. Consider setting up biometric authentication or a master password for security.',
      };
    }

    return {
      success: true,
      message: `Privacy mode is protected by: ${status.join(' and ')}. Authentication is required to disable privacy mode.`,
    };
  }

  // Check biometric status
  if (lowerCommand.includes('biometric status') || lowerCommand.includes('is biometric enabled')) {
    const isSupported = isBiometricSupported();
    const isEnabled = isBiometricPrivacyEnabled();

    if (!isSupported) {
      return {
        success: true,
        message: 'Biometric authentication is not supported on this device.',
      };
    }

    return {
      success: true,
      message: isEnabled
        ? 'Biometric authentication is enabled. It will be required when disabling privacy mode.'
        : 'Biometric authentication is disabled.',
    };
  }

  // Enable biometric
  if (
    lowerCommand.includes('enable biometric') ||
    lowerCommand.includes('turn on biometric') ||
    lowerCommand.includes('activate biometric')
  ) {
    if (!isBiometricSupported()) {
      return {
        success: false,
        message: 'Biometric authentication is not supported on this device.',
      };
    }

    if (isBiometricPrivacyEnabled()) {
      return {
        success: true,
        message: 'Biometric authentication is already enabled.',
      };
    }

    try {
      await enableBiometricPrivacy();
      return {
        success: true,
        message:
          'Biometric authentication has been enabled. You will need to authenticate with your fingerprint or face to disable privacy mode.',
      };
    } catch (error) {
      debug.error('Failed to enable biometric via voice:', error);
      return {
        success: false,
        message: 'Failed to enable biometric authentication. Please try from the settings page.',
      };
    }
  }

  // Disable biometric
  if (
    lowerCommand.includes('disable biometric') ||
    lowerCommand.includes('turn off biometric') ||
    lowerCommand.includes('deactivate biometric')
  ) {
    if (!isBiometricPrivacyEnabled()) {
      return {
        success: true,
        message: 'Biometric authentication is already disabled.',
      };
    }

    // For security, we should confirm this action
    return {
      success: true,
      message:
        'To disable biometric authentication, please go to Settings > Privacy & Security. This requires confirmation for security reasons.',
      action: 'navigate_settings',
    };
  }

  // Master password status
  if (
    lowerCommand.includes('master password status') ||
    lowerCommand.includes('is master password set')
  ) {
    const hasPassword = hasMasterPassword();

    return {
      success: true,
      message: hasPassword
        ? 'Master password is set. It can be used to disable privacy mode if biometric authentication fails.'
        : 'Master password is not set. You can set one in Settings > Privacy & Security.',
    };
  }

  // Help command
  if (
    lowerCommand.includes('privacy security help') ||
    lowerCommand.includes('biometric help') ||
    lowerCommand.includes('what is biometric')
  ) {
    return {
      success: true,
      message:
        'Privacy mode security protects your sensitive data. You can enable privacy mode instantly to hide your financial information. To disable it and reveal your data, authentication is required. You can use biometric authentication (fingerprint, Face ID) or a master password. Say "enable biometric" to set up biometric authentication.',
    };
  }

  return null; // Command not handled
}

/**
 * Get biometric-related voice command patterns
 */
export function getBiometricVoicePatterns() {
  return [
    // General security status
    { pattern: /privacy security status/i, handler: 'privacy_security_status' },
    { pattern: /authentication status/i, handler: 'privacy_security_status' },

    // Biometric status commands
    { pattern: /biometric status/i, handler: 'biometric_status' },
    { pattern: /is biometric (enabled|on|active)/i, handler: 'biometric_status' },

    // Enable commands
    { pattern: /enable biometric/i, handler: 'enable_biometric' },
    { pattern: /turn on biometric/i, handler: 'enable_biometric' },
    { pattern: /activate biometric/i, handler: 'enable_biometric' },
    { pattern: /set up biometric/i, handler: 'enable_biometric' },

    // Disable commands
    { pattern: /disable biometric/i, handler: 'disable_biometric' },
    { pattern: /turn off biometric/i, handler: 'disable_biometric' },
    { pattern: /deactivate biometric/i, handler: 'disable_biometric' },
    { pattern: /remove biometric/i, handler: 'disable_biometric' },

    // Master password commands
    { pattern: /master password status/i, handler: 'master_password_status' },
    { pattern: /is master password set/i, handler: 'master_password_status' },

    // Help commands
    { pattern: /privacy security help/i, handler: 'privacy_security_help' },
    { pattern: /biometric help/i, handler: 'privacy_security_help' },
    { pattern: /what is biometric/i, handler: 'privacy_security_help' },
    { pattern: /explain biometric/i, handler: 'privacy_security_help' },
  ];
}
