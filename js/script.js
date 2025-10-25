// Use this URL to fetch NASA APOD JSON data.
const apodData = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';

// Get references to page elements
const galleryEl = document.getElementById('gallery');
const getBtn = document.getElementById('getImageBtn');
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Modal elements (new)
const modal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const modalCloseBtn = document.getElementById('modalCloseBtn');

// We'll store the fetched data here so we only fetch once.
let apodCache = [];

/**
 * Fetch the APOD JSON data from the provided URL.
 * We wrap this in try/catch to handle errors.
 */
async function fetchApod() {
  try {
    const response = await fetch(apodData);
    if (!response.ok) {
      throw new Error(`Network error: ${response.status}`);
    }
    const data = await response.json();
    // Make sure we have an array. If not, use an empty array.
    apodCache = Array.isArray(data) ? data : [];
    return apodCache;
  } catch (error) {
    console.error('Fetch failed:', error);
    showMessage('Sorry, we could not load images. Please try again later.');
    return [];
  }
}

/**
 * Show a short loading message so users know images are on the way.
 */
function showLoading() {
  // Mark region as busy for assistive tech
  galleryEl.setAttribute('aria-busy', 'true');
  galleryEl.innerHTML = `
    <div class="placeholder">
      <div class="placeholder-icon">🔄</div>
      <p>Loading space photos…</p>
    </div>
  `;
}

/**
 * Show a simple message inside the gallery (used for errors or empty results).
 */
function showMessage(message) {
  galleryEl.innerHTML = `
    <div class="placeholder">
      <div class="placeholder-icon">🔭</div>
      <p>${message}</p>
    </div>
  `;
  // Done updating content
  galleryEl.setAttribute('aria-busy', 'false');
}

/**
 * Convert a YYYY-MM-DD string into a Date object.
 */
function toDate(isoString) {
  return new Date(isoString);
}

/**
 * Filter items by an optional inclusive date range.
 * - Keeps only items where media_type is "image".
 * - If both dates are empty, return all image items.
 */
function filterByDateRange(items, startStr, endStr) {
  // Keep only image items with a valid URL
  let filtered = items.filter((item) => item.media_type === 'image' && (item.url || item.hdurl));

  if (!startStr && !endStr) {
    return filtered;
  }

  let start = startStr ? toDate(startStr) : null;
  let end = endStr ? toDate(endStr) : null;

  // If the user picked the dates in reverse, swap them
  if (start && end && start > end) {
    const temp = start;
    start = end;
    end = temp;
  }

  return filtered.filter((item) => {
    const itemDate = toDate(item.date);
    if (start && itemDate < start) return false;

    if (end) {
      // Make end date inclusive by moving to the end of the day
      const endInclusive = new Date(end);
      endInclusive.setHours(23, 59, 59, 999);
      if (itemDate > endInclusive) return false;
    }
    return true;
  });
}

/**
 * Render the gallery items. If there are no items, show a helpful message.
 */
function renderGallery(items) {
  // Clear the current gallery content (this also removes the placeholder)
  galleryEl.innerHTML = '';

  if (!items.length) {
    showMessage('No images found for that date range. Try different dates.');
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    // Prefer "url", but fall back to "hdurl" if needed
    const imgSrc = item.url || item.hdurl || '';
    const title = item.title || 'Untitled';
    const date = item.date || '';

    // Create a card for each image
    const card = document.createElement('div');
    card.className = 'gallery-item';
    // Store the date on the card so we can look up the full item on click
    card.dataset.date = date;

    card.innerHTML = `
      <img src="${imgSrc}" alt="${title}">
      <p><strong>${title}</strong></p>
      <p>${date}</p>
    `;
    fragment.appendChild(card);
  });

  galleryEl.appendChild(fragment);
  // Done updating content
  galleryEl.setAttribute('aria-busy', 'false');
}

// Open the modal with the selected item's details (new)
function openModal(item) {
  // Choose the largest available image
  const largeSrc = item.hdurl || item.url || '';

  // Fill in the modal content
  modalImage.src = largeSrc;
  modalImage.alt = item.title || 'Space image';
  modalTitle.textContent = item.title || 'Untitled';
  modalDate.textContent = item.date || '';
  modalExplanation.textContent = item.explanation || 'No description available.';

  // Show the modal
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

// Close the modal and clear the image src (new)
function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modalImage.src = '';
}

// When the user clicks the button, show loading, then filter and render the gallery
getBtn.addEventListener('click', async () => {
  // Show loading message immediately
  showLoading();

  // Fetch (or use cache), then filter and render
  const data = apodCache.length ? apodCache : await fetchApod();
  const items = filterByDateRange(data, startInput.value, endInput.value);
  renderGallery(items);
});

// When a gallery item is clicked, open the modal with its data (new)
galleryEl.addEventListener('click', (event) => {
  const card = event.target.closest('.gallery-item');
  if (!card) return;

  // Find the full data item by date from our cache
  const date = card.dataset.date;
  const item = apodCache.find((i) => i.date === date);

  if (item) {
    openModal(item);
  }
});

// Close handlers for modal (button, backdrop, Esc key) (new)
modalCloseBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  // Close if user clicks on the dark overlay (outside the content)
  if (event.target === modal) {
    closeModal();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal.classList.contains('open')) {
    closeModal();
  }
});

/**
 * After we fetch data the first time:
 * - Set min/max for the date inputs based on the dataset.
 * - Pre-fill a simple default range (last 7 days within the dataset).
 * We do not render automatically; we wait for the user to click the button.
 */
async function init() {
  const data = await fetchApod();
  if (!data.length) return;

  // Only consider images when computing date bounds
  const images = data.filter((i) => i.media_type === 'image');
  if (!images.length) return;

  // Sort ISO date strings to find min/max
  const dates = images.map((i) => i.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  // Set the input limits
  startInput.min = minDate;
  startInput.max = maxDate;
  endInput.min = minDate;
  endInput.max = maxDate;

  // Default to the last 7 days (or clamp to min if needed)
  const end = new Date(maxDate);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);

  const min = new Date(minDate);
  const defaultStart = start < min ? min : start;

  startInput.value = defaultStart.toISOString().slice(0, 10);
  endInput.value = end.toISOString().slice(0, 10);
}

// Set up inputs after the page loads
document.addEventListener('DOMContentLoaded', init);