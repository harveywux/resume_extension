// HiHired Extension - Background Service Worker

const API_BASE_URL = 'https://hihired.org';

// Message handler for communication with popup and content scripts
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'GET_RESUME_DATA') {
    handleGetResumeData(sendResponse);
    return true;
  }
  if (message.type === 'CHECK_AUTH') {
    handleCheckAuth(sendResponse);
    return true;
  }
  if (message.type === 'LOGIN') {
    handleLogin(message.email, message.password, sendResponse);
    return true;
  }
  if (message.type === 'LOGOUT') {
    handleLogout(sendResponse);
    return true;
  }
  if (message.type === 'GOOGLE_LOGIN') {
    handleGoogleLogin(sendResponse);
    return true;
  }
  if (message.type === 'TOKEN_LOGIN') {
    handleTokenLogin(message.token, sendResponse);
    return true;
  }
  if (message.type === 'REFRESH_CACHE') {
    handleRefreshCache(sendResponse);
    return true;
  }
  if (message.type === 'API_REQUEST') {
    handleAPIRequest(message.endpoint, message.options, sendResponse);
    return true;
  }
  if (message.type === 'GET_RESUME_PDF') {
    handleGetResumePDF(sendResponse);
    return true;
  }
  return false;
});

// Check authentication status
function handleCheckAuth(sendResponse) {
  chrome.storage.local.get(['authToken', 'user', 'loginTime'], function(session) {
    if (chrome.runtime.lastError) {
      sendResponse({ authenticated: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (!session.authToken) {
      sendResponse({ authenticated: false });
      return;
    }

    // Check if token is still valid (23 hours)
    var tokenAge = Date.now() - (session.loginTime || 0);
    var maxAge = 23 * 60 * 60 * 1000;

    if (tokenAge > maxAge) {
      chrome.storage.local.remove(['authToken', 'user', 'loginTime'], function() {
        sendResponse({ authenticated: false, reason: 'Token expired' });
      });
      return;
    }

    sendResponse({
      authenticated: true,
      user: session.user
    });
  });
}

// Login with email/password
function handleLogin(email, password, sendResponse) {
  fetch(API_BASE_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  })
  .then(function(response) {
    return response.json().then(function(data) {
      return { ok: response.ok, data: data };
    });
  })
  .then(function(result) {
    if (!result.ok) {
      sendResponse({ success: false, error: result.data.error || 'Login failed' });
      return;
    }

    if (result.data.token) {
      chrome.storage.local.set({
        authToken: result.data.token,
        user: result.data.user || { email: email },
        loginTime: Date.now()
      }, function() {
        fetchAndCacheResumeData(result.data.token, function() {
          updateBadge(true);
          sendResponse({ success: true, user: result.data.user || { email: email } });
        });
      });
    } else {
      sendResponse({ success: false, error: 'Invalid response from server' });
    }
  })
  .catch(function(error) {
    sendResponse({ success: false, error: error.message });
  });
}

// Logout
function handleLogout(sendResponse) {
  chrome.storage.local.remove(['authToken', 'user', 'loginTime', 'resumeData', 'resumeCacheTime'], function() {
    updateBadge(false);
    sendResponse({ success: true });
  });
}

// Google Login using launchWebAuthFlow (works with web OAuth client)
function handleGoogleLogin(sendResponse) {
  var clientId = '978604541120-fmcim15k16vbatesna24ulke8m4buldp.apps.googleusercontent.com';
  var redirectUri = chrome.identity.getRedirectURL();
  var scopes = ['openid', 'email', 'profile'];

  var authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(clientId) +
    '&response_type=token' +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&scope=' + encodeURIComponent(scopes.join(' '));

  chrome.identity.launchWebAuthFlow(
    { url: authUrl, interactive: true },
    function(redirectUrl) {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      if (!redirectUrl) {
        sendResponse({ success: false, error: 'Authentication was cancelled' });
        return;
      }

      // Extract access token from redirect URL
      var hashParams = new URLSearchParams(redirectUrl.split('#')[1]);
      var accessToken = hashParams.get('access_token');

      if (!accessToken) {
        sendResponse({ success: false, error: 'Failed to get access token' });
        return;
      }

      // Send the Google access token to our backend
      fetch(API_BASE_URL + '/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken })
      })
      .then(function(response) {
        return response.json().then(function(data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function(result) {
        if (!result.ok) {
          sendResponse({ success: false, error: result.data.error || 'Google login failed' });
          return;
        }

        if (result.data.token) {
          chrome.storage.local.set({
            authToken: result.data.token,
            user: result.data.user || {},
            loginTime: Date.now()
          }, function() {
            fetchAndCacheResumeData(result.data.token, function() {
              updateBadge(true);
              sendResponse({ success: true, user: result.data.user || {} });
            });
          });
        } else {
          sendResponse({ success: false, error: 'Invalid response from server' });
        }
      })
      .catch(function(error) {
        sendResponse({ success: false, error: error.message });
      });
    }
  );
}

// Login with a manually provided auth token
function handleTokenLogin(token, sendResponse) {
  // Validate the token by calling the API
  fetch(API_BASE_URL + '/api/user/load', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  })
  .then(function(response) {
    if (!response.ok) {
      throw new Error('Invalid or expired token');
    }
    return response.json();
  })
  .then(function(result) {
    var resumeData = result.data || result;
    var user = {
      name: resumeData.name || '',
      email: resumeData.email || ''
    };

    chrome.storage.local.set({
      authToken: token,
      user: user,
      loginTime: Date.now(),
      resumeData: resumeData,
      resumeCacheTime: Date.now()
    }, function() {
      updateBadge(true);
      sendResponse({ success: true, user: user });
    });
  })
  .catch(function(error) {
    sendResponse({ success: false, error: error.message });
  });
}

// Get resume data (from cache or fetch)
function handleGetResumeData(sendResponse) {
  chrome.storage.local.get(['authToken', 'resumeData', 'resumeCacheTime'], function(data) {
    if (!data.authToken) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }

    var cacheMaxAge = 30 * 60 * 1000; // 30 minutes

    if (data.resumeData && data.resumeCacheTime) {
      var age = Date.now() - data.resumeCacheTime;
      if (age < cacheMaxAge) {
        sendResponse({ success: true, data: data.resumeData, fromCache: true });
        return;
      }
    }

    fetchAndCacheResumeData(data.authToken, function(resumeData, error) {
      if (error) {
        sendResponse({ success: false, error: error });
      } else {
        sendResponse({ success: true, data: resumeData, fromCache: false });
      }
    });
  });
}

// Refresh resume cache
function handleRefreshCache(sendResponse) {
  chrome.storage.local.get('authToken', function(data) {
    if (!data.authToken) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }

    fetchAndCacheResumeData(data.authToken, function(resumeData, error) {
      if (error) {
        sendResponse({ success: false, error: error });
      } else {
        sendResponse({ success: true, data: resumeData });
      }
    });
  });
}

// Fetch resume data from API and cache it
function fetchAndCacheResumeData(token, callback) {
  fetch(API_BASE_URL + '/api/user/load', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  })
  .then(function(response) {
    if (!response.ok) {
      throw new Error('Failed to fetch resume data');
    }
    return response.json();
  })
  .then(function(result) {
    var resumeData = result.data || result;
    chrome.storage.local.set({
      resumeData: resumeData,
      resumeCacheTime: Date.now()
    }, function() {
      callback(resumeData, null);
    });
  })
  .catch(function(error) {
    callback(null, error.message);
  });
}

// Fetch the latest resume PDF as bytes
function handleGetResumePDF(sendResponse) {
  chrome.storage.local.get('authToken', function(data) {
    if (!data.authToken) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }

    var token = data.authToken;
    var headers = {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    };

    // Step 1: Get resume history
    fetch(API_BASE_URL + '/api/resume/history', {
      method: 'GET',
      headers: headers
    })
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to fetch resume history');
      return response.json();
    })
    .then(function(result) {
      var history = result.history || [];
      if (history.length === 0) {
        throw new Error('No resume found in history');
      }

      // Get the most recent resume
      var latest = history[0];
      var filename = latest.s3_path || latest.resume_name || '';

      // Strip query parameters (s3_path may contain old presigned URL params)
      if (filename.includes('?')) {
        filename = filename.split('?')[0];
      }

      // Extract just the filename from the path
      if (filename.includes('/')) {
        filename = filename.split('/').pop();
      }

      if (!filename) {
        throw new Error('No resume filename found');
      }

      // Step 2: Get presigned download URL
      return fetch(API_BASE_URL + '/api/resume/download/' + encodeURIComponent(filename), {
        method: 'GET',
        headers: headers
      });
    })
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to get download URL');
      return response.json();
    })
    .then(function(result) {
      var downloadUrl = result.downloadUrl || result.download_url || '';
      var resumeFilename = result.filename || 'resume.pdf';

      if (!downloadUrl) {
        throw new Error('No download URL returned');
      }

      // Step 3: Download the PDF bytes
      return fetch(downloadUrl).then(function(response) {
        if (!response.ok) throw new Error('Failed to download PDF');
        return response.arrayBuffer().then(function(buffer) {
          return { buffer: buffer, filename: resumeFilename };
        });
      });
    })
    .then(function(result) {
      // Convert ArrayBuffer to regular array for message passing
      var bytes = Array.from(new Uint8Array(result.buffer));
      sendResponse({
        success: true,
        pdfData: bytes,
        filename: result.filename
      });
    })
    .catch(function(error) {
      console.error('[HiHired] Failed to fetch resume PDF:', error);
      sendResponse({ success: false, error: error.message });
    });
  });
}

// Handle proxied API requests
function handleAPIRequest(endpoint, options, sendResponse) {
  chrome.storage.local.get('authToken', function(data) {
    var headers = {
      'Content-Type': 'application/json'
    };

    if (options && options.headers) {
      Object.assign(headers, options.headers);
    }

    if (data.authToken) {
      headers['Authorization'] = 'Bearer ' + data.authToken;
    }

    var fetchOptions = Object.assign({}, options, { headers: headers });

    fetch(API_BASE_URL + endpoint, fetchOptions)
    .then(function(response) {
      return response.json().then(function(responseData) {
        return { ok: response.ok, data: responseData, status: response.status };
      });
    })
    .then(function(result) {
      sendResponse({ success: result.ok, data: result.data, status: result.status });
    })
    .catch(function(error) {
      sendResponse({ success: false, error: error.message });
    });
  });
}

// Update extension badge based on auth state
function updateBadge(isAuthenticated) {
  if (isAuthenticated) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get('authToken', function(data) {
    updateBadge(!!data.authToken);
  });
});
