// js/modules/supabaseAuth.js - Supabase Authentication Module
import { debug } from './debug.js';

class SupabaseAuthManager {
    constructor() {
        this.user = null;
        this.session = null;
        this.supabase = window.supabaseClient;
        this.isResettingPassword = false;
        this.resetToken = null;
        this.refreshToken = null;
        
        // Store tokens globally for password reset
        window.passwordResetTokens = {
            access: null,
            refresh: null
        };
        
        // Check for password reset immediately
        this.checkForPasswordReset();
        
        this.initializeAuth();
    }

    /**
     * Check for password reset tokens immediately
     */
    checkForPasswordReset() {
        // Get the full URL
        const fullUrl = window.location.href;
        debug.log('Checking for password reset. Full URL:', fullUrl);
        
        // Check multiple possible parameter locations
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        
        // Extract tokens from all possible locations
        let accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        let refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        let type = hashParams.get('type') || queryParams.get('type');
        
        // Also check for encoded parameters in the URL
        if (!accessToken && fullUrl.includes('access_token')) {
            // Try to extract from URL even if encoding is messed up
            const match = fullUrl.match(/access_token=([^&]+)/);
            if (match) accessToken = decodeURIComponent(match[1]);
        }
        
        if (!type && fullUrl.includes('type')) {
            const match = fullUrl.match(/type=([^&]+)/);
            if (match) type = decodeURIComponent(match[1]);
        }
        
        debug.log('Extracted tokens:', {
            accessToken: accessToken ? 'found' : 'not found',
            refreshToken: refreshToken ? 'found' : 'not found',
            type: type
        });
        
        // Set password reset mode if recovery token is found
        if (type === 'recovery' && accessToken) {
            this.isResettingPassword = true;
            this.resetToken = accessToken;
            this.refreshToken = refreshToken;
            
            // Store tokens globally
            window.passwordResetTokens = {
                access: accessToken,
                refresh: refreshToken
            };
            
            debug.log('PASSWORD RESET MODE ACTIVATED!');
            debug.log('Access token found:', true);
            debug.log('Refresh token found:', !!refreshToken);
        }
    }

    /**
     * Initialize authentication state
     */
    async initializeAuth() {
        try {
            // Skip normal auth flow if in password reset mode
            if (this.isResettingPassword) {
                debug.log('Skipping normal auth flow - password reset mode active');
                return;
            }
            
            // Get initial session for normal auth flow
            const { data: { session } } = await this.supabase.auth.getSession();
            this.session = session;
            this.user = session?.user || null;

            // Listen for auth changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                debug.log('Auth state change:', event);
                this.session = session;
                this.user = session?.user || null;
                
                if (event === 'SIGNED_OUT') {
                    // Redirect to login
                    window.location.reload();
                } else if (event === 'SIGNED_IN' && !this.isResettingPassword) {
                    // Reload to show app (but not during password reset)
                    window.location.reload();
                } else if (event === 'PASSWORD_RECOVERY') {
                    // Handle password recovery event
                    this.isResettingPassword = true;
                    debug.log('PASSWORD_RECOVERY event detected');
                }
            });
        } catch (error) {
            debug.error('Failed to initialize auth:', error);
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        // If we're resetting password, treat as not authenticated
        if (this.isResettingPassword) {
            return false;
        }
        return !!this.session;
    }

    /**
     * Check if we should show password reset form instead of login
     */
    shouldShowPasswordReset() {
        return this.isResettingPassword;
    }

    /**
     * Show password reset form
     */
    showPasswordResetForm() {
        debug.log('Showing password reset form');
        
        // Store current tokens in a more persistent way
        const tokens = {
            access: this.resetToken,
            refresh: this.refreshToken
        };
        
        // Clear the entire page and show only the reset form
        document.documentElement.innerHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Password - Ryokushen Financial</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #333;
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
                }
                
                .form-control:focus {
                    outline: none;
                    border-color: #3b82f6;
                }
                
                .password-strength {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 8px;
                }
                
                .strength-icon {
                    width: 20px;
                    height: 20px;
                    display: inline-block;
                }
                
                .btn {
                    width: 100%;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: #3b82f6;
                    color: white;
                }
                
                .btn:hover {
                    background: #2563eb;
                    transform: translateY(-1px);
                }
                
                .btn:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                    transform: none;
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
                    display: none;
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
                    display: none;
                }
                
                .back-link {
                    margin-top: 20px;
                    text-align: center;
                }
                
                .back-link a {
                    color: #3b82f6;
                    text-decoration: none;
                    font-size: 14px;
                }
                
                .back-link a:hover {
                    text-decoration: underline;
                }
            </style>
        </head>
        <body>
            <div class="auth-container">
                <div class="auth-box">
                    <h1>Reset Your Password</h1>
                    <h2>Enter your new password below</h2>
                    
                    <form id="reset-form">
                        <div class="form-group">
                            <label for="new-password">New Password</label>
                            <input type="password" id="new-password" class="form-control" 
                                   placeholder="Enter new password" required minlength="8">
                            <div class="password-strength">
                                <span class="strength-icon">🔒</span>
                                <small style="color: #666;">Minimum 8 characters</small>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="confirm-password">Confirm Password</label>
                            <input type="password" id="confirm-password" class="form-control" 
                                   placeholder="Confirm new password" required minlength="8">
                        </div>
                        
                        <button type="submit" id="reset-password-btn" class="btn">
                            Update Password
                        </button>
                    </form>
                    
                    <div class="back-link">
                        <a href="#" id="back-to-login">Back to Login</a>
                    </div>
                    
                    <div id="auth-error" class="error-message"></div>
                    <div id="auth-success" class="success-message"></div>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
            <script>
                // Initialize everything in the page context
                (function() {
                    console.log('Password reset detected - intercepting page load');
                    
                    // Re-initialize Supabase client
                    const supabaseUrl = 'https://cqhqobwdpwxnxmyuuvnp.supabase.co';
                    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxaHFvYndkcHd4bnhteXV1dm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1NjA3NzEsImV4cCI6MjA1MjEzNjc3MX0.0Fo9cPA6XJabKHVi4QiJJYNhSre6hRG7RQtqKdKrJro';
                    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
                    
                    // Extract tokens from URL
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const queryParams = new URLSearchParams(window.location.search);
                    
                    const accessToken = hashParams.get('access_token') || queryParams.get('access_token') || '${tokens.access || ''}';
                    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token') || '${tokens.refresh || ''}';
                    
                    console.log('Access token found:', !!accessToken);
                    console.log('Refresh token found:', !!refreshToken);
                    
                    // Set the session with the recovery token
                    async function setupSession() {
                        if (accessToken) {
                            try {
                                const { data, error } = await supabase.auth.setSession({
                                    access_token: accessToken,
                                    refresh_token: refreshToken
                                });
                                
                                if (error) {
                                    console.error('Error setting session:', error);
                                    showError('Session setup failed: ' + error.message);
                                } else {
                                    console.log('Session set successfully');
                                }
                            } catch (err) {
                                console.error('Failed to set session:', err);
                                showError('Failed to initialize password reset session');
                            }
                        }
                    }
                    
                    // Call setup session immediately
                    setupSession();
                    
                    // Form submission handler
                    document.getElementById('reset-form').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        
                        const newPassword = document.getElementById('new-password').value;
                        const confirmPassword = document.getElementById('confirm-password').value;
                        const button = document.getElementById('reset-password-btn');
                        
                        if (!newPassword || !confirmPassword) {
                            showError('Please fill in both password fields');
                            return;
                        }
                        
                        if (newPassword !== confirmPassword) {
                            showError('Passwords do not match');
                            return;
                        }
                        
                        if (newPassword.length < 8) {
                            showError('Password must be at least 8 characters');
                            return;
                        }
                        
                        // Disable button while processing
                        button.disabled = true;
                        button.textContent = 'Updating...';
                        
                        try {
                            // Ensure session is set before updating
                            await setupSession();
                            
                            // Update the password
                            const { data, error } = await supabase.auth.updateUser({
                                password: newPassword
                            });
                            
                            if (error) {
                                throw error;
                            }
                            
                            showSuccess('Password updated successfully! Redirecting to login...');
                            
                            // Clear the URL parameters and redirect
                            setTimeout(() => {
                                window.location.href = window.location.origin + window.location.pathname;
                            }, 2000);
                            
                        } catch (error) {
                            console.error('Password update error:', error);
                            showError(error.message || 'Failed to update password. Please try again.');
                            button.disabled = false;
                            button.textContent = 'Update Password';
                        }
                    });
                    
                    // Back to login handler
                    document.getElementById('back-to-login').addEventListener('click', (e) => {
                        e.preventDefault();
                        window.location.href = window.location.origin + window.location.pathname;
                    });
                    
                    // Helper functions
                    function showError(message) {
                        const errorDiv = document.getElementById('auth-error');
                        const successDiv = document.getElementById('auth-success');
                        
                        if (successDiv) successDiv.style.display = 'none';
                        if (errorDiv) {
                            errorDiv.textContent = message;
                            errorDiv.style.display = 'block';
                        }
                    }
                    
                    function showSuccess(message) {
                        const errorDiv = document.getElementById('auth-error');
                        const successDiv = document.getElementById('auth-success');
                        
                        if (errorDiv) errorDiv.style.display = 'none';
                        if (successDiv) {
                            successDiv.textContent = message;
                            successDiv.style.display = 'block';
                        }
                    }
                    
                    // Focus on first input
                    document.getElementById('new-password').focus();
                })();
            </script>
        </body>
        </html>
        `;
    }

    /**
     * Update password
     */
    async updatePassword() {
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const button = document.getElementById('reset-password-btn');
        
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
        
        // Disable button while processing
        button.disabled = true;
        button.textContent = 'Updating...';
        
        try {
            const { error } = await window.supabaseClient.auth.updateUser({
                password: newPassword
            });
            
            if (error) throw error;
            
            this.showSuccess('Password updated successfully! Redirecting to login...');
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = window.location.origin;
            }, 2000);
            
        } catch (error) {
            this.showError(error.message || 'Failed to update password');
            button.disabled = false;
            button.textContent = 'Update Password';
        }
    }

    /**
     * Request password reset email
     */
    async requestPasswordReset(email) {
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });
            
            if (error) throw error;
            
            return { success: true, message: 'Password reset email sent! Check your inbox.' };
        } catch (error) {
            return { success: false, message: error.message || 'Failed to send reset email' };
        }
    }

    /**
     * Show login screen
     */
    showAuthScreen() {
        // Double-check if we should show password reset instead
        if (this.shouldShowPasswordReset()) {
            this.showPasswordResetForm();
            return;
        }
        
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
                            <label for="login-email">Email</label>
                            <input type="email" id="login-email" class="form-control" 
                                   placeholder="your@email.com" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="login-password">Password</label>
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
                            <label for="signup-email">Email</label>
                            <input type="email" id="signup-email" class="form-control" 
                                   placeholder="your@email.com" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="signup-password">Password</label>
                            <input type="password" id="signup-password" class="form-control" 
                                   placeholder="Choose a strong password" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="signup-confirm">Confirm Password</label>
                            <input type="password" id="signup-confirm" class="form-control" 
                                   placeholder="Confirm your password" required>
                        </div>
                        
                        <button id="signup-btn" class="btn btn--primary btn--block">
                            Create Account
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
                }
                
                .form-control:focus {
                    outline: none;
                    border-color: #3b82f6;
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
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                
                e.target.classList.add('active');
                const targetForm = e.target.dataset.tab + '-form';
                document.getElementById(targetForm).classList.add('active');
            });
        });

        // Login
        document.getElementById('login-btn').addEventListener('click', () => this.handleLogin());
        
        // Sign up
        document.getElementById('signup-btn').addEventListener('click', () => this.handleSignup());
        
        // Magic link
        document.getElementById('magic-link-btn').addEventListener('click', () => this.handleMagicLink());
        
        // Forgot password
        document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
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
        
        // Enter key handling
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('keypress', (e) => {
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
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
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
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });
            
            if (error) throw error;
            
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
            const { error } = await this.supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });
            
            if (error) throw error;
            
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
            await this.supabase.auth.signOut();
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
        
        if (successDiv) successDiv.style.display = 'none';
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
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
        }
    }
}

// Export instance
export const supabaseAuth = new SupabaseAuthManager();