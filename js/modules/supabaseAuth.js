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
            
            // Try to set session immediately
            this.setRecoverySession();
        }
    }

    /**
     * Set recovery session with tokens
     */
    async setRecoverySession() {
        if (!this.resetToken) return;
        
        try {
            debug.log('Setting recovery session with stored tokens...');
            const { data, error } = await this.supabase.auth.setSession({
                access_token: this.resetToken,
                refresh_token: this.refreshToken
            });
            
            if (error) {
                debug.error('Error setting recovery session:', error);
            } else {
                debug.log('Recovery session set successfully');
                this.session = data.session;
                this.user = data.session?.user || null;
            }
        } catch (error) {
            debug.error('Failed to set recovery session:', error);
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
        
        // Get the current Supabase config
        const supabaseUrl = this.supabase.supabaseUrl || 'https://cqhqobwdpwxnxmyuuvnp.supabase.co';
        const supabaseKey = this.supabase.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxaHFvYndkcHd4bnhteXV1dm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1NjA3NzEsImV4cCI6MjA1MjEzNjc3MX0.0Fo9cPA6XJabKHVi4QiJJYNhSre6hRG7RQtqKdKrJro';
        
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
                
                .debug-info {
                    margin-top: 20px;
                    padding: 10px;
                    background: #f3f4f6;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: monospace;
                    color: #666;
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
                    
                    <div id="debug-info" class="debug-info" style="display: none;">
                        <strong>Debug Info:</strong><br>
                        <span id="debug-content"></span>
                    </div>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
            <script>
                // Initialize everything in the page context
                (async function() {
                    console.log('Password reset form loaded');
                    
                    // Show debug info
                    const debugDiv = document.getElementById('debug-info');
                    const debugContent = document.getElementById('debug-content');
                    
                    // Re-initialize Supabase client with the config
                    const supabaseUrl = '${supabaseUrl}';
                    const supabaseKey = '${supabaseKey}';
                    
                    // Create client
                    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
                        auth: {
                            autoRefreshToken: false,
                            persistSession: false
                        }
                    });
                    console.log('Supabase client created');
                    
                    // Extract tokens from URL - check both hash and query params
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const queryParams = new URLSearchParams(window.location.search);
                    
                    let accessToken = hashParams.get('access_token') || queryParams.get('access_token') || '${tokens.access || ''}';
                    let refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token') || '${tokens.refresh || ''}';
                    
                    // Clean up tokens - remove any 'null' strings
                    if (accessToken === 'null' || accessToken === '') accessToken = null;
                    if (refreshToken === 'null' || refreshToken === '') refreshToken = null;
                    
                    console.log('Access token found:', !!accessToken);
                    console.log('Refresh token found:', !!refreshToken);
                    console.log('Token length:', accessToken ? accessToken.length : 0);
                    
                    // Update debug info
                    debugContent.innerHTML = 'Token found: ' + (accessToken ? 'Yes (' + accessToken.length + ' chars)' : 'No') + '<br>' +
                                           'URL: ' + window.location.href.substring(0, 50) + '...';
                    
                    // Global session variable
                    let currentSession = null;
                    
                    // Set the session with the recovery token
                    async function setupSession() {
                        if (!accessToken || accessToken === 'null' || accessToken === '') {
                            console.error('No access token found');
                            showError('No recovery token found. Please use the link from your email.');
                            debugContent.innerHTML += '<br>No token in URL';
                            debugDiv.style.display = 'block';
                            return false;
                        }
                        
                        try {
                            console.log('Attempting to exchange recovery token for session...');
                            
                            // First, try to exchange the recovery token for a session
                            const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(accessToken);
                            
                            if (sessionError) {
                                console.error('Session exchange error:', sessionError);
                                
                                // Fallback: try setting session directly
                                console.log('Trying direct session set...');
                                const { data, error } = await supabase.auth.setSession({
                                    access_token: accessToken,
                                    refresh_token: refreshToken || undefined
                                });
                                
                                if (error) {
                                    throw error;
                                }
                                
                                currentSession = data.session;
                            } else {
                                currentSession = sessionData.session;
                                console.log('Session exchanged successfully');
                            }
                            
                            // Verify the session
                            const { data: { user }, error: userError } = await supabase.auth.getUser();
                            if (userError) {
                                throw userError;
                            }
                            
                            if (user) {
                                console.log('User verified:', user.email);
                                debugContent.innerHTML += '<br>User: ' + user.email;
                                return true;
                            } else {
                                throw new Error('No user in session');
                            }
                        } catch (err) {
                            console.error('Failed to set up session:', err);
                            
                            let errorMessage = err.message || 'Failed to initialize password reset session';
                            
                            // Provide more helpful error messages
                            if (errorMessage.includes('Invalid token') || errorMessage.includes('JWT')) {
                                errorMessage = 'This password reset link has expired or already been used. Please request a new one.';
                            } else if (errorMessage.includes('Network')) {
                                errorMessage = 'Network error. Please check your connection and try again.';
                            }
                            
                            showError(errorMessage);
                            debugContent.innerHTML += '<br>Error: ' + err.message;
                            debugDiv.style.display = 'block';
                            return false;
                        }
                    }
                    
                    // Call setup session immediately
                    const sessionReady = await setupSession();
                    
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
                            // Check if session is ready
                            if (!currentSession && !sessionReady) {
                                console.log('No session, attempting to set it again...');
                                const success = await setupSession();
                                if (!success) {
                                    throw new Error('Could not establish session. Please request a new password reset link.');
                                }
                            }
                            
                            console.log('Attempting password update...');
                            
                            // Update the password
                            const { data, error } = await supabase.auth.updateUser({
                                password: newPassword
                            });
                            
                            if (error) {
                                console.error('Password update error:', error);
                                throw error;
                            }
                            
                            console.log('Password updated successfully');
                            showSuccess('Password updated successfully! Redirecting to login...');
                            
                            // Sign out to clear the session
                            await supabase.auth.signOut();
                            
                            // Clear the URL parameters and redirect
                            setTimeout(() => {
                                window.location.href = window.location.origin + window.location.pathname;
                            }, 2000);
                            
                        } catch (error) {
                            console.error('Password update error:', error);
                            console.error('Error stack:', error.stack);
                            
                            let errorMessage = error.message || 'Failed to update password';
                            
                            // Check for specific error types
                            if (errorMessage.includes('fetch')) {
                                errorMessage = 'Network error. Please check your connection and try again.';
                            } else if (errorMessage.includes('JWT') || errorMessage.includes('token')) {
                                errorMessage = 'Session expired. Please request a new password reset link.';
                            } else if (errorMessage.includes('not authenticated')) {
                                errorMessage = 'Authentication failed. Please request a new password reset link.';
                            }
                            
                            showError(errorMessage);
                            debugContent.innerHTML += '<br>Update error: ' + error.message;
                            debugDiv.style.display = 'block';
                            
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
                    
                    // Show debug info if there's an issue
                    if (!sessionReady) {
                        debugDiv.style.display = 'block';
                    }
                })();
            </script>
        </body>
        </html>
        `;
    }

    // ... rest of the methods remain the same ...