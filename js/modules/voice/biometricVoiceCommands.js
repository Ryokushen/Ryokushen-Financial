// js/modules/voice/biometricVoiceCommands.js - Voice commands for biometric privacy
import { debug } from '../debug.js';
import { 
    isBiometricSupported,
    isBiometricPrivacyEnabled,
    enableBiometricPrivacy,
    disableBiometricPrivacy
} from '../privacy.js';

/**
 * Handle biometric-related voice commands
 */
export async function handleBiometricVoiceCommand(command) {
    const lowerCommand = command.toLowerCase();
    
    // Check biometric status
    if (lowerCommand.includes('biometric status') || 
        lowerCommand.includes('is biometric enabled')) {
        const isSupported = isBiometricSupported();
        const isEnabled = isBiometricPrivacyEnabled();
        
        if (!isSupported) {
            return {
                success: true,
                message: 'Biometric authentication is not supported on this device.'
            };
        }
        
        return {
            success: true,
            message: isEnabled ? 
                'Biometric authentication is enabled for privacy mode.' : 
                'Biometric authentication is disabled.'
        };
    }
    
    // Enable biometric
    if (lowerCommand.includes('enable biometric') || 
        lowerCommand.includes('turn on biometric') ||
        lowerCommand.includes('activate biometric')) {
        
        if (!isBiometricSupported()) {
            return {
                success: false,
                message: 'Biometric authentication is not supported on this device.'
            };
        }
        
        if (isBiometricPrivacyEnabled()) {
            return {
                success: true,
                message: 'Biometric authentication is already enabled.'
            };
        }
        
        try {
            await enableBiometricPrivacy();
            return {
                success: true,
                message: 'Biometric authentication has been enabled. You will need to authenticate with your fingerprint or face to enable privacy mode.'
            };
        } catch (error) {
            debug.error('Failed to enable biometric via voice:', error);
            return {
                success: false,
                message: 'Failed to enable biometric authentication. Please try from the settings page.'
            };
        }
    }
    
    // Disable biometric
    if (lowerCommand.includes('disable biometric') || 
        lowerCommand.includes('turn off biometric') ||
        lowerCommand.includes('deactivate biometric')) {
        
        if (!isBiometricPrivacyEnabled()) {
            return {
                success: true,
                message: 'Biometric authentication is already disabled.'
            };
        }
        
        // For security, we should confirm this action
        return {
            success: true,
            message: 'To disable biometric authentication, please go to Settings > Privacy & Security. This requires confirmation for security reasons.',
            action: 'navigate_settings'
        };
    }
    
    // Help command
    if (lowerCommand.includes('biometric help') || 
        lowerCommand.includes('what is biometric')) {
        return {
            success: true,
            message: 'Biometric authentication adds an extra layer of security to privacy mode. When enabled, you must verify your identity with your fingerprint, Face ID, or Windows Hello before sensitive data can be hidden. Say "enable biometric" to set it up.'
        };
    }
    
    return null; // Command not handled
}

/**
 * Get biometric-related voice command patterns
 */
export function getBiometricVoicePatterns() {
    return [
        // Status commands
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
        
        // Help commands
        { pattern: /biometric help/i, handler: 'biometric_help' },
        { pattern: /what is biometric/i, handler: 'biometric_help' },
        { pattern: /explain biometric/i, handler: 'biometric_help' }
    ];
}