// Authentication check module

/**
 * Check if user has entered the website password
 * Redirects to login page if not authenticated
 */
export function checkWebsiteAuth() {
  // Check if password has been entered in this session
  const hasEntered = sessionStorage.getItem('websitePasswordEntered');

  if (hasEntered === 'true') {
    return; // Already authenticated
  }

  // Store the current page to return after login
  sessionStorage.setItem('intendedPage', window.location.pathname.split('/').pop());

  // Redirect to login page
  window.location.href = 'login.html';
}
