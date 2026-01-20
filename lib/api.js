// API client for HiHired Extension

const API_BASE_URL = 'https://hihired.org';

export class HiHiredAPI {
  // Make API request through background script (avoids CORS issues)
  static async request(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'API_REQUEST',
          endpoint,
          options
        },
        (response) => {
          if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'API request failed'));
          }
        }
      );
    });
  }

  // Get resume data (uses caching)
  static async getResumeData(forceRefresh = false) {
    return new Promise((resolve, reject) => {
      const messageType = forceRefresh ? 'REFRESH_CACHE' : 'GET_RESUME_DATA';

      chrome.runtime.sendMessage({ type: messageType }, (response) => {
        if (response?.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Failed to get resume data'));
        }
      });
    });
  }

  // Get user profile
  static async getUserProfile() {
    return this.request('/api/user/profile', { method: 'GET' });
  }

  // Get subscription overview
  static async getSubscriptionOverview() {
    return this.request('/api/subscription/overview', { method: 'GET' });
  }

  // Get resume history (for PDF download)
  static async getResumeHistory() {
    return this.request('/api/resume/history', { method: 'GET' });
  }

  // Get latest resume PDF URL
  static async getLatestResumePDF() {
    const history = await this.getResumeHistory();
    if (history.resumes && history.resumes.length > 0) {
      const latest = history.resumes[0];
      return latest.s3_url || latest.pdf_url;
    }
    return null;
  }
}

export default HiHiredAPI;
