// js/modules/supabaseAuth.js - Supabase Authentication Module
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';

class SupabaseAuthManager {
  constructor() {
    this.user = null;
    this.session = null;
    this._supabase = window.supabaseClient; // Private property - use methods instead of direct access
    this.initialized = false;
    this.previousUserId = null;
    this.initPromise = this.initializeAuth();
  }

  /**
   * Initialize authentication state
   */
  async initializeAuth() {
    try {
      // Check for password reset on page load
      this.handlePasswordReset();

      // Get initial session
      const {
        data: { session },
      } = await this._supabase.auth.getSession();
      this.session = session;
      this.user = session?.user || null;
      this.initialized = true;

      // Track previous user ID to detect actual auth changes
      this.previousUserId = this.user?.id || null;

      // Listen for auth changes
      this._supabase.auth.onAuthStateChange((event, session) => {
        const currentUserId = session?.user?.id || null;
        const wasSignedIn = !!this.previousUserId;
        const isSignedIn = !!currentUserId;
        const userChanged = currentUserId !== this.previousUserId;

        // Update session and user
        this.session = session;
        this.user = session?.user || null;

        // Only reload on actual auth state changes
        if (event === 'SIGNED_OUT' && wasSignedIn) {
          // User actually signed out
          window.location.reload();
        } else if (event === 'SIGNED_IN' && !wasSignedIn && isSignedIn) {
          // New user signed in (was null, now has user)
          window.location.reload();
        } else if (event === 'SIGNED_IN' && userChanged && wasSignedIn && isSignedIn) {
          // Different user signed in (user switch)
          window.location.reload();
        }
        // Ignore SIGNED_IN events where user hasn't changed (tab/app refocus)

        // Update tracked user ID
        this.previousUserId = currentUserId;
      });
    } catch (error) {
      debug.error('Failed to initialize auth:', error);
      this.initialized = true; // Mark as initialized even on error
    }
  }

  /**
   * Wait for authentication to be initialized
   */
  async waitForInit() {
    await this.initPromise;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.session;
  }

  /**
   * Check if user's email is verified
   */
  isEmailVerified() {
    return this.user?.email_confirmed_at !== null;
  }

  /**
   * Handle password reset flow
   */
  async handlePasswordReset() {
    // Check if we're coming from a password reset email
    const hash = window.location.hash.substring(1);

    // Check for recovery in the hash (e.g., #recovery&access_token=...)
    if (hash.includes('recovery')) {
      // Parse the hash parameters
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      // Show password reset form if we have recovery type or just recovery in URL
      if ((type === 'recovery' && accessToken) || hash.startsWith('recovery')) {
        // User clicked password reset link
        this.showPasswordResetForm();
        return true; // Indicate that we handled the reset
      }
    }

    return false; // No password reset to handle
  }

  /**
   * Show password reset form
   */
  showPasswordResetForm() {
    document.body.innerHTML = `
            <div class="auth-container">
                <div class="auth-box">
                    <h1>Reset Your Password</h1>
                    <h2>Enter your new password</h2>
                    
                    <div class="auth-form">
                        <div class="form-group">
                            <label for="new-password">New Password</label>
                            <input type="password" id="new-password" class="form-control" 
                                   placeholder="Enter new password" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="confirm-password">Confirm Password</label>
                            <input type="password" id="confirm-password" class="form-control" 
                                   placeholder="Confirm new password" required>
                        </div>
                        
                        <button id="reset-password-btn" class="btn btn--primary btn--block">
                            Update Password
                        </button>
                    </div>
                    
                    <div id="auth-error" class="error-message" style="display: none;"></div>
                    <div id="auth-success" class="success-message" style="display: none;"></div>
                </div>
            </div>
            
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .auth-container {
                    width: 100%;
                    max-width: 400px;
                    padding: 20px;
                }
                
                .auth-box {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    padding: 40px;
                }
                
                .auth-box h1 {
                    margin: 0 0 10px 0;
                    color: #333;
                    font-size: 24px;
                    text-align: center;
                }
                
                .auth-box h2 {
                    margin: 0 0 30px 0;
                    color: #666;
                    font-size: 16px;
                    font-weight: normal;
                    text-align: center;
                }
                
                .auth-form {
                    display: block;
                }
                
                .form-group {
                    margin-bottom: 20px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    color: #374151;
                    font-weight: 500;
                }
                
                .form-control {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e5e7eb;
                    border-radius: 6px;
                    font-size: 16px;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                    color: #333;
                    background: #ffffff;
                }
                
                .form-control::placeholder {
                    color: #9ca3af;
                }
                
                .form-control:focus {
                    outline: none;
                    border-color: #3b82f6;
                    color: #333;
                }
                
                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .btn--primary {
                    background: #3b82f6;
                    color: white;
                }
                
                .btn--primary:hover {
                    background: #2563eb;
                    transform: translateY(-1px);
                }
                
                .btn--block {
                    width: 100%;
                    display: block;
                }
                
                .error-message {
                    background: #fee;
                    border: 1px solid #fcc;
                    color: #c33;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 20px;
                    font-size: 14px;
                    text-align: center;
                }
                
                .success-message {
                    background: #d1fae5;
                    border: 1px solid #34d399;
                    color: #065f46;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 20px;
                    font-size: 14px;
                    text-align: center;
                }
            </style>
        `;

    // Add event handler
    const resetBtn = document.getElementById('reset-password-btn');
    if (resetBtn) {
      eventManager.addEventListener(resetBtn, 'click', () => this.updatePassword());
    }

    // Enter key handling
    document.querySelectorAll('input').forEach(input => {
      eventManager.addEventListener(input, 'keypress', e => {
        if (e.key === 'Enter') {
          this.updatePassword();
        }
      });
    });
  }

  /**
   * Update password
   */
  async updatePassword() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!newPassword || !confirmPassword) {
      this.showError('Please fill in both password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      this.showError('Password must be at least 8 characters');
      return;
    }

    try {
      const { error } = await this._supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      this.showSuccess('Password updated successfully! Redirecting to login...');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.hash = '';
        window.location.reload();
      }, 2000);
    } catch (error) {
      this.showError(error.message || 'Failed to update password');
    }
  }

  /**
   * Request password reset email
   */
  async requestPasswordReset(email) {
    try {
      // Use window.location.origin to support both local and production environments
      const baseUrl = window.location.origin;
      const { error } = await this._supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/#recovery`,
      });

      if (error) {
        throw error;
      }

      return { success: true, message: 'Password reset email sent! Check your inbox.' };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to send reset email' };
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail() {
    try {
      const user = this.getUser();
      if (!user || !user.email) {
        throw new Error('No user email found');
      }

      const { error } = await this._supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) {
        throw error;
      }

      return { success: true, message: 'Verification email sent! Check your inbox.' };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to send verification email' };
    }
  }

  /**
   * Show login screen
   */
  showAuthScreen() {
    document.body.innerHTML = `
            <div class="auth-container">
                <div class="auth-box">
                    <h1>Ryokushen Financial Tracker</h1>
                    <h2>Secure Login</h2>
                    
                    <div class="auth-tabs">
                        <button class="auth-tab active" data-tab="login">Login</button>
                        <button class="auth-tab" data-tab="signup">Sign Up</button>
                    </div>
                    
                    <!-- Login Form -->
                    <div id="login-form" class="auth-form active">
                        <div class="form-group">
                            <label for="login-email">EMAIL</label>
                            <input type="email" id="login-email" class="form-control" 
                                   placeholder="your@email.com" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="login-password">PASSWORD</label>
                            <input type="password" id="login-password" class="form-control" 
                                   placeholder="Your password" required>
                        </div>
                        
                        <div class="form-group" style="text-align: right;">
                            <a href="#" id="forgot-password-link" style="color: #3b82f6; text-decoration: none; font-size: 14px;">
                                Forgot your password?
                            </a>
                        </div>
                        
                        <button id="login-btn" class="btn btn--primary btn--block">
                            Login
                        </button>
                        
                        <div class="divider">OR</div>
                        
                        <button id="magic-link-btn" class="btn btn--secondary btn--block">
                            Send Magic Link
                        </button>
                    </div>
                    
                    <!-- Sign Up Form -->
                    <div id="signup-form" class="auth-form">
                        <div class="form-group">
                            <label for="signup-email">EMAIL</label>
                            <input type="email" id="signup-email" class="form-control" 
                                   placeholder="your@email.com" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="signup-password">PASSWORD</label>
                            <input type="password" id="signup-password" class="form-control" 
                                   placeholder="Choose a strong password" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="signup-confirm">CONFIRM PASSWORD</label>
                            <input type="password" id="signup-confirm" class="form-control" 
                                   placeholder="Confirm your password" required>
                        </div>
                        
                        <button id="signup-btn" class="btn btn--primary btn--block">
                            Sign Up
                        </button>
                    </div>
                    
                    <div id="auth-error" class="error-message" style="display: none;"></div>
                    <div id="auth-success" class="success-message" style="display: none;"></div>
                </div>
            </div>
            
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .auth-container {
                    width: 100%;
                    max-width: 400px;
                    padding: 20px;
                }
                
                .auth-box {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    padding: 40px;
                }
                
                .auth-box h1 {
                    margin: 0 0 10px 0;
                    color: #333;
                    font-size: 24px;
                    text-align: center;
                }
                
                .auth-box h2 {
                    margin: 0 0 30px 0;
                    color: #666;
                    font-size: 16px;
                    font-weight: normal;
                    text-align: center;
                }
                
                .auth-tabs {
                    display: flex;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #e5e7eb;
                }
                
                .auth-tab {
                    flex: 1;
                    padding: 10px;
                    background: none;
                    border: none;
                    font-size: 16px;
                    font-weight: 500;
                    color: #6b7280;
                    cursor: pointer;
                    transition: all 0.2s;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -2px;
                }
                
                .auth-tab.active {
                    color: #3b82f6;
                    border-bottom-color: #3b82f6;
                }
                
                .auth-form {
                    display: none;
                }
                
                .auth-form.active {
                    display: block;
                }
                
                .form-group {
                    margin-bottom: 20px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    color: #374151;
                    font-weight: 600;
                    font-size: 13px;
                    letter-spacing: 0.5px;
                }
                
                .form-control {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e5e7eb;
                    border-radius: 6px;
                    font-size: 16px;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                    color: #333;
                    background: #ffffff;
                }
                
                .form-control::placeholder {
                    color: #9ca3af;
                }
                
                .form-control:focus {
                    outline: none;
                    border-color: #3b82f6;
                    color: #333;
                }
                
                .form-control:hover {
                    border-color: #d1d5db;
                }
                
                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .btn--primary {
                    background: #3b82f6;
                    color: white;
                }
                
                .btn--primary:hover {
                    background: #2563eb;
                    transform: translateY(-1px);
                }
                
                .btn--secondary {
                    background: #f3f4f6;
                    color: #374151;
                }
                
                .btn--secondary:hover {
                    background: #e5e7eb;
                }
                
                .btn--block {
                    width: 100%;
                    display: block;
                }
                
                .divider {
                    text-align: center;
                    margin: 20px 0;
                    color: #9ca3af;
                    font-size: 14px;
                }
                
                .error-message {
                    background: #fee;
                    border: 1px solid #fcc;
                    color: #c33;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 20px;
                    font-size: 14px;
                    text-align: center;
                }
                
                .success-message {
                    background: #d1fae5;
                    border: 1px solid #34d399;
                    color: #065f46;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 20px;
                    font-size: 14px;
                    text-align: center;
                }
                
                /* Dark mode support */
                @media (prefers-color-scheme: dark) {
                    .form-control {
                        background: #ffffff;
                        color: #333;
                        border-color: #e5e7eb;
                    }
                    
                    .form-control:focus {
                        color: #333;
                        background: #ffffff;
                    }
                }
            </style>
        `;

    this.attachAuthHandlers();
  }

  /**
   * Attach event handlers
   */
  attachAuthHandlers() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      eventManager.addEventListener(tab, 'click', e => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

        e.target.classList.add('active');
        const targetForm = `${e.target.dataset.tab}-form`;
        document.getElementById(targetForm).classList.add('active');
      });
    });

    // Login
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      eventManager.addEventListener(loginBtn, 'click', () => this.handleLogin());
    }

    // Sign up
    const signupBtn = document.getElementById('signup-btn');
    if (signupBtn) {
      eventManager.addEventListener(signupBtn, 'click', () => this.handleSignup());
    }

    // Magic link
    const magicLinkBtn = document.getElementById('magic-link-btn');
    if (magicLinkBtn) {
      eventManager.addEventListener(magicLinkBtn, 'click', () => this.handleMagicLink());
    }

    // Forgot password
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
      eventManager.addEventListener(forgotPasswordLink, 'click', e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        if (email) {
          this.requestPasswordReset(email).then(result => {
            if (result.success) {
              this.showSuccess(result.message);
            } else {
              this.showError(result.message);
            }
          });
        } else {
          this.showError('Please enter your email address first');
        }
      });
    }

    // Enter key handling
    document.querySelectorAll('input').forEach(input => {
      eventManager.addEventListener(input, 'keypress', e => {
        if (e.key === 'Enter') {
          const activeForm = document.querySelector('.auth-form.active');
          if (activeForm.id === 'login-form') {
            this.handleLogin();
          } else {
            this.handleSignup();
          }
        }
      });
    });
  }

  /**
   * Handle login
   */
  async handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      this.showError('Please enter email and password');
      return;
    }

    try {
      const { data, error } = await this._supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      this.showSuccess('Login successful! Redirecting...');
      // Auth state change will handle the redirect
    } catch (error) {
      this.showError(error.message || 'Login failed');
    }
  }

  /**
   * Handle signup
   */
  async handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (!email || !password) {
      this.showError('Please enter email and password');
      return;
    }

    if (password !== confirm) {
      this.showError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      this.showError('Password must be at least 8 characters');
      return;
    }

    try {
      const { data, error } = await this._supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      this.showSuccess('Account created! Check your email to verify your account.');
    } catch (error) {
      this.showError(error.message || 'Signup failed');
    }
  }

  /**
   * Handle magic link
   */
  async handleMagicLink() {
    const email = document.getElementById('login-email').value;

    if (!email) {
      this.showError('Please enter your email');
      return;
    }

    try {
      const { error } = await this._supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'https://ryokushen-financial.netlify.app',
        },
      });

      if (error) {
        throw error;
      }

      this.showSuccess('Magic link sent! Check your email.');
    } catch (error) {
      this.showError(error.message || 'Failed to send magic link');
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await this._supabase.auth.signOut();
    } catch (error) {
      debug.error('Logout error:', error);
    }
  }

  /**
   * Get current user
   */
  getUser() {
    return this.user;
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.getElementById('auth-error');
    const successDiv = document.getElementById('auth-success');

    if (successDiv) {
      successDiv.style.display = 'none';
    }
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    const errorDiv = document.getElementById('auth-error');
    const successDiv = document.getElementById('auth-success');

    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
    if (successDiv) {
      successDiv.textContent = message;
      successDiv.style.display = 'block';
    }
  }
}

// Export instance
export const supabaseAuth = new SupabaseAuthManager();
