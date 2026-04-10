const STORAGE_KEY = 'my-sbti-version-state-v1';

function readSavedSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function updateLatestResultLinks() {
  const hasCompletedResult = Boolean(readSavedSession()?.completed);
  document.querySelectorAll('[data-latest-result-link]').forEach((link) => {
    link.hidden = !hasCompletedResult;
    if (hasCompletedResult) {
      link.setAttribute('href', '/result/');
    }
  });
}

document.addEventListener('DOMContentLoaded', updateLatestResultLinks);
