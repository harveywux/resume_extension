// Authentication utilities for HiHired Extension

const API_BASE_URL = 'https://hihired.org';

export class AuthManager {
  // Check if user is authenticated
  static async isAuthenticated() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (response) => {
        resolve(response?.authenticated || false);
      });
    });
  }

  // Get current user info
  static async getUser() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (response) => {
        resolve(response?.user || null);
      });
    });
  }

  // Login with email and password
  static async login(email, password) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'LOGIN', email, password },
        (response) => {
          if (response?.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || 'Login failed'));
          }
        }
      );
    });
  }

  // Logout
  static async logout() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'LOGOUT' }, (response) => {
        resolve(response?.success || false);
      });
    });
  }

  // Get auth token (for direct API calls)
  static async getToken() {
    const session = await chrome.storage.session.get('authToken');
    return session.authToken;
  }

  // Check if token is expired
  static async isTokenExpired() {
    const session = await chrome.storage.session.get(['authToken', 'loginTime']);

    if (!session.authToken) return true;

    const tokenAge = Date.now() - (session.loginTime || 0);
    const maxAge = 23 * 60 * 60 * 1000; // 23 hours

    return tokenAge > maxAge;
  }
}

export default AuthManager;
