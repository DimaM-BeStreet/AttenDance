/**
 * Modal Component
 * Reusable modal/dialog system with mobile back button support
 */

let activeModal = null;
let modalHistory = [];

/**
 * Create and show a modal
 */
export function showModal(options = {}) {
  const {
    title = '',
    content = '',
    size = 'medium', // small, medium, large, fullscreen
    showClose = true,
    showCancel = true,
    showConfirm = true,
    cancelText = 'ביטול',
    confirmText = 'אישור',
    onConfirm = null,
    onCancel = null,
    onClose = null,
    customButtons = null
  } = options;

  // Close existing modal if any
  if (activeModal) {
    closeModal();
  }

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  // Create modal container
  const modal = document.createElement('div');
  modal.className = `modal modal-${size}`;
  modal.id = 'modal-container';

  // Build modal HTML
  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${title}</h2>
      ${showClose ? '<button class="modal-close" id="modal-close-btn">&times;</button>' : ''}
    </div>
    <div class="modal-body" id="modal-body">
      ${typeof content === 'string' ? content : ''}
    </div>
    <div class="modal-footer" id="modal-footer">
      ${customButtons ? '' : `
        ${showCancel ? `<button class="btn btn-secondary" id="modal-cancel-btn">${cancelText}</button>` : ''}
        ${showConfirm ? `<button class="btn btn-primary" id="modal-confirm-btn">${confirmText}</button>` : ''}
      `}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // If content is HTML element, append it
  if (typeof content !== 'string' && content instanceof HTMLElement) {
    const bodyElement = modal.querySelector('#modal-body');
    bodyElement.innerHTML = '';
    bodyElement.appendChild(content);
  }

  // Add custom buttons if provided
  if (customButtons && Array.isArray(customButtons)) {
    const footer = modal.querySelector('#modal-footer');
    footer.innerHTML = '';
    customButtons.forEach(btn => {
      const button = document.createElement('button');
      button.className = `btn ${btn.className || 'btn-secondary'}`;
      button.textContent = btn.text;
      button.addEventListener('click', () => {
        if (btn.onClick) btn.onClick();
        if (btn.closeOnClick !== false) closeModal();
      });
      footer.appendChild(button);
    });
  }

  // Setup event listeners
  if (showClose) {
    const closeBtn = modal.querySelector('#modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (onClose) onClose();
        closeModal();
      });
    }
  }

  if (showCancel) {
    const cancelBtn = modal.querySelector('#modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (onCancel) onCancel();
        closeModal();
      });
    }
  }

  if (showConfirm) {
    const confirmBtn = modal.querySelector('#modal-confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (onConfirm) {
          const result = await onConfirm();
          if (result !== false) {
            closeModal();
          }
        } else {
          closeModal();
        }
      });
    }
  }

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if (onClose) onClose();
      closeModal();
    }
  });

  // Close on ESC key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      if (onClose) onClose();
      closeModal();
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Handle mobile back button
  const modalId = `modal-${Date.now()}`;
  pushModalToHistory(modalId);

  const handlePopState = (e) => {
    if (activeModal && activeModal.id === modalId) {
      e.preventDefault();
      if (onClose) onClose();
      closeModal(true); // Skip history manipulation
    }
  };
  window.addEventListener('popstate', handlePopState);

  // Store cleanup function
  activeModal = {
    id: modalId,
    element: overlay,
    cleanup: () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('popstate', handlePopState);
    }
  };

  // Prevent body scroll when modal is open
  document.body.style.overflow = 'hidden';
  document.body.classList.add('modal-open');

  // Animate in
  setTimeout(() => {
    overlay.classList.add('show');
  }, 10);

  return {
    close: closeModal,
    updateContent: (newContent) => updateModalContent(newContent),
    updateTitle: (newTitle) => updateModalTitle(newTitle)
  };
}

/**
 * Close active modal
 */
export function closeModal(skipHistory = false) {
  if (!activeModal) return;

  const overlay = activeModal.element;
  overlay.classList.remove('show');

  // Restore body scroll
  document.body.style.overflow = '';
  document.body.classList.remove('modal-open');

  // Handle history
  if (!skipHistory) {
    popModalFromHistory();
  }

  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (activeModal.cleanup) {
      activeModal.cleanup();
    }
    activeModal = null;
  }, 300);
}

/**
 * Push modal to browser history for back button support
 */
function pushModalToHistory(modalId) {
  const state = { modal: modalId, timestamp: Date.now() };
  history.pushState(state, '', location.href);
  modalHistory.push(modalId);
}

/**
 * Pop modal from browser history
 */
function popModalFromHistory() {
  if (modalHistory.length > 0) {
    modalHistory.pop();
    if (history.state && history.state.modal) {
      history.back();
    }
  }
}

/**
 * Update modal content
 */
function updateModalContent(content) {
  const bodyElement = document.querySelector('#modal-body');
  if (!bodyElement) return;

  if (typeof content === 'string') {
    bodyElement.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    bodyElement.innerHTML = '';
    bodyElement.appendChild(content);
  }
}

/**
 * Update modal title
 */
function updateModalTitle(title) {
  const titleElement = document.querySelector('.modal-title');
  if (titleElement) {
    titleElement.textContent = title;
  }
}

/**
 * Show confirmation dialog
 */
export function showConfirm(options = {}) {
  const {
    title = 'אישור פעולה',
    message = 'האם אתה בטוח?',
    confirmText = 'אישור',
    cancelText = 'ביטול',
    onConfirm = null
  } = options;

  return showModal({
    title,
    content: `<p class="confirm-message">${message}</p>`,
    size: 'small',
    confirmText,
    cancelText,
    onConfirm
  });
}

/**
 * Show alert dialog
 */
export function showAlert(options = {}) {
  const {
    title = 'הודעה',
    message = '',
    confirmText = 'אישור'
  } = options;

  return showModal({
    title,
    content: `<p class="alert-message">${message}</p>`,
    size: 'small',
    showCancel: false,
    confirmText
  });
}

/**
 * Show loading modal
 */
export function showLoading(message = 'טוען...') {
  return showModal({
    title: '',
    content: `
      <div class="loading-container">
        <div class="spinner"></div>
        <p class="loading-message">${message}</p>
      </div>
    `,
    size: 'small',
    showClose: false,
    showCancel: false,
    showConfirm: false
  });
}

/**
 * Show error modal
 */
export function showError(message = 'אירעה שגיאה') {
  return showModal({
    title: 'שגיאה',
    content: `<p class="error-message">❌ ${message}</p>`,
    size: 'small',
    showCancel: false,
    confirmText: 'סגור'
  });
}

/**
 * Show success modal
 */
export function showSuccess(message = 'הפעולה בוצעה בהצלחה') {
  return showModal({
    title: 'הצלחה',
    content: `<p class="success-message">✅ ${message}</p>`,
    size: 'small',
    showCancel: false,
    confirmText: 'סגור'
  });
}
