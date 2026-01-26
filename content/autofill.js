// HiHired Extension - Auto-Fill Logic
// Handles filling form fields with resume data

(function() {
  'use strict';

  // Field patterns for detection
  const FIELD_PATTERNS = {
    firstName: {
      labels: ['first name', 'firstname', 'given name', 'forename'],
      attrs: ['firstname', 'first_name', 'fname', 'given-name', 'givenname']
    },
    lastName: {
      labels: ['last name', 'lastname', 'surname', 'family name'],
      attrs: ['lastname', 'last_name', 'lname', 'family-name', 'familyname']
    },
    fullName: {
      labels: ['full name', 'name', 'your name', 'legal name'],
      attrs: ['name', 'fullname', 'full_name']
    },
    email: {
      labels: ['email', 'email address', 'e-mail'],
      attrs: ['email', 'emailaddress', 'email_address'],
      types: ['email']
    },
    phone: {
      labels: ['phone', 'phone number', 'telephone', 'mobile', 'cell'],
      attrs: ['phone', 'phonenumber', 'phone_number', 'telephone', 'mobile', 'tel'],
      types: ['tel']
    },
    city: {
      labels: ['city', 'town'],
      attrs: ['city', 'town', 'locality']
    },
    state: {
      labels: ['state', 'province', 'region'],
      attrs: ['state', 'province', 'region', 'administrativearea']
    },
    zipCode: {
      labels: ['zip', 'zip code', 'postal code', 'postcode'],
      attrs: ['zip', 'zipcode', 'postalcode', 'postcode', 'postal']
    },
    linkedin: {
      labels: ['linkedin', 'linkedin url', 'linkedin profile'],
      attrs: ['linkedin', 'linkedinurl', 'linkedin_url']
    },
    website: {
      labels: ['website', 'portfolio', 'personal website', 'url'],
      attrs: ['website', 'portfolio', 'url', 'personalwebsite']
    },
    github: {
      labels: ['github', 'github url', 'github profile'],
      attrs: ['github', 'githuburl', 'github_url']
    }
  };

  // Listen for autofill trigger from detector
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data.type !== 'HIHIRED_AUTOFILL') return;

    const { data, platform } = event.data;
    console.log('[HiHired] Starting auto-fill for platform:', platform);

    await performAutofill(data, platform);
  });

  // Perform auto-fill on the page
  async function performAutofill(resumeData, platform) {
    // Map resume data to form fields
    const mapped = mapResumeData(resumeData);
    console.log('[HiHired] Mapped data:', mapped);

    // Get all fillable inputs
    const inputs = document.querySelectorAll('input, textarea, select');
    let filledCount = 0;

    // Get preferences
    const prefs = await getPreferences();

    for (const input of inputs) {
      // Skip hidden, disabled, or already filled inputs
      if (input.type === 'hidden' || input.disabled || input.readOnly) continue;
      if (input.type === 'file' || input.type === 'submit' || input.type === 'button') continue;
      if (input.value && input.value.trim() !== '') continue;

      // Detect field type
      const fieldType = detectFieldType(input);

      if (fieldType && mapped[fieldType]) {
        const value = mapped[fieldType];

        if (input.tagName === 'SELECT') {
          fillSelect(input, value);
        } else {
          fillInput(input, value);
        }

        // Highlight if enabled
        if (prefs.highlightFilledFields) {
          highlightField(input);
        }

        filledCount++;
      }
    }

    // Show completion notification
    const button = document.querySelector('.hihired-autofill-button');
    if (button) {
      button.classList.remove('loading');
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
        <span>Filled ${filledCount} fields</span>
      `;

      // Reset button after 3 seconds
      setTimeout(() => {
        button.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>HiHired Auto-Fill</span>
        `;
      }, 3000);
    }

    showNotification(`Filled ${filledCount} fields`, 'success');
  }

  // Title-case a string: first letter uppercase, rest lowercase for each word
  function titleCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, function(word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  // Map resume data to standard field names
  function mapResumeData(data) {
    const name = data.name || '';
    const nameParts = name.trim().split(/\s+/);

    // Parse location
    const location = data.location || '';
    const locationParts = location.split(',').map(p => p.trim());

    return {
      firstName: titleCase(nameParts[0] || ''),
      lastName: titleCase(nameParts.slice(1).join(' ') || ''),
      fullName: titleCase(name),
      email: data.email || '',
      phone: formatPhone(data.phone),
      city: locationParts[0] || '',
      state: locationParts[1] || '',
      zipCode: '',
      country: locationParts[2] || 'United States',
      linkedin: extractUrl(data, 'linkedin'),
      github: extractUrl(data, 'github'),
      website: extractUrl(data, 'portfolio') || extractUrl(data, 'website'),
      summary: data.summary || ''
    };
  }

  // Format phone number
  function formatPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  // Extract URL from data
  function extractUrl(data, key) {
    // Check if directly available
    if (data[key]) return data[key];

    // Try to extract from summary or other text fields
    const pattern = new RegExp(`${key}\\.com/[\\w-]+`, 'i');
    const sources = [data.summary, JSON.stringify(data.experiences || [])];

    for (const source of sources) {
      if (source) {
        const match = source.match(pattern);
        if (match) return `https://${match[0]}`;
      }
    }

    return '';
  }

  // Detect field type from input element
  function detectFieldType(input) {
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const type = input.type || '';
    const autocomplete = (input.autocomplete || '').toLowerCase();

    // Get label text
    let labelText = '';
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) labelText = label.textContent.toLowerCase();
    }
    // Also check parent label
    const parentLabel = input.closest('label');
    if (parentLabel) {
      labelText = parentLabel.textContent.toLowerCase();
    }
    // Check aria-label
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();

    // Check each field pattern
    for (const [fieldType, pattern] of Object.entries(FIELD_PATTERNS)) {
      // Check type attribute
      if (pattern.types && pattern.types.includes(type)) {
        return fieldType;
      }

      // Check autocomplete
      if (pattern.attrs && pattern.attrs.some(attr => autocomplete.includes(attr))) {
        return fieldType;
      }

      // Check name/id attributes
      if (pattern.attrs) {
        for (const attr of pattern.attrs) {
          if (name.includes(attr) || id.includes(attr)) {
            return fieldType;
          }
        }
      }

      // Check labels
      if (pattern.labels) {
        for (const label of pattern.labels) {
          if (labelText.includes(label) || placeholder.includes(label) || ariaLabel.includes(label)) {
            return fieldType;
          }
        }
      }
    }

    return null;
  }

  // Fill text input
  function fillInput(input, value) {
    // Focus the input
    input.focus();

    // Set value
    input.value = value;

    // Dispatch events to trigger React/Vue/Angular handlers
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

    // Blur
    input.blur();
  }

  // Fill select dropdown
  function fillSelect(select, value) {
    const options = Array.from(select.options);
    const valueLower = value.toLowerCase();

    // Find matching option
    const match = options.find(opt => {
      const text = opt.text.toLowerCase();
      const val = opt.value.toLowerCase();
      return text === valueLower || val === valueLower ||
             text.includes(valueLower) || valueLower.includes(text);
    });

    if (match) {
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Highlight filled field
  function highlightField(input) {
    input.classList.add('hihired-filled');

    // Remove highlight after animation
    setTimeout(() => {
      input.classList.remove('hihired-filled');
    }, 2000);
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const existing = document.querySelector('.hihired-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `hihired-notification hihired-notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button class="hihired-notification-close">&times;</button>
    `;

    document.body.appendChild(notification);

    notification.querySelector('.hihired-notification-close').addEventListener('click', () => {
      notification.remove();
    });

    setTimeout(() => notification.remove(), 5000);
  }

  // Get preferences
  async function getPreferences() {
    return new Promise((resolve) => {
      chrome.storage.local.get('preferences', (result) => {
        resolve(result.preferences || {
          highlightFilledFields: true
        });
      });
    });
  }

})();
