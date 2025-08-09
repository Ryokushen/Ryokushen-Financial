// js/modules/voice/voiceFeedback.js - Voice Input Visual Feedback

import { debug } from '../debug.js';

/**
 * VoiceFeedback - Manages visual and audio feedback for voice input
 */
export class VoiceFeedback {
  constructor() {
    this.container = null;
    this.elements = {};
    this.animationFrame = null;
    this.isRecording = false;
    this.createFeedbackUI();
  }

  /**
   * Create the feedback UI elements
   */
  createFeedbackUI() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'voice-feedback-container';
    this.container.style.display = 'none';
    this.container.innerHTML = `
            <div class="voice-feedback-content">
                <div class="voice-indicator">
                    <div class="voice-indicator-dot"></div>
                    <svg class="voice-waveform" width="60" height="30">
                        <path d="M0,15 L60,15" stroke="currentColor" stroke-width="2" fill="none"/>
                    </svg>
                </div>
                <div class="voice-status">
                    <span class="voice-status-text">Ready to listen...</span>
                    <span class="voice-timer">0:00</span>
                </div>
                <div class="voice-transcript"></div>
                <div class="voice-error" style="display: none;"></div>
            </div>
        `;

    // Get element references
    this.elements = {
      indicator: this.container.querySelector('.voice-indicator'),
      dot: this.container.querySelector('.voice-indicator-dot'),
      waveform: this.container.querySelector('.voice-waveform path'),
      statusText: this.container.querySelector('.voice-status-text'),
      timer: this.container.querySelector('.voice-timer'),
      transcript: this.container.querySelector('.voice-transcript'),
      error: this.container.querySelector('.voice-error'),
    };

    // Append to body
    document.body.appendChild(this.container);

    // Add styles if not already present
    this.injectStyles();
  }

  /**
   * Inject CSS styles for voice feedback
   */
  injectStyles() {
    if (document.getElementById('voice-feedback-styles')) {
      return;
    }

    const styles = document.createElement('style');
    styles.id = 'voice-feedback-styles';
    styles.textContent = `
            .voice-feedback-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 1000;
                max-width: 400px;
                animation: slideIn 0.3s ease-out;
            }

            .voice-feedback-content {
                background: var(--color-surface, #ffffff);
                border: 2px solid var(--color-border, #e0e0e0);
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .voice-indicator {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }

            .voice-indicator-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: var(--color-secondary, #6c757d);
                transition: all 0.3s ease;
            }

            .voice-indicator-dot.recording {
                background: var(--color-error, #dc3545);
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.8; }
                100% { transform: scale(1); opacity: 1; }
            }

            .voice-waveform {
                color: var(--color-primary, #007bff);
            }

            .voice-status {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                font-size: 14px;
                color: var(--color-text-secondary, #6c757d);
            }

            .voice-transcript {
                min-height: 24px;
                padding: 8px;
                background: var(--color-surface-secondary, #f8f9fa);
                border-radius: 6px;
                font-size: 16px;
                color: var(--color-text, #212529);
            }

            .voice-transcript.interim {
                opacity: 0.7;
                font-style: italic;
            }

            .voice-error {
                margin-top: 8px;
                padding: 8px;
                background: var(--color-error-bg, #f8d7da);
                color: var(--color-error, #721c24);
                border-radius: 6px;
                font-size: 14px;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            /* Mobile responsive */
            @media (max-width: 480px) {
                .voice-feedback-container {
                    left: 10px;
                    right: 10px;
                    bottom: 10px;
                    max-width: none;
                }
            }

            /* Privacy mode compatibility */
            .privacy-mode .voice-feedback-container {
                display: none !important;
            }
        `;

    document.head.appendChild(styles);
  }

  /**
   * Show the feedback UI
   */
  show() {
    this.container.style.display = 'block';
    this.resetUI();
  }

  /**
   * Hide the feedback UI
   */
  hide() {
    this.container.style.display = 'none';
    this.stopRecording();
  }

  /**
   * Start recording animation
   */
  startRecording() {
    this.show();
    this.isRecording = true;
    this.elements.dot.classList.add('recording');
    this.elements.statusText.textContent = 'Listening...';
    this.startTimer();
    this.animateWaveform();
    debug.log('Voice recording started');
  }

  /**
   * Stop recording animation
   */
  stopRecording() {
    this.isRecording = false;
    this.elements.dot.classList.remove('recording');
    this.elements.statusText.textContent = 'Processing...';
    this.stopTimer();
    this.stopWaveformAnimation();
    debug.log('Voice recording stopped');
  }

  /**
   * Show transcript
   */
  showTranscript(text, isFinal = false) {
    this.elements.transcript.textContent = text;
    this.elements.transcript.classList.toggle('interim', !isFinal);

    if (isFinal) {
      this.elements.statusText.textContent = 'Complete';
      setTimeout(() => this.hide(), 2000);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.elements.error.textContent = message;
    this.elements.error.style.display = 'block';
    this.elements.statusText.textContent = 'Error';
    this.stopRecording();

    setTimeout(() => {
      this.hide();
    }, 5000);
  }

  /**
   * Reset UI to initial state
   */
  resetUI() {
    this.elements.transcript.textContent = '';
    this.elements.transcript.classList.remove('interim');
    this.elements.error.style.display = 'none';
    this.elements.error.textContent = '';
    this.elements.timer.textContent = '0:00';
  }

  /**
   * Start timer
   */
  startTimer() {
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      this.elements.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 100);
  }

  /**
   * Stop timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Animate waveform
   */
  animateWaveform() {
    const animate = () => {
      if (!this.isRecording) {
        return;
      }

      const time = Date.now() / 1000;
      const points = [];

      for (let i = 0; i <= 60; i += 5) {
        const y = 15 + Math.sin(i / 10 + time * 2) * 5 * Math.random();
        points.push(`${i},${y}`);
      }

      this.elements.waveform.setAttribute('d', `M${points.join(' L')}`);
      this.animationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Stop waveform animation
   */
  stopWaveformAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
      this.elements.waveform.setAttribute('d', 'M0,15 L60,15');
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopRecording();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
