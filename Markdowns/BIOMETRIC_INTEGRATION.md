# Biometric Authentication Integration Guide

This guide explains how to integrate the new biometric authentication feature into your Ryokushen Financial Tracker application.

## Overview

The biometric authentication feature adds an extra layer of security to privacy mode by requiring fingerprint, Face ID, Touch ID, or Windows Hello verification before sensitive financial data can be hidden.

## Files Created

1. **js/modules/biometricAuth.js** - Core biometric authentication logic using WebAuthn API
2. **js/modules/privacy.js** (updated) - Enhanced privacy manager with biometric support
3. **js/modules/privacySettings.js** - Settings UI for managing biometric authentication
4. **js/modules/voice/biometricVoiceCommands.js** - Voice command support

## Integration Steps

### 1. Update app.js

Add the following imports at the top of `app.js`:

```javascript
import { initializePrivacySettings } from './modules/privacySettings.js';
```

In the `setupEventListeners()` function, add:

```javascript
// Initialize privacy settings when settings tab is clicked
document.getElementById('settings-tab-btn')?.addEventListener('click', () => {
    setTimeout(() => initializePrivacySettings(), 100);
});
```

### 2. Update Voice Command Engine

In `js/modules/voice/voiceCommandEngine.js`, add:

```javascript
import { handleBiometricVoiceCommand, getBiometricVoicePatterns } from './biometricVoiceCommands.js';
```

Add biometric patterns to the command patterns:

```javascript
// In the patterns array
...getBiometricVoicePatterns(),
```

In the command processing logic, add:

```javascript
// Check biometric commands
const biometricResult = await handleBiometricVoiceCommand(query);
if (biometricResult) {
    return biometricResult;
}
```

### 3. Update CSS (if needed)

The privacy settings module includes inline styles, but you may want to add these to your main CSS file:

```css
/* Biometric status indicators */
.biometric-status {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
}

.biometric-status.enabled {
    background: #E3F2FD;
    color: #1565C0;
}

.biometric-status.disabled {
    background: #F5F5F5;
    color: #616161;
}

.biometric-status.unsupported {
    background: #FFEBEE;
    color: #C62828;
}
```

## Features

### Security Features
- **WebAuthn API**: Uses industry-standard biometric authentication
- **5-minute bypass**: After successful authentication, no re-authentication needed for 5 minutes
- **Secure storage**: Only stores minimal credential ID, no biometric data
- **HTTPS required**: Biometric authentication only works on secure connections

### User Experience
- **Platform detection**: Automatically detects Touch ID, Face ID, Windows Hello support
- **Graceful fallback**: Works normally without biometrics on unsupported devices
- **Voice control**: Enable/disable biometric protection with voice commands
- **Clear status**: Visual indicators show biometric status at all times

### Privacy Features
- **Click to reveal**: Temporarily show blurred values by clicking (3 seconds)
- **Panic mode**: Instantly hide all sensitive data (Ctrl+Shift+P)
- **Persistent state**: Privacy preferences saved across sessions

## Voice Commands

Users can control biometric authentication with these voice commands:
- "Enable biometric authentication"
- "Disable biometric authentication"
- "Biometric status"
- "What is biometric authentication?"

## Browser Support

Biometric authentication is supported on:
- **Chrome/Edge**: Version 67+ (Windows Hello, Touch ID, Android fingerprint)
- **Safari**: Version 14+ (Touch ID, Face ID on Mac/iOS)
- **Firefox**: Limited support (version 60+ with flags)

## Security Considerations

1. **HTTPS Required**: WebAuthn only works on secure origins (HTTPS or localhost)
2. **User Verification**: Always requires user presence and verification
3. **No Biometric Storage**: The app never stores actual biometric data
4. **Credential Isolation**: Credentials are bound to the specific domain

## Testing

To test biometric authentication:

1. **On Mac**: Use Touch ID (if available) or the system will prompt for password
2. **On Windows**: Use Windows Hello (fingerprint, face, or PIN)
3. **On Mobile**: Use device fingerprint or face recognition
4. **On Unsupported Devices**: Feature gracefully disables itself

## Troubleshooting

### "Not Supported" Status
- Ensure you're using HTTPS (or localhost for development)
- Check browser compatibility
- Verify device has biometric hardware

### Registration Fails
- User may have cancelled the prompt
- Biometric hardware may be unavailable
- Try refreshing the page and attempting again

### Authentication Fails
- Ensure the same finger/face used during registration
- Check if biometric data has changed on device
- May need to re-register after system updates

## Future Enhancements

The settings UI includes placeholders for future features:
- Auto-disable privacy mode after inactivity
- Partial blur (show first/last digits)
- Multiple authentication methods
- Backup authentication options

## API Reference

### Privacy Module Functions

```javascript
// Check if biometric is enabled
isBiometricPrivacyEnabled(): boolean

// Enable biometric authentication
await enableBiometricPrivacy(): Promise<boolean>

// Disable biometric authentication
disableBiometricPrivacy(): void

// Toggle privacy mode (triggers biometric if enabled)
await togglePrivacyMode(): Promise<void>
```

### Biometric Module Functions

```javascript
// Check device support
isBiometricSupported(): boolean

// Check registration status
isBiometricRegistered(): boolean

// Register biometric
await registerBiometric(): Promise<boolean>

// Authenticate user
await authenticateWithBiometric(): Promise<boolean>

// Get platform info
getBiometricPlatformInfo(): object
```

## Security Best Practices

1. Always handle authentication errors gracefully
2. Provide clear feedback to users about biometric status
3. Never store sensitive authentication data in localStorage
4. Always require re-authentication for sensitive operations
5. Implement timeout mechanisms for extended sessions

---

For questions or issues, please refer to the WebAuthn specification: https://www.w3.org/TR/webauthn-2/