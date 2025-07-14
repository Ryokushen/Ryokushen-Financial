// js/modules/voice/voiceInput.js - Core Voice Input Manager

import { debug } from '../debug.js';
import { showError } from '../ui.js';
import { SpeechRecognitionWrapper } from './speechRecognition.js';
import { VoiceFeedback } from './voiceFeedback.js';
import { TransactionExtractor } from './transactionExtractor.js';
import { SmartFormFiller } from './smartFormFiller.js';

/**
 * VoiceInput - Main manager for voice input functionality
 * Handles voice recognition, state management, and integration with the app
 */
export class VoiceInput {
    constructor(options = {}) {
        this.options = {
            continuous: false,
            interimResults: true,
            maxAlternatives: 1,
            lang: navigator.language || 'en-US',
            ...options
        };

        this.recognition = null;
        this.feedback = new VoiceFeedback();
        this.isSupported = this.checkSupport();
        this.isListening = false;
        this.currentTarget = null; // The input element to fill
        this.smartMode = true; // Enable smart parsing by default
        this.transactionExtractor = new TransactionExtractor();
        this.formFiller = new SmartFormFiller();
        this.callbacks = {
            onResult: null,
            onError: null,
            onEnd: null,
            onSmartParsed: null // New callback for smart parsing results
        };

        if (this.isSupported) {
            this.initialize();
        }
    }

    /**
     * Check if Web Speech API is supported
     */
    checkSupport() {
        const hasAPI = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        
        if (!hasAPI) {
            debug.warn('Web Speech API not supported in this browser');
        }
        
        return hasAPI;
    }

    /**
     * Initialize speech recognition
     */
    initialize() {
        try {
            this.recognition = new SpeechRecognitionWrapper(this.options);
            this.setupEventHandlers();
            debug.log('Voice input initialized successfully');
        } catch (error) {
            debug.error('Failed to initialize voice input:', error);
            this.isSupported = false;
        }
    }

    /**
     * Setup event handlers for speech recognition
     */
    setupEventHandlers() {
        if (!this.recognition) return;

        // Handle recognition results
        this.recognition.onResult((event) => {
            const result = this.processResults(event.results);
            if (result) {
                this.handleResult(result);
            }
        });

        // Handle errors
        this.recognition.onError((event) => {
            this.handleError(event.error);
        });

        // Handle recognition end
        this.recognition.onEnd(() => {
            this.isListening = false;
            this.feedback.stopRecording();
            if (this.callbacks.onEnd) {
                this.callbacks.onEnd();
            }
        });

        // Handle recognition start
        this.recognition.onStart(() => {
            this.isListening = true;
            this.feedback.startRecording();
        });

        // Handle no match
        this.recognition.onNoMatch(() => {
            this.feedback.showError('No speech was detected. Please try again.');
        });
    }

    /**
     * Process recognition results
     */
    processResults(results) {
        if (!results || results.length === 0) return null;

        // Get the last result
        const lastResult = results[results.length - 1];
        
        if (lastResult.isFinal) {
            // Final result - highest confidence
            return {
                transcript: lastResult[0].transcript,
                confidence: lastResult[0].confidence,
                isFinal: true
            };
        } else {
            // Interim result for live feedback
            return {
                transcript: lastResult[0].transcript,
                confidence: lastResult[0].confidence,
                isFinal: false
            };
        }
    }

    /**
     * Handle recognition result
     */
    handleResult(result) {
        if (result.isFinal) {
            // Final result - process with smart parsing if enabled
            if (this.smartMode && this.isTransactionForm()) {
                this.handleSmartTransaction(result.transcript);
            } else {
                // Basic mode - just fill the target input
                if (this.currentTarget) {
                    this.updateTargetInput(result.transcript);
                }
            }
            
            this.feedback.showTranscript(result.transcript, true);
            
            if (this.callbacks.onResult) {
                this.callbacks.onResult(result);
            }
        } else {
            // Interim result - show live feedback
            this.feedback.showTranscript(result.transcript, false);
        }
    }

    /**
     * Handle smart transaction parsing
     */
    async handleSmartTransaction(transcript) {
        try {
            debug.log('Processing smart transaction:', transcript);
            
            // Extract transaction data
            const extractedData = this.transactionExtractor.extractTransaction(transcript);
            
            // Validate extraction
            const validation = this.transactionExtractor.validateExtraction(extractedData);
            
            if (extractedData.confidence > 30) {
                // High enough confidence - auto-fill form
                const fillResult = await this.formFiller.fillForm(extractedData, {
                    showConfirmation: true,
                    highlightFields: true,
                    announceChanges: true
                });
                
                if (fillResult.success && this.callbacks.onSmartParsed) {
                    this.callbacks.onSmartParsed({
                        extractedData,
                        validation,
                        fillResult
                    });
                }
            } else {
                // Low confidence - fallback to basic description filling
                debug.log('Low confidence extraction, falling back to basic mode');
                if (this.currentTarget) {
                    this.updateTargetInput(transcript);
                }
            }
            
        } catch (error) {
            debug.error('Error in smart transaction processing:', error);
            // Fallback to basic mode
            if (this.currentTarget) {
                this.updateTargetInput(transcript);
            }
        }
    }

    /**
     * Check if current context is a transaction form
     */
    isTransactionForm() {
        // Check if we're in the transaction form context
        return document.getElementById('transaction-form') !== null;
    }

    /**
     * Handle recognition errors
     */
    handleError(error) {
        let message = 'Voice input error';
        
        switch (error) {
            case 'no-speech':
                message = 'No speech was detected. Please try again.';
                break;
            case 'audio-capture':
                message = 'No microphone was found. Please check your device.';
                break;
            case 'not-allowed':
                message = 'Microphone permission was denied. Please allow access.';
                break;
            case 'network':
                message = 'Network error occurred. Please check your connection.';
                break;
            case 'aborted':
                message = 'Voice input was cancelled.';
                break;
            default:
                message = `Voice input error: ${error}`;
        }

        debug.error('Voice input error:', error);
        this.feedback.showError(message);
        
        if (this.callbacks.onError) {
            this.callbacks.onError(error, message);
        }
    }

    /**
     * Start listening for voice input
     */
    async startListening(targetElement = null, callbacks = {}) {
        if (!this.isSupported) {
            this.showUnsupportedBrowser();
            return false;
        }

        if (this.isListening) {
            debug.warn('Already listening for voice input');
            return false;
        }

        // Check microphone permission
        const hasPermission = await this.checkMicrophonePermission();
        if (!hasPermission) {
            return false;
        }

        this.currentTarget = targetElement;
        this.callbacks = { ...this.callbacks, ...callbacks };

        try {
            await this.recognition.start();
            return true;
        } catch (error) {
            debug.error('Failed to start voice recognition:', error);
            this.handleError('start-error');
            return false;
        }
    }

    /**
     * Stop listening for voice input
     */
    stopListening() {
        if (!this.isListening || !this.recognition) {
            return;
        }

        try {
            this.recognition.stop();
        } catch (error) {
            debug.error('Error stopping voice recognition:', error);
        }
    }

    /**
     * Check and request microphone permission
     */
    async checkMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            debug.error('Microphone permission denied:', error);
            this.handleError('not-allowed');
            return false;
        }
    }

    /**
     * Update the target input element with transcribed text
     */
    updateTargetInput(text) {
        if (!this.currentTarget) return;

        const currentValue = this.currentTarget.value;
        const newValue = currentValue ? `${currentValue} ${text}` : text;
        
        this.currentTarget.value = newValue;
        
        // Trigger input event for validation
        const event = new Event('input', { bubbles: true });
        this.currentTarget.dispatchEvent(event);
    }

    /**
     * Show unsupported browser message
     */
    showUnsupportedBrowser() {
        const message = 'Voice input is not supported in your browser. Please use Chrome or Safari for voice features.';
        showError(message);
        this.feedback.showError(message);
    }

    /**
     * Check if currently listening
     */
    get listening() {
        return this.isListening;
    }

    /**
     * Toggle smart parsing mode
     */
    setSmartMode(enabled) {
        this.smartMode = enabled;
        debug.log(`Smart mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get current smart mode status
     */
    isSmartModeEnabled() {
        return this.smartMode;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.recognition) {
            this.stopListening();
            this.recognition = null;
        }
        this.feedback.destroy();
    }
}

// Export singleton instance
export const voiceInput = new VoiceInput();