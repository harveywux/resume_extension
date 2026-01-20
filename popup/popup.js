// HiHired Extension - Popup Script

// DOM Elements
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const fillNowBtn = document.getElementById('fill-now-btn');
const loadingOverlay = document.getElementById('loading');

// User display elements
const userInitial = document.getElementById('user-initial');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');

// Resume display elements
const statusDot = document.querySelector('.status-dot');
const statusText = document.getElementById('status-text');
const previewName = document.getElementById('preview-name');
const previewEmail = document.getElementById('preview-email');
const previewLocation = document.getElementById('preview-location');

// Settings elements
const autoDetectCheckbox = document.getElementById('auto-detect');
const highlightFieldsCheckbox = document.getElementById('highlight-fields');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthAndLoadData();
  await loadSettings();
});

// Check authentication and load data
async function checkAuthAndLoadData() {
  showLoading(true);

  try {
    const response = await sendMessage({ type: 'CHECK_AUTH' });

    if (response.authenticated) {
      showMainView(response.user);
      await loadResumeData();
    } else {
      showLoginView();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLoginView();
  } finally {
    showLoading(false);
  }
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

// Show/hide loading overlay
function showLoading(show) {
  loadingOverlay.classList.toggle('hidden', !show);
}

// Show login view
function showLoginView() {
  loginView.classList.remove('hidden');
  mainView.classList.add('hidden');
  loginError.classList.add('hidden');
}

// Show main view
function showMainView(user) {
  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');

  // Update user display
  if (user) {
    const name = user.name || user.email?.split('@')[0] || 'User';
    userName.textContent = name;
    userEmail.textContent = user.email || '';
    userInitial.textContent = name.charAt(0).toUpperCase();
  }
}

// Load resume data
async function loadResumeData() {
  updateStatus('loading', 'Loading...');

  try {
    const response = await sendMessage({ type: 'GET_RESUME_DATA' });

    if (response.success && response.data) {
      const data = response.data;

      // Update preview
      previewName.textContent = data.name || 'No name set';
      previewEmail.textContent = data.email || 'No email set';
      previewLocation.textContent = data.location || 'No location set';

      // Update status
      const cacheNote = response.fromCache ? ' (cached)' : '';
      updateStatus('success', `Synced${cacheNote}`);
    } else {
      updateStatus('warning', 'No resume data found');
      previewName.textContent = '-';
      previewEmail.textContent = '-';
      previewLocation.textContent = '-';
    }
  } catch (error) {
    console.error('Failed to load resume data:', error);
    updateStatus('error', 'Failed to load');
  }
}

// Update status indicator
function updateStatus(type, text) {
  statusDot.className = 'status-dot';
  if (type) {
    statusDot.classList.add(type);
  }
  statusText.textContent = text;
}

// Load settings
async function loadSettings() {
  const result = await chrome.storage.local.get('preferences');
  const prefs = result.preferences || {
    autoDetectForms: true,
    highlightFilledFields: true
  };

  autoDetectCheckbox.checked = prefs.autoDetectForms !== false;
  highlightFieldsCheckbox.checked = prefs.highlightFilledFields !== false;
}

// Save settings
async function saveSettings() {
  const prefs = {
    autoDetectForms: autoDetectCheckbox.checked,
    highlightFilledFields: highlightFieldsCheckbox.checked
  };
  await chrome.storage.local.set({ preferences: prefs });
}

// Login form handler
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  // Show loading state
  loginBtn.disabled = true;
  loginBtn.querySelector('.btn-text').classList.add('hidden');
  loginBtn.querySelector('.btn-loading').classList.remove('hidden');
  loginError.classList.add('hidden');

  try {
    const response = await sendMessage({ type: 'LOGIN', email, password });

    if (response.success) {
      showMainView(response.user);
      await loadResumeData();
    } else {
      showError(response.error || 'Login failed. Please try again.');
    }
  } catch (error) {
    showError('Connection error. Please try again.');
  } finally {
    // Reset button state
    loginBtn.disabled = false;
    loginBtn.querySelector('.btn-text').classList.remove('hidden');
    loginBtn.querySelector('.btn-loading').classList.add('hidden');
  }
});

// Show error message
function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

// Logout handler
logoutBtn.addEventListener('click', async () => {
  await sendMessage({ type: 'LOGOUT' });
  showLoginView();

  // Clear form
  document.getElementById('email').value = '';
  document.getElementById('password').value = '';
});

// Refresh handler
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.style.opacity = '0.5';

  try {
    await sendMessage({ type: 'REFRESH_CACHE' });
    await loadResumeData();
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.style.opacity = '1';
  }
});

// Fill Now handler
fillNowBtn.addEventListener('click', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    alert('No active tab found');
    return;
  }

  // Send message to content script to trigger fill
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTOFILL' });
    window.close(); // Close popup after triggering
  } catch (error) {
    // Content script might not be loaded on this page
    alert('Auto-fill is not available on this page. Navigate to a job application form first.');
  }
});

// Settings change handlers
autoDetectCheckbox.addEventListener('change', saveSettings);
highlightFieldsCheckbox.addEventListener('change', saveSettings);

// Google login handler
googleLoginBtn.addEventListener('click', async () => {
  // Show loading state
  googleLoginBtn.disabled = true;
  googleLoginBtn.querySelector('.btn-text').classList.add('hidden');
  googleLoginBtn.querySelector('.btn-loading').classList.remove('hidden');
  loginError.classList.add('hidden');

  try {
    const response = await sendMessage({ type: 'GOOGLE_LOGIN' });

    if (response.success) {
      showMainView(response.user);
      await loadResumeData();
    } else {
      showError(response.error || 'Google login failed. Please try again.');
    }
  } catch (error) {
    showError('Connection error. Please try again.');
  } finally {
    // Reset button state
    googleLoginBtn.disabled = false;
    googleLoginBtn.querySelector('.btn-text').classList.remove('hidden');
    googleLoginBtn.querySelector('.btn-loading').classList.add('hidden');
  }
});
