// HiHired Extension - Form Detector
// Detects job application forms and injects auto-fill button

(function() {
  'use strict';

  // Platform detection
  const hostname = window.location.hostname;
  let platform = null;

  if (hostname.includes('linkedin.com')) platform = 'linkedin';
  else if (hostname.includes('indeed.com')) platform = 'indeed';
  else if (hostname.includes('greenhouse.io')) platform = 'greenhouse';
  else if (hostname.includes('lever.co')) platform = 'lever';
  else if (hostname.includes('myworkdayjobs.com')) platform = 'workday';
  else if (hostname.includes('ashbyhq.com')) platform = 'ashby';
  else if (hostname.includes('smartrecruiters.com')) platform = 'smartrecruiters';
  else if (hostname.includes('workable.com')) platform = 'workable';

  if (!platform) {
    console.log('[HiHired] Unsupported platform');
    return;
  }

  console.log('[HiHired] Detected platform:', platform);

  // Form selectors by platform
  const FORM_SELECTORS = {
    linkedin: '.jobs-easy-apply-content, .jobs-apply-form, .jobs-easy-apply-modal',
    indeed: '#ia-container, .indeed-apply-widget, .ia-BasePage',
    greenhouse: '#application-form, .application-form, #application_form, form[action*="greenhouse"]',
    lever: '.application-form, .lever-application, form[action*="lever"]',
    workday: '.application-content, [data-automation-id="applicationForm"], .wd-ApplicationForm',
    ashby: '.application-form, form[data-testid="application-form"]',
    smartrecruiters: '.application-form, .job-apply-form',
    workable: '.application-form, form.apply-form'
  };

  // Job description selectors by platform
  const JD_SELECTORS = {
    linkedin: '.jobs-description__content, .job-details-module, .jobs-description, .jobs-box__html-content',
    indeed: '#jobDescriptionText, .jobsearch-jobDescriptionText',
    greenhouse: '#content .body, .job-description, .job__description',
    lever: '.section-wrapper .content, .posting-page .content, .posting-description',
    workday: '.job-description, [data-automation-id="jobPostingDescription"]',
    ashby: '.ashby-job-posting-description, .job-description',
    smartrecruiters: '.job-description, .jobad-description',
    workable: '.job-description, .job-details'
  };

  let observer = null;
  let injectedForms = new WeakSet();

  // Initialize form detection
  function init() {
    // Check preferences
    chrome.storage.local.get('preferences', (result) => {
      const prefs = result.preferences || { autoDetectForms: true };

      if (prefs.autoDetectForms === false) {
        console.log('[HiHired] Auto-detect disabled');
        return;
      }

      // Start observing
      startObserving();

      // Delay initial check to allow React/SPA frameworks to hydrate first
      setTimeout(checkForForms, 1500);
    });
  }

  // Start observing DOM changes
  function startObserving() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      // Debounce form checking
      clearTimeout(window.hihiredCheckTimeout);
      window.hihiredCheckTimeout = setTimeout(checkForForms, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Check for application forms
  function checkForForms() {
    const selector = FORM_SELECTORS[platform];
    if (!selector) return;

    const forms = document.querySelectorAll(selector);

    forms.forEach(form => {
      if (!injectedForms.has(form)) {
        injectAutofillButton(form);
        injectedForms.add(form);
      }
    });
  }

  // Inject auto-fill button before form (as sibling, outside React's DOM tree)
  function injectAutofillButton(form) {
    // Check if button already exists (as previous sibling or anywhere on page)
    if (document.querySelector('.hihired-autofill-button')) {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hihired-autofill-button';
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      <span>HiHired Auto-Fill</span>
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerAutofill(form);
    });

    // Insert before the form as a sibling to avoid disrupting React hydration
    if (form.parentNode) {
      form.parentNode.insertBefore(button, form);
    } else {
      document.body.appendChild(button);
    }

    console.log('[HiHired] Auto-fill button injected');
  }

  // Extract job description text from the page
  function extractJobDescription() {
    const selectors = JD_SELECTORS[platform];
    if (!selectors) return '';

    for (const selector of selectors.split(',')) {
      const el = document.querySelector(selector.trim());
      if (el) {
        const text = el.innerText || el.textContent || '';
        if (text.trim().length > 50) {
          console.log('[HiHired] Extracted JD from:', selector.trim(), '(' + text.length + ' chars)');
          return text.trim();
        }
      }
    }

    return '';
  }

  // Show tailor confirmation dialog, returns a Promise that resolves to true (tailor) or false (skip)
  function showTailorDialog() {
    return new Promise((resolve) => {
      // Remove any existing dialog
      const existing = document.querySelector('.hihired-dialog-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.className = 'hihired-dialog-overlay';
      overlay.innerHTML = `
        <div class="hihired-dialog">
          <h3>Polish your resume for this role?</h3>
          <p>We'll tailor your resume to match this job description using AI.</p>
          <div class="hihired-dialog-buttons">
            <button class="hihired-dialog-btn hihired-dialog-primary">Yes, tailor it</button>
            <button class="hihired-dialog-btn hihired-dialog-secondary">No, use existing</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('.hihired-dialog-primary').addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });

      overlay.querySelector('.hihired-dialog-secondary').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
    });
  }

  // Trigger auto-fill
  async function triggerAutofill(form) {
    console.log('[HiHired] Triggering auto-fill');

    // Extract job description from the page
    const jdText = extractJobDescription();
    let tailorJD = '';

    // If JD found, ask user if they want to tailor their resume
    if (jdText) {
      console.log('[HiHired] Job description found (' + jdText.length + ' chars), showing tailor dialog');
      const wantsTailor = await showTailorDialog();
      if (wantsTailor) {
        tailorJD = jdText;
        console.log('[HiHired] User chose to tailor resume');
      } else {
        console.log('[HiHired] User chose to use existing resume');
      }
    }

    // Show loading state on button (button is a sibling before the form)
    const button = document.querySelector('.hihired-autofill-button');
    if (button) {
      button.classList.add('loading');
      button.innerHTML = `
        <span class="hihired-spinner"></span>
        <span>${tailorJD ? 'Tailoring & Filling...' : 'Filling...'}</span>
      `;
    }

    try {
      // Request resume data from background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_RESUME_DATA' }, resolve);
      });

      if (!response.success) {
        showNotification('Please log in to HiHired extension first', 'error');
        resetButton(button);
        return;
      }

      // Trigger autofill with the data, passing tailorJD if user chose to tailor
      window.postMessage({
        type: 'HIHIRED_AUTOFILL',
        data: response.data,
        platform: platform,
        tailorJD: tailorJD
      }, '*');

    } catch (error) {
      console.error('[HiHired] Auto-fill error:', error);
      if (error.message && error.message.includes('Extension context invalidated')) {
        showNotification('Extension was updated. Please refresh this page and try again.', 'error');
      } else {
        showNotification('Failed to auto-fill. Please try again.', 'error');
      }
      resetButton(button);
    }
  }

  // Reset button to default state
  function resetButton(button) {
    if (button) {
      button.classList.remove('loading');
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>HiHired Auto-Fill</span>
      `;
    }
  }

  // Show notification
  function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.hihired-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `hihired-notification hihired-notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button class="hihired-notification-close">&times;</button>
    `;

    document.body.appendChild(notification);

    // Close button handler
    notification.querySelector('.hihired-notification-close').addEventListener('click', () => {
      notification.remove();
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRIGGER_AUTOFILL') {
      const selector = FORM_SELECTORS[platform];
      const form = document.querySelector(selector);

      if (form) {
        triggerAutofill(form);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No form found' });
      }
    }
    return true;
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
