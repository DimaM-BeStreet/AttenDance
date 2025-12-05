/**
 * Modal Component
 * Reusable modal/dialog system with mobile back button support
 */

let activeModals = [];
let modalHistory = [];
let isProgrammaticBack = false;

/**
 * Show existing modal element (for pre-defined modals in HTML)
 */
export function showModal(modalIdOrOptions, modalElement = null) {
  // New API: options object
  if (typeof modalIdOrOptions === 'object' && !modalElement) {
    return showModalNew(modalIdOrOptions);
  }
  
  // Old API: modalId and element (for existing HTML modals)
  const modalId = modalIdOrOptions;
  const existingModal = modalElement || document.getElementById(modalId);
  
  if (!existingModal) {
    console.error(`Modal ${modalId} not found`);
    return;
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = `modal-overlay-${modalId}`;
  
  // Adjust z-index for stacked modals
  const zIndex = 1000 + (activeModals.length * 10);
  overlay.style.zIndex = zIndex;
  
  // Show the existing modal content
  existingModal.style.display = 'flex';
  overlay.appendChild(existingModal);
  document.body.appendChild(overlay);

  // Handle close buttons
  const closeButtons = existingModal.querySelectorAll('[data-modal-close], .modal-close');
  closeButtons.forEach(btn => {
    // Remove old listeners to prevent duplicates if reused
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => closeModal());
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    // Check if the click was directly on the overlay (not on the modal content)
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Close on ESC key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      // Only close if this is the top modal
      if (activeModals.length > 0 && activeModals[activeModals.length - 1].id === uniqueModalId) {
        closeModal();
      }
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Handle mobile back button
  const uniqueModalId = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  pushModalToHistory(uniqueModalId);

  const handlePopState = (e) => {
    if (isProgrammaticBack) return;
    
    // Check if this modal is the active one
    if (activeModals.length > 0 && activeModals[activeModals.length - 1].id === uniqueModalId) {
      e.preventDefault();
      closeModal(true);
    }
  };
  window.addEventListener('popstate', handlePopState);

  // Store active modal info
  const modalInfo = {
    id: uniqueModalId,
    element: overlay,
    modalContent: existingModal,
    cleanup: () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('popstate', handlePopState);
    }
  };
  
  activeModals.push(modalInfo);

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
  document.body.classList.add('modal-open');

  // Animate in
  setTimeout(() => {
    overlay.classList.add('show');
  }, 10);

  return { close: closeModal };
}

/**
 * Create and show a modal (new API with options)
 */
function showModalNew(options = {}) {
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

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = `modal-overlay-${Date.now()}`;

  // Adjust z-index for stacked modals
  const zIndex = 1000 + (activeModals.length * 10);
  overlay.style.zIndex = zIndex;

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
          try {
            // Loading state
            const originalText = confirmBtn.textContent;
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' + originalText;
            
            const result = await onConfirm();
            
            if (result !== false) {
              // Success state
              confirmBtn.innerHTML = '✓ ' + originalText;
              confirmBtn.classList.add('btn-success');
              confirmBtn.classList.remove('btn-primary', 'btn-danger'); // Remove potential other classes
              
              // Short delay before closing
              setTimeout(() => {
                closeModal();
              }, 200);
            } else {
              // Reset on validation failure (result === false)
              confirmBtn.disabled = false;
              confirmBtn.textContent = originalText;
            }
          } catch (error) {
            console.error('Modal action failed:', error);
            // Reset on error
            confirmBtn.disabled = false;
            confirmBtn.textContent = options.confirmText || 'אישור';
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
      // Only close if this is the top modal
      if (activeModals.length > 0 && activeModals[activeModals.length - 1].id === modalId) {
        if (onClose) onClose();
        closeModal();
      }
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Handle mobile back button
  const modalId = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  pushModalToHistory(modalId);

  const handlePopState = (e) => {
    if (isProgrammaticBack) return;

    if (activeModals.length > 0 && activeModals[activeModals.length - 1].id === modalId) {
      e.preventDefault();
      if (onClose) onClose();
      closeModal(true); // Skip history manipulation
    }
  };
  window.addEventListener('popstate', handlePopState);

  // Store cleanup function
  const modalInfo = {
    id: modalId,
    element: overlay,
    cleanup: () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('popstate', handlePopState);
    }
  };
  activeModals.push(modalInfo);

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
  if (activeModals.length === 0) return;

  const activeModal = activeModals.pop(); // Get top modal
  const overlay = activeModal.element;
  overlay.classList.remove('show');

  // Only restore body scroll if no more modals
  if (activeModals.length === 0) {
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
  }

  // Handle history
  if (!skipHistory) {
    popModalFromHistory();
  }

  // Store references before timeout
  const modalContent = activeModal.modalContent;
  const cleanup = activeModal.cleanup;
  
  setTimeout(() => {
    // If there's a modal content (old API), return it to its original hidden state
    if (modalContent) {
      modalContent.style.display = 'none';
      // Return modal content to body if it was moved
      if (modalContent.parentNode === overlay) {
        document.body.appendChild(modalContent);
      }
    }
    
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (cleanup) {
      cleanup();
    }
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
    // Only go back if we have a state to go back to
    // We assume that if we pushed a state, we can go back
    isProgrammaticBack = true;
    history.back();
    
    // Reset flag after a short delay to ensure popstate has fired
    setTimeout(() => {
      isProgrammaticBack = false;
    }, 100);
  }
}

/**
 * Update modal content
 */
function updateModalContent(content) {
  if (activeModals.length === 0) return;
  const activeModal = activeModals[activeModals.length - 1];
  const bodyElement = activeModal.element.querySelector('#modal-body');
  
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
  if (activeModals.length === 0) return;
  const activeModal = activeModals[activeModals.length - 1];
  const titleElement = activeModal.element.querySelector('.modal-title');
  
  if (titleElement) {
    titleElement.textContent = title;
  }
}

/**
 * Show confirmation dialog
 */
export function showConfirm(options = {}) {
  return new Promise((resolve) => {
    const {
      title = 'אישור פעולה',
      message = 'האם אתה בטוח?',
      confirmText = 'אישור',
      cancelText = 'ביטול',
      onConfirm = null
    } = options;

    showModal({
      title,
      content: `<p class="confirm-message">${message}</p>`,
      size: 'small',
      confirmText,
      cancelText,
      onConfirm: async () => {
        if (onConfirm) await onConfirm();
        resolve(true);
      },
      onCancel: () => {
        resolve(false);
      },
      onClose: () => {
        resolve(false);
      }
    });
  });
}

/**
 * Show alert dialog
 */
export function showAlert(options = {}) {
  return new Promise((resolve) => {
    // Handle string input
    if (typeof options === 'string') {
      options = { message: options };
    }

    const {
      title = 'הודעה',
      message = '',
      confirmText = 'אישור',
      onConfirm = null
    } = options;

    showModal({
      title,
      content: `<p class="alert-message">${message}</p>`,
      size: 'small',
      showCancel: false,
      confirmText,
      onConfirm: async () => {
        if (onConfirm) await onConfirm();
        resolve(true);
      },
      onClose: () => {
        resolve(true);
      }
    });
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

/**
 * Show toast notification
 * @param {string} message 
 * @param {'success'|'error'|'info'} type 
 * @param {number} duration 
 */
export function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  
  let icon = '';
  switch(type) {
    case 'success': icon = '✅'; break;
    case 'error': icon = '❌'; break;
    case 'info': icon = 'ℹ️'; break;
  }
  
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}
