/**
 * Global Error Suppressor
 * Suppresses harmless Google API timing errors that don't affect functionality
 */

// Suppress Google API iframe errors
(function() {
    'use strict';
    
    // Store original console.error
    const originalError = console.error;
    
    // Override console.error to filter out specific errors
    console.error = function(...args) {
        const errorString = args.join(' ');
        
        // Suppress Google API timing errors
        if (errorString.includes('u[v] is not a function') || 
            errorString.includes('gapi') ||
            (errorString.includes('api.js') && errorString.includes('is not a function'))) {
            return; // Silently ignore
        }
        
        // Call original console.error for everything else
        originalError.apply(console, args);
    };
    
    // Catch window errors
    window.addEventListener('error', function(e) {
        if (e.filename && e.message) {
            if ((e.filename.includes('api.js') || e.filename.includes('gapi') || e.filename.includes('cb=gapi')) &&
                (e.message.includes('is not a function') || e.message.includes('u[v]'))) {
                e.stopImmediatePropagation();
                e.preventDefault();
                return true;
            }
        }
    }, true);
})();
