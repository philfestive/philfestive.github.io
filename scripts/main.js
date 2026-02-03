/**
 * PhilFestive Site Scripts
 * ========================
 *
 * Contents:
 * 1. UTM Analytics - tracks which platforms drive traffic
 * 2. Social Dropdown - collapsible social links menu
 */

// UTM Analytics - tracks which platforms drive traffic
(function() {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');

  if (source) {
    // Store visit with timestamp
    const visits = JSON.parse(localStorage.getItem('pf_visits') || '[]');
    visits.push({
      source: source,
      medium: medium || 'unknown',
      time: new Date().toISOString()
    });
    // Keep last 100 visits max
    while (visits.length > 100) visits.shift();
    localStorage.setItem('pf_visits', JSON.stringify(visits));

    // Clean URL after tracking
    if (window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
})();

// Social Dropdown functionality
(function() {
  const trigger = document.getElementById('social-dropdown-trigger');
  const panel = document.getElementById('social-dropdown-panel');
  const closeBtn = panel.querySelector('.social-dropdown-close');

  function openDropdown() {
    panel.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown() {
    panel.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function toggleDropdown() {
    if (panel.classList.contains('open')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  // Toggle on trigger click
  trigger.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleDropdown();
  });

  // Close on close button click
  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    closeDropdown();
  });

  // Close on click outside
  document.addEventListener('click', function(e) {
    if (!panel.contains(e.target) && !trigger.contains(e.target)) {
      closeDropdown();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      closeDropdown();
      trigger.focus();
    }
  });

  // Prevent panel clicks from closing
  panel.addEventListener('click', function(e) {
    e.stopPropagation();
  });
})();
