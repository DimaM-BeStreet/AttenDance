/**
 * Custom Dialog Component
 * Replaces default JavaScript alert() and confirm() with styled modals
 */

/**
 * Show a confirmation dialog
 * @param {string} message - The message to display
 * @param {string} confirmText - Text for confirm button (default: "אישור")
 * @param {string} cancelText - Text for cancel button (default: "ביטול")
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(message, confirmText = 'אישור', cancelText = 'ביטול') {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'customDialog';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'dialog-box';

    // Create content
    dialog.innerHTML = `
      <div class="dialog-content">
        <div class="dialog-message">${message}</div>
        <div class="dialog-actions">
          <button class="dialog-btn dialog-btn-cancel" id="dialogCancel">${cancelText}</button>
          <button class="dialog-btn dialog-btn-confirm" id="dialogConfirm">${confirmText}</button>
        </div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Add animation class after a small delay
    setTimeout(() => overlay.classList.add('show'), 10);

    // Handle confirm
    const confirmBtn = dialog.querySelector('#dialogConfirm');
    confirmBtn.addEventListener('click', () => {
      closeDialog(overlay);
      resolve(true);
    });

    // Handle cancel
    const cancelBtn = dialog.querySelector('#dialogCancel');
    cancelBtn.addEventListener('click', () => {
      closeDialog(overlay);
      resolve(false);
    });

    // Handle overlay click (close on backdrop click)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog(overlay);
        resolve(false);
      }
    });

    // Handle escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeDialog(overlay);
        document.removeEventListener('keydown', escapeHandler);
        resolve(false);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Handle browser back button
    const popstateHandler = () => {
      closeDialog(overlay);
      window.removeEventListener('popstate', popstateHandler);
      resolve(false);
    };
    window.addEventListener('popstate', popstateHandler);

    // Focus confirm button
    confirmBtn.focus();
  });
}

/**
 * Show an alert dialog
 * @param {string} message - The message to display
 * @param {string} buttonText - Text for the button (default: "אישור")
 * @returns {Promise<void>}
 */
export function showAlert(message, buttonText = 'אישור') {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'customDialog';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'dialog-box';

    // Create content
    dialog.innerHTML = `
      <div class="dialog-content">
        <div class="dialog-message">${message}</div>
        <div class="dialog-actions">
          <button class="dialog-btn dialog-btn-confirm" id="dialogOk">${buttonText}</button>
        </div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Add animation class after a small delay
    setTimeout(() => overlay.classList.add('show'), 10);

    // Handle OK button
    const okBtn = dialog.querySelector('#dialogOk');
    okBtn.addEventListener('click', () => {
      closeDialog(overlay);
      resolve();
    });

    // Handle overlay click (close on backdrop click)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog(overlay);
        resolve();
      }
    });

    // Handle escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeDialog(overlay);
        document.removeEventListener('keydown', escapeHandler);
        resolve();
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Handle browser back button
    const popstateHandler = () => {
      closeDialog(overlay);
      window.removeEventListener('popstate', popstateHandler);
      resolve();
    };
    window.addEventListener('popstate', popstateHandler);

    // Focus OK button
    okBtn.focus();
  });
}

/**
 * Close and remove dialog
 * @param {HTMLElement} overlay - The dialog overlay element
 */
function closeDialog(overlay) {
  overlay.classList.remove('show');
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 300); // Match CSS transition duration
}
