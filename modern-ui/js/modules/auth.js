// Authentication Module

import { STORAGE_KEYS } from '../config.js'
import { showLoading, hideLoading, showError, showSuccess } from './ui.js'
import getSupabaseClient from '../supabase-client.js'

// Initialize Supabase client
export function initSupabase() {
  return getSupabaseClient()
}

// Check authentication status
export async function checkAuthStatus() {
  try {
    const supabase = initSupabase()
    if (!supabase) {
      throw new Error('Supabase not initialized')
    }
    
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error('Auth check failed:', error)
    return null
  }
}

// Show authentication screen
export function showAuthScreen() {
  const authModal = document.getElementById('auth-modal')
  if (!authModal) return
  
  authModal.style.display = 'flex'
  authModal.classList.add('animate-fadeIn')
  
  // Initialize with login form
  showLoginForm()
}

// Show login form
function showLoginForm() {
  const authContent = document.getElementById('auth-content')
  if (!authContent) return
  
  authContent.innerHTML = `
    <form id="login-form" class="auth-form">
      <div class="form-group">
        <label for="login-email">Email</label>
        <input 
          type="email" 
          id="login-email" 
          class="input-glass" 
          placeholder="your@email.com"
          required
          autocomplete="email"
        >
      </div>
      
      <div class="form-group">
        <label for="login-password">Password</label>
        <input 
          type="password" 
          id="login-password" 
          class="input-glass" 
          placeholder="••••••••"
          required
          autocomplete="current-password"
        >
      </div>
      
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="remember-me">
          <span>Remember me</span>
        </label>
      </div>
      
      <button type="submit" class="btn btn-primary w-full">
        Sign In
      </button>
      
      <div class="auth-links">
        <a href="#" id="forgot-password-link">Forgot password?</a>
        <span>•</span>
        <a href="#" id="signup-link">Create account</a>
      </div>
    </form>
  `
  
  // Add styles
  addAuthStyles()
  
  // Setup event listeners
  const loginForm = document.getElementById('login-form')
  const signupLink = document.getElementById('signup-link')
  const forgotLink = document.getElementById('forgot-password-link')
  
  loginForm.addEventListener('submit', handleLogin)
  signupLink.addEventListener('click', (e) => {
    e.preventDefault()
    showSignupForm()
  })
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault()
    showForgotPasswordForm()
  })
  
  // Set remembered email if available
  if (window.rememberedEmail) {
    const emailInput = document.getElementById('login-email')
    const rememberCheckbox = document.getElementById('remember-me')
    if (emailInput) {
      emailInput.value = window.rememberedEmail
    }
    if (rememberCheckbox) {
      rememberCheckbox.checked = true
    }
  }
}

// Show signup form
function showSignupForm() {
  const authContent = document.getElementById('auth-content')
  if (!authContent) return
  
  authContent.innerHTML = `
    <form id="signup-form" class="auth-form">
      <div class="form-group">
        <label for="signup-email">Email</label>
        <input 
          type="email" 
          id="signup-email" 
          class="input-glass" 
          placeholder="your@email.com"
          required
          autocomplete="email"
        >
      </div>
      
      <div class="form-group">
        <label for="signup-password">Password</label>
        <input 
          type="password" 
          id="signup-password" 
          class="input-glass" 
          placeholder="••••••••"
          required
          autocomplete="new-password"
          minlength="8"
        >
        <small class="form-hint">Minimum 8 characters</small>
      </div>
      
      <div class="form-group">
        <label for="signup-confirm">Confirm Password</label>
        <input 
          type="password" 
          id="signup-confirm" 
          class="input-glass" 
          placeholder="••••••••"
          required
          autocomplete="new-password"
        >
      </div>
      
      <button type="submit" class="btn btn-primary w-full">
        Create Account
      </button>
      
      <div class="auth-links">
        <span>Already have an account?</span>
        <a href="#" id="login-link">Sign in</a>
      </div>
    </form>
  `
  
  // Setup event listeners
  const signupForm = document.getElementById('signup-form')
  const loginLink = document.getElementById('login-link')
  
  signupForm.addEventListener('submit', handleSignup)
  loginLink.addEventListener('click', (e) => {
    e.preventDefault()
    showLoginForm()
  })
}

// Show forgot password form
function showForgotPasswordForm() {
  const authContent = document.getElementById('auth-content')
  if (!authContent) return
  
  authContent.innerHTML = `
    <form id="forgot-form" class="auth-form">
      <div class="form-info">
        <p>Enter your email address and we'll send you a link to reset your password.</p>
      </div>
      
      <div class="form-group">
        <label for="forgot-email">Email</label>
        <input 
          type="email" 
          id="forgot-email" 
          class="input-glass" 
          placeholder="your@email.com"
          required
          autocomplete="email"
        >
      </div>
      
      <button type="submit" class="btn btn-primary w-full">
        Send Reset Link
      </button>
      
      <div class="auth-links">
        <a href="#" id="back-login-link">Back to login</a>
      </div>
    </form>
  `
  
  // Setup event listeners
  const forgotForm = document.getElementById('forgot-form')
  const backLink = document.getElementById('back-login-link')
  
  forgotForm.addEventListener('submit', handleForgotPassword)
  backLink.addEventListener('click', (e) => {
    e.preventDefault()
    showLoginForm()
  })
}

// Handle login
async function handleLogin(e) {
  e.preventDefault()
  
  const email = document.getElementById('login-email').value
  const password = document.getElementById('login-password').value
  const rememberMe = document.getElementById('remember-me').checked
  
  try {
    showLoading('Signing in...')
    
    const supabase = initSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    
    // Store remember me preference
    if (rememberMe) {
      localStorage.setItem('ryokushen_remember_email', email)
    } else {
      localStorage.removeItem('ryokushen_remember_email')
    }
    
    hideLoading()
    showSuccess('Login successful!')
    
    // Auth state change listener will handle the transition
    
  } catch (error) {
    hideLoading()
    showError(error.message || 'Login failed. Please try again.')
  }
}

// Handle signup
async function handleSignup(e) {
  e.preventDefault()
  
  const email = document.getElementById('signup-email').value
  const password = document.getElementById('signup-password').value
  const confirmPassword = document.getElementById('signup-confirm').value
  
  // Validate passwords match
  if (password !== confirmPassword) {
    showError('Passwords do not match')
    return
  }
  
  // Validate password strength
  if (password.length < 8) {
    showError('Password must be at least 8 characters')
    return
  }
  
  try {
    showLoading('Creating account...')
    
    const supabase = initSupabase()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) throw error
    
    hideLoading()
    
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      showError('An account with this email already exists.')
      return
    }
    
    showSuccess('Account created! Please check your email to verify your account.')
    
    // Create default categories for new user
    if (data.user) {
      try {
        const { createDefaultCategoriesForUser } = await import('./database.js')
        await createDefaultCategoriesForUser(data.user.id)
      } catch (error) {
        console.error('Failed to create default categories:', error)
      }
    }
    
    // Show login form
    setTimeout(() => {
      showLoginForm()
    }, 2000)
    
  } catch (error) {
    hideLoading()
    showError(error.message || 'Signup failed. Please try again.')
  }
}

// Handle forgot password
async function handleForgotPassword(e) {
  e.preventDefault()
  
  const email = document.getElementById('forgot-email').value
  
  try {
    showLoading('Sending reset link...')
    
    const supabase = initSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    
    if (error) throw error
    
    hideLoading()
    showSuccess('Password reset link sent! Check your email.')
    
    // Show login form after delay
    setTimeout(() => {
      showLoginForm()
    }, 3000)
    
  } catch (error) {
    hideLoading()
    showError(error.message || 'Failed to send reset link. Please try again.')
  }
}

// Sign out
export async function signOut() {
  try {
    const supabase = initSupabase()
    const { error } = await supabase.auth.signOut()
    
    if (error) throw error
    
    // Clear local storage
    localStorage.removeItem(STORAGE_KEYS.theme)
    localStorage.removeItem(STORAGE_KEYS.privacyMode)
    localStorage.removeItem(STORAGE_KEYS.preferences)
    
    return true
  } catch (error) {
    console.error('Logout failed:', error)
    throw error
  }
}

// Get current user
export function getCurrentUser() {
  const supabase = initSupabase()
  return supabase?.auth.getUser()
}

// Add auth styles
function addAuthStyles() {
  if (document.getElementById('auth-styles')) return
  
  const style = document.createElement('style')
  style.id = 'auth-styles'
  style.textContent = `
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .form-group label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
    }
    
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 0.875rem;
    }
    
    .checkbox-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    
    .form-hint {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }
    
    .form-info {
      padding: 16px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 8px;
    }
    
    .form-info p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
    
    .auth-links {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
    
    .auth-links a {
      color: var(--color-primary);
      text-decoration: none;
      transition: color 0.2s;
    }
    
    .auth-links a:hover {
      color: var(--color-primary-light);
      text-decoration: underline;
    }
    
    .btn.w-full {
      width: 100%;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
    }
    
    .btn-primary:active {
      transform: translateY(0);
    }
  `
  
  document.head.appendChild(style)
}

// Initialize auth listeners
export function initAuth() {
  const supabase = initSupabase()
  
  // Listen for auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session?.user?.email)
    
    if (event === 'SIGNED_IN' && session) {
      // User signed in - update app state instead of reloading
      if (window.appState) {
        window.appState.user = session.user
        
        // Hide auth modal
        const authModal = document.getElementById('auth-modal')
        if (authModal) {
          authModal.style.display = 'none'
        }
        
        // Re-initialize app with authenticated user
        const { default: initializeApp } = await import('../app.js')
        if (initializeApp.continueWithUser) {
          await initializeApp.continueWithUser(session.user)
        } else {
          // Fallback to reload if function not available
          window.location.reload()
        }
      } else {
        window.location.reload()
      }
    } else if (event === 'SIGNED_OUT') {
      // User signed out - show auth screen
      if (window.appState) {
        window.appState.user = null
        window.appState.data = {
          transactions: [],
          cashAccounts: [],
          investmentAccounts: [],
          debtAccounts: [],
          recurringBills: [],
          savingsGoals: [],
          smartRules: [],
        }
      }
      
      // Clear local storage
      localStorage.removeItem(STORAGE_KEYS.theme)
      localStorage.removeItem(STORAGE_KEYS.privacyMode)
      localStorage.removeItem(STORAGE_KEYS.preferences)
      
      // Show auth screen
      const authModal = document.getElementById('auth-modal')
      if (authModal) {
        authModal.style.display = 'flex'
        showLoginForm()
      } else {
        window.location.reload()
      }
    } else if (event === 'TOKEN_REFRESHED') {
      // Token refreshed
      console.log('Token refreshed successfully')
    } else if (event === 'USER_UPDATED') {
      // User data updated
      if (session && window.appState) {
        window.appState.user = session.user
      }
    }
  })
  
  // Check for remembered email
  const rememberedEmail = localStorage.getItem('ryokushen_remember_email')
  if (rememberedEmail) {
    // Will be set when login form is shown
    window.rememberedEmail = rememberedEmail
  }
}