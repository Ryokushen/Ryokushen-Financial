// js/modules/voice/speechRecognition.js - Web Speech API Wrapper

import { debug } from '../debug.js';

/**
 * SpeechRecognitionWrapper - Wrapper for Web Speech API
 * Provides a consistent interface across different browser implementations
 */
export class SpeechRecognitionWrapper {
  constructor(options = {}) {
    // Get the correct constructor for the browser
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Speech Recognition API not supported');
    }

    this.recognition = new SpeechRecognition();
    this.configure(options);
    this.eventHandlers = {
      start: null,
      result: null,
      error: null,
      end: null,
      nomatch: null,
      soundstart: null,
      soundend: null,
    };

    this.setupNativeHandlers();
  }

  /**
   * Configure recognition options
   */
  configure(options) {
    // Set recognition properties
    this.recognition.continuous = options.continuous || false;
    this.recognition.interimResults = options.interimResults !== false;
    this.recognition.maxAlternatives = options.maxAlternatives || 1;
    this.recognition.lang = options.lang || navigator.language || 'en-US';

    debug.log('Speech recognition configured:', {
      continuous: this.recognition.continuous,
      interimResults: this.recognition.interimResults,
      maxAlternatives: this.recognition.maxAlternatives,
      lang: this.recognition.lang,
    });
  }

  /**
   * Setup native event handlers
   */
  setupNativeHandlers() {
    // Recognition started
    this.recognition.onstart = event => {
      debug.log('Speech recognition started');
      if (this.eventHandlers.start) {
        this.eventHandlers.start(event);
      }
    };

    // Results received
    this.recognition.onresult = event => {
      debug.log('Speech recognition result:', event);
      if (this.eventHandlers.result) {
        this.eventHandlers.result(event);
      }
    };

    // Error occurred
    this.recognition.onerror = event => {
      debug.error('Speech recognition error:', event.error);
      if (this.eventHandlers.error) {
        this.eventHandlers.error(event);
      }
    };

    // Recognition ended
    this.recognition.onend = event => {
      debug.log('Speech recognition ended');
      if (this.eventHandlers.end) {
        this.eventHandlers.end(event);
      }
    };

    // No match found
    this.recognition.onnomatch = event => {
      debug.warn('Speech recognition no match');
      if (this.eventHandlers.nomatch) {
        this.eventHandlers.nomatch(event);
      }
    };

    // Sound started
    this.recognition.onsoundstart = event => {
      debug.log('Sound detected');
      if (this.eventHandlers.soundstart) {
        this.eventHandlers.soundstart(event);
      }
    };

    // Sound ended
    this.recognition.onsoundend = event => {
      debug.log('Sound ended');
      if (this.eventHandlers.soundend) {
        this.eventHandlers.soundend(event);
      }
    };
  }

  /**
   * Register event handler
   */
  on(eventName, handler) {
    if (Object.prototype.hasOwnProperty.call(this.eventHandlers, eventName)) {
      this.eventHandlers[eventName] = handler;
    } else {
      debug.warn(`Unknown event: ${eventName}`);
    }
  }

  /**
   * Convenience methods for common events
   */
  onStart(handler) {
    this.on('start', handler);
  }

  onResult(handler) {
    this.on('result', handler);
  }

  onError(handler) {
    this.on('error', handler);
  }

  onEnd(handler) {
    this.on('end', handler);
  }

  onNoMatch(handler) {
    this.on('nomatch', handler);
  }

  /**
   * Start recognition
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Override onstart for this promise
        const originalStart = this.eventHandlers.start;
        this.eventHandlers.start = event => {
          this.eventHandlers.start = originalStart;
          if (originalStart) {
            originalStart(event);
          }
          resolve();
        };

        // Override onerror for this promise
        const originalError = this.eventHandlers.error;
        this.eventHandlers.error = event => {
          this.eventHandlers.error = originalError;
          if (originalError) {
            originalError(event);
          }
          reject(new Error(event.error));
        };

        this.recognition.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop recognition
   */
  stop() {
    try {
      this.recognition.stop();
    } catch (error) {
      debug.warn('Error stopping recognition:', error);
    }
  }

  /**
   * Abort recognition
   */
  abort() {
    try {
      this.recognition.abort();
    } catch (error) {
      debug.warn('Error aborting recognition:', error);
    }
  }

  /**
   * Get supported languages (browser-dependent)
   */
  static getSupportedLanguages() {
    // This is a subset of commonly supported languages
    // Actual support varies by browser and OS
    return [
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'es-ES', name: 'Spanish (Spain)' },
      { code: 'es-MX', name: 'Spanish (Mexico)' },
      { code: 'fr-FR', name: 'French' },
      { code: 'de-DE', name: 'German' },
      { code: 'it-IT', name: 'Italian' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)' },
      { code: 'zh-CN', name: 'Chinese (Simplified)' },
      { code: 'zh-TW', name: 'Chinese (Traditional)' },
      { code: 'ja-JP', name: 'Japanese' },
      { code: 'ko-KR', name: 'Korean' },
    ];
  }

  /**
   * Check if continuous mode is supported
   */
  static supportsContinuous() {
    // Most browsers support continuous mode
    return true;
  }

  /**
   * Check if interim results are supported
   */
  static supportsInterimResults() {
    // Most browsers support interim results
    return true;
  }
}
