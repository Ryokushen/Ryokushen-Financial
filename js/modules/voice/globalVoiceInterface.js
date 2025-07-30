// js/modules/voice/globalVoiceInterface.js - Global Voice Command Interface

import { debug } from '../debug.js';
import { announceToScreenReader } from '../ui.js';
import { VoiceCommandEngine } from './voiceCommandEngine.js';
import { VoiceAnalytics } from './voiceAnalytics.js';
import { VoiceNavigation } from './voiceNavigation.js';
import { VoiceResponseSystem } from './voiceResponseSystem.js';
import { voiceInput } from './voiceInput.js';
import { eventManager } from '../eventManager.js';

/**
 * Global Voice Interface - Central coordinator for all voice command functionality
 */
export class GlobalVoiceInterface {
    constructor(appState) {
        this.appState = appState;
        this.isListening = false;
        this.isProcessing = false;
        
        // Initialize voice components
        this.commandEngine = new VoiceCommandEngine();
        this.analytics = new VoiceAnalytics(appState);
        this.navigation = new VoiceNavigation(appState);
        this.responseSystem = new VoiceResponseSystem();
        
        this.initializeGlobalInterface();
        this.setupEventListeners();
    }

    /**
     * Initialize global voice interface UI
     */
    initializeGlobalInterface() {
        this.createGlobalVoiceButton();
        this.injectGlobalStyles();
    }

    /**
     * Create global voice command button
     */
    createGlobalVoiceButton() {
        // Remove existing button
        const existing = document.getElementById('global-voice-btn');
        if (existing) {
            existing.remove();
        }

        const button = document.createElement('button');
        button.id = 'global-voice-btn';
        button.className = 'global-voice-btn';
        button.setAttribute('aria-label', 'Voice commands');
        button.setAttribute('title', 'Click for voice commands (Chrome/Safari only)');
        
        button.innerHTML = `
            <svg class="voice-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            <span class="voice-text">Voice</span>
        `;

        // Add to header navigation
        const header = document.querySelector('.header .tab-nav');
        if (header) {
            header.appendChild(button);
        } else {
            // Fallback - add to body
            document.body.appendChild(button);
        }

        this.voiceButton = button;
    }

    /**
     * Inject global voice interface styles
     */
    injectGlobalStyles() {
        if (document.getElementById('global-voice-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'global-voice-styles';
        styles.textContent = `
            .global-voice-btn {
                background: var(--color-primary, #007bff);
                color: white;
                border: none;
                border-radius: 24px;
                padding: 8px 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
                margin-left: auto;
                box-shadow: 0 2px 8px rgba(0, 123, 255, 0.2);
            }

            .global-voice-btn:hover {
                background: var(--color-primary-hover, #0056b3);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
            }

            .global-voice-btn:active {
                transform: translateY(0);
            }

            .global-voice-btn.listening {
                background: var(--color-error, #dc3545);
                animation: voicePulse 1.5s infinite;
            }

            .global-voice-btn.processing {
                background: var(--color-warning, #ffc107);
                color: var(--color-text, #333);
            }

            .global-voice-btn:disabled {
                background: var(--color-secondary, #6c757d);
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            @keyframes voicePulse {
                0% { transform: scale(1); box-shadow: 0 2px 8px rgba(220, 53, 69, 0.2); }
                50% { transform: scale(1.05); box-shadow: 0 4px 16px rgba(220, 53, 69, 0.4); }
                100% { transform: scale(1); box-shadow: 0 2px 8px rgba(220, 53, 69, 0.2); }
            }

            .global-voice-btn .voice-icon {
                width: 18px;
                height: 18px;
            }

            .global-voice-btn .voice-text {
                font-size: 13px;
            }

            /* Hide in privacy mode */
            .privacy-mode .global-voice-btn {
                display: none;
            }

            /* Hide in unsupported browsers */
            .no-voice-support .global-voice-btn {
                display: none;
            }

            /* Mobile responsive */
            @media (max-width: 768px) {
                .global-voice-btn .voice-text {
                    display: none;
                }
                .global-voice-btn {
                    padding: 10px;
                    border-radius: 50%;
                    width: 44px;
                    height: 44px;
                    justify-content: center;
                }
                .global-voice-btn .voice-icon {
                    width: 20px;
                    height: 20px;
                }
            }

            /* Voice status indicator */
            .voice-status-indicator {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--color-surface, white);
                border: 2px solid var(--color-primary, #007bff);
                border-radius: 24px;
                padding: 8px 16px;
                font-size: 14px;
                font-weight: 500;
                z-index: 9998;
                display: none;
                animation: slideUp 0.3s ease-out;
            }

            @keyframes slideUp {
                from {
                    transform: translateX(-50%) translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
            }

            .voice-status-indicator.listening {
                border-color: var(--color-error, #dc3545);
                color: var(--color-error, #dc3545);
            }

            .voice-status-indicator.processing {
                border-color: var(--color-warning, #ffc107);
                color: var(--color-warning, #ffc107);
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.voiceButton) {
            eventManager.addEventListener(this.voiceButton, 'click', this.handleVoiceButtonClick.bind(this));
        }

        // Keyboard shortcut (Ctrl/Cmd + K)
        eventManager.addEventListener(document, 'keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.shiftKey) {
                e.preventDefault();
                this.toggleVoiceCommand();
            }
        });

        // Check browser support
        this.checkBrowserSupport();
    }

    /**
     * Handle voice button click
     */
    async handleVoiceButtonClick() {
        if (this.isListening) {
            this.stopListening();
        } else {
            await this.startListening();
        }
    }

    /**
     * Start listening for voice commands
     */
    async startListening() {
        if (!voiceInput.isSupported) {
            this.showUnsupportedMessage();
            return;
        }

        if (this.isListening || this.isProcessing) {
            return;
        }

        try {
            this.setListeningState(true);
            this.showStatusIndicator('🎤 Listening for voice command...', 'listening');

            const started = await voiceInput.startListening(null, {
                onResult: this.handleVoiceResult.bind(this),
                onError: this.handleVoiceError.bind(this),
                onEnd: this.handleVoiceEnd.bind(this)
            });

            if (started) {
                announceToScreenReader('Voice command listening started. Speak your command now.');
            } else {
                this.setListeningState(false);
                this.hideStatusIndicator();
            }

        } catch (error) {
            debug.error('Error starting voice command:', error);
            this.setListeningState(false);
            this.hideStatusIndicator();
            this.responseSystem.displayResponse({
                type: 'error',
                success: false,
                response: {
                    text: 'Failed to start voice recognition',
                    title: 'Voice Error',
                    details: 'Please check your microphone permissions and try again.'
                }
            });
        }
    }

    /**
     * Stop listening for voice commands
     */
    stopListening() {
        if (this.isListening) {
            voiceInput.stopListening();
            this.setListeningState(false);
            this.hideStatusIndicator();
            announceToScreenReader('Voice command listening stopped');
        }
    }

    /**
     * Toggle voice command listening
     */
    async toggleVoiceCommand() {
        if (this.isListening) {
            this.stopListening();
        } else {
            await this.startListening();
        }
    }

    /**
     * Handle voice recognition result
     */
    async handleVoiceResult(result) {
        if (result.isFinal) {
            this.setListeningState(false);
            this.setProcessingState(true);
            this.showStatusIndicator('⚙️ Processing command...', 'processing');

            const transcript = result.transcript.trim();
            debug.log('Voice command received:', transcript);

            try {
                await this.processVoiceCommand(transcript);
            } catch (error) {
                debug.error('Error processing voice command:', error);
                this.responseSystem.displayResponse({
                    type: 'error',
                    success: false,
                    response: {
                        text: 'Failed to process voice command',
                        title: 'Processing Error',
                        details: 'Please try again or rephrase your command.'
                    }
                });
            } finally {
                this.setProcessingState(false);
                this.hideStatusIndicator();
            }
        }
    }

    /**
     * Process voice command using command engine
     */
    async processVoiceCommand(transcript) {
        // Parse command intent and parameters
        const commandResult = this.commandEngine.processCommand(transcript);
        
        debug.log('Command analysis:', commandResult);

        if (!commandResult.isCommand || commandResult.confidence < 0.5) {
            // Not a recognized command
            this.responseSystem.displayResponse({
                type: 'error',
                success: false,
                response: {
                    text: 'Command not recognized',
                    title: 'Unknown Command',
                    details: 'Try saying "help" to see available commands.'
                }
            });
            return;
        }

        // Route command to appropriate handler
        const { intent, parameters } = commandResult;
        const category = this.commandEngine.getIntentCategory(intent);

        let result;
        switch (category) {
            case 'query':
                result = await this.analytics.processQuery(intent, parameters);
                break;
            case 'navigation':
            case 'action':
            case 'settings':
            case 'general':
                result = await this.navigation.processNavigation(intent, parameters);
                break;
            default:
                result = {
                    type: 'error',
                    success: false,
                    response: {
                        text: 'Command category not supported',
                        title: 'Unsupported Command',
                        details: 'This type of command is not yet implemented.'
                    }
                };
        }

        // Display result
        this.responseSystem.displayResponse(result);
    }

    /**
     * Handle voice recognition error
     */
    handleVoiceError(error, message) {
        this.setListeningState(false);
        this.setProcessingState(false);
        this.hideStatusIndicator();

        debug.error('Voice recognition error:', error);
        
        this.responseSystem.displayResponse({
            type: 'error',
            success: false,
            response: {
                text: message || 'Voice recognition error',
                title: 'Voice Error',
                details: 'Please check your microphone and try again.'
            }
        });
    }

    /**
     * Handle voice recognition end
     */
    handleVoiceEnd() {
        this.setListeningState(false);
        if (!this.isProcessing) {
            this.hideStatusIndicator();
        }
    }

    /**
     * Set listening state
     */
    setListeningState(listening) {
        this.isListening = listening;
        
        if (this.voiceButton) {
            this.voiceButton.classList.toggle('listening', listening);
            this.voiceButton.disabled = this.isProcessing;
        }
    }

    /**
     * Set processing state
     */
    setProcessingState(processing) {
        this.isProcessing = processing;
        
        if (this.voiceButton) {
            this.voiceButton.classList.toggle('processing', processing);
            this.voiceButton.disabled = processing;
        }
    }

    /**
     * Show status indicator
     */
    showStatusIndicator(message, type = '') {
        let indicator = document.getElementById('voice-status-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'voice-status-indicator';
            indicator.className = 'voice-status-indicator';
            document.body.appendChild(indicator);
        }

        indicator.textContent = message;
        indicator.className = `voice-status-indicator ${type}`;
        indicator.style.display = 'block';
    }

    /**
     * Hide status indicator
     */
    hideStatusIndicator() {
        const indicator = document.getElementById('voice-status-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Check browser support
     */
    checkBrowserSupport() {
        if (!voiceInput.isSupported) {
            document.body.classList.add('no-voice-support');
            if (this.voiceButton) {
                this.voiceButton.disabled = true;
                this.voiceButton.title = 'Voice commands not supported in this browser';
            }
        }
    }

    /**
     * Show unsupported browser message
     */
    showUnsupportedMessage() {
        this.responseSystem.displayResponse({
            type: 'error',
            success: false,
            response: {
                text: 'Voice commands not supported',
                title: 'Browser Compatibility',
                details: 'Please use Chrome or Safari for voice features.'
            }
        });
    }

    /**
     * Update app state for all components
     */
    updateAppState(newAppState) {
        this.appState = newAppState;
        this.analytics.updateAppState(newAppState);
        this.navigation.updateAppState(newAppState);
    }

    /**
     * Show help
     */
    showHelp() {
        const examples = this.commandEngine.getCommandExamples();
        const commands = [];
        
        Object.values(examples).forEach(categoryCommands => {
            commands.push(...categoryCommands.slice(0, 2)); // 2 examples per category
        });

        this.responseSystem.displayResponse({
            type: 'help',
            success: true,
            data: { commands: commands.slice(0, 8) }, // Limit to 8 total
            response: {
                text: 'Here are some voice commands you can try',
                title: 'Voice Commands Help',
                details: 'Speak naturally - I understand many variations!'
            }
        });
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stopListening();
        
        if (this.voiceButton && this.voiceButton.parentNode) {
            this.voiceButton.parentNode.removeChild(this.voiceButton);
        }

        this.hideStatusIndicator();
        this.responseSystem.clearAll();
    }
}