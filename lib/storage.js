// Storage utilities for HiHired Extension

export class StorageManager {
  // Session storage (cleared when browser closes) - for sensitive data
  static async setToken(token) {
    await chrome.storage.session.set({ authToken: token });
  }

  static async getToken() {
    const result = await chrome.storage.session.get('authToken');
    return result.authToken;
  }

  static async setUser(user) {
    await chrome.storage.session.set({ user });
  }

  static async getUser() {
    const result = await chrome.storage.session.get('user');
    return result.user;
  }

  static async setLoginTime(time) {
    await chrome.storage.session.set({ loginTime: time });
  }

  static async getLoginTime() {
    const result = await chrome.storage.session.get('loginTime');
    return result.loginTime;
  }

  static async clearSession() {
    await chrome.storage.session.clear();
  }

  // Local storage (persists) - for cached resume data and preferences
  static async setCachedResume(data) {
    await chrome.storage.local.set({
      resumeData: data,
      resumeCacheTime: Date.now()
    });
  }

  static async getCachedResume() {
    const result = await chrome.storage.local.get(['resumeData', 'resumeCacheTime']);
    const cacheMaxAge = 30 * 60 * 1000; // 30 minutes

    if (result.resumeData && result.resumeCacheTime) {
      const age = Date.now() - result.resumeCacheTime;
      if (age < cacheMaxAge) {
        return { data: result.resumeData, valid: true, age };
      }
    }
    return { data: result.resumeData, valid: false, age: null };
  }

  static async clearResumeCache() {
    await chrome.storage.local.remove(['resumeData', 'resumeCacheTime']);
  }

  // User preferences
  static async setPreferences(prefs) {
    await chrome.storage.local.set({ preferences: prefs });
  }

  static async getPreferences() {
    const result = await chrome.storage.local.get('preferences');
    return result.preferences || {
      autoDetectForms: true,
      highlightFilledFields: true,
      showConfirmation: false
    };
  }

  static async updatePreference(key, value) {
    const prefs = await this.getPreferences();
    prefs[key] = value;
    await this.setPreferences(prefs);
    return prefs;
  }
}

export default StorageManager;
