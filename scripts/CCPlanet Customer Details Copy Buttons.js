// ==UserScript==
// @name         CCPlanet Customer Details Copy Buttons
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  Adds right-aligned copy buttons next to Name, E-mail, and Telefon fields on ccplanet.planethome.de, handling dynamic content and universal phone formatting.
// @author       Gemini AI & aldjan
// @match        https://ccplanet.planethome.de/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Function to format a phone number universally
    function formatPhoneNumber(phoneNumber) {
        // Remove all spaces, parentheses, slashes, and hyphens
        let cleanedNumber = phoneNumber.replace(/[\s()/-]/g, '');

        // If the number already starts with '+' followed by digits, assume it's correctly prefixed
        if (cleanedNumber.startsWith('+') && /^\+\d+$/.test(cleanedNumber)) {
            return cleanedNumber;
        }

        // If it starts with '00' (international access code), replace with '+'
        if (cleanedNumber.startsWith('00')) {
            return '+' + cleanedNumber.substring(2);
        }

        // IMPORTANT LIMITATION:
        // If the number starts with '0' (common for domestic dialing) or has no international prefix,
        // we must assume a default country code as there's no country indicator on the page.
        // We will default to +49 (Germany) in these cases.
        if (cleanedNumber.startsWith('0')) {
            return '+49' + cleanedNumber.substring(1); // Replace leading '0' with '+49'
        }

        // Fallback: If it doesn't start with '+', '00', or '0', assume it's a number
        // that needs the +49 prefix (e.g., a number written without leading 0 for domestic calls).
        return '+49' + cleanedNumber;
    }


    // Function to create a copy button
    // Now takes element ID and selector, so it can fetch the *current* text on click.
    function createCopyButton(valueElementId, valueSelector, buttonId, isPhoneNumber = false) {
        let button = document.getElementById(buttonId);
        // If button already exists, remove it to prevent duplicates on content refresh
        if (button) {
            button.remove();
        }

        button = document.createElement('button');
        button.id = buttonId; // Assign a unique ID to the button
        button.className = 'ccplanet-copy-button'; // Add a class for styling and checking
        button.textContent = '📋 Copy'; // Clipboard icon and text
        button.title = 'Copy to clipboard';

        button.onclick = async function(event) {
            event.stopPropagation(); // Prevent clicks from affecting parent elements

            // Fetch the textToCopy *at the moment of click*
            let currentTextToCopy = '';
            const targetElement = document.getElementById(valueElementId);

            if (targetElement) {
                if (valueSelector === 'a') {
                    const linkElement = targetElement.querySelector('a');
                    if (linkElement) {
                        currentTextToCopy = linkElement.textContent.trim();
                    }
                } else {
                    currentTextToCopy = targetElement.textContent.trim();
                }

                // Apply phone number formatting if required
                if (isPhoneNumber && currentTextToCopy) {
                    currentTextToCopy = formatPhoneNumber(currentTextToCopy);
                }
            }

            if (!currentTextToCopy) {
                console.warn('No text found to copy for element:', valueElementId);
                return; // Exit if no text is found
            }

            try {
                await navigator.clipboard.writeText(currentTextToCopy);
                button.textContent = '✅ Copied!';
                // Set success background
                button.style.backgroundColor = '#d4edda';
                setTimeout(() => {
                    button.textContent = '📋 Copy';
                    // Reset to default background color
                    button.style.backgroundColor = '#e0e0e0';
                }, 2000); // Reset button text after 2 seconds
            } catch (err) {
                console.error('Failed to copy: ', err);
                button.textContent = '❌ Error!';
                // Set error background
                button.style.backgroundColor = '#f8d7da';
                setTimeout(() => {
                    button.textContent = '📋 Copy';
                    // Reset to default background color
                    button.style.backgroundColor = '#e0e0e0';
                }, 2000);
            }
        };
        return button;
    }

    // Function to add a copy button to the right of a target element's row
    function addCopyButtonToElement(valueElementId, valueSelector, buttonId, isPhoneNumber = false) {
        const valueDiv = document.getElementById(valueElementId);

        // Find the ph-extra-box that contains this value div
        const phExtraBox = valueDiv ? valueDiv.closest('ph-extra-box') : null;

        if (phExtraBox && !document.getElementById(buttonId)) { // Only add if ph-extra-box found and button doesn't exist
            // Now, createCopyButton will handle fetching the text, so we pass its required parameters
            const copyButton = createCopyButton(valueElementId, valueSelector, buttonId, isPhoneNumber);
            phExtraBox.appendChild(copyButton); // Append the button directly to ph-extra-box
        }
    }

    // Use a MutationObserver to ensure elements are present and handle dynamic content updates
    const observer = new MutationObserver((mutationsList, obs) => {
        const customerDetailsApp = document.querySelector('app-customer-details');

        if (customerDetailsApp) {
            // Check for the presence of the specific value elements
            const nameElement = document.getElementById('lbl-customer-name');
            const emailElement = document.getElementById('lbl-customer-email');
            const phoneElement = document.getElementById('lbl-customer-phone-home');

            // Add buttons if the elements are found
            // Pass element IDs and selectors to createCopyButton via addCopyButtonToElement
            addCopyButtonToElement('lbl-customer-name', 'div', 'copy-button-name');
            addCopyButtonToElement('lbl-customer-email', 'a', 'copy-button-email');
            addCopyButtonToElement('lbl-customer-phone-home', 'a', 'copy-button-phone', true);
        }
    });

    // Start observing the body for changes (subtrees and child additions/removals)
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    GM_addStyle(`
        /* Make ph-extra-box a flex container to align its children */
        ph-extra-box.ng-star-inserted {
            display: flex !important;
            align-items: center !important; /* Vertically align items */
        }

        /* Push the copy button to the far right within its flex container */
        .ccplanet-copy-button {
            margin-left: auto !important; /* This is the key for right alignment in flex */
            padding: 4px 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: #e0e0e0; /* NEW DEFAULT BACKGROUND COLOR */
            color: #333;
            cursor: pointer;
            font-size: 12px;
            line-height: 1;
            vertical-align: middle;
            flex-shrink: 0; /* Prevent button from shrinking */
        }

        .ccplanet-copy-button:hover {
            background: #d0d0d0; /* Slightly darker on hover */
        }

        .ccplanet-copy-button:active {
            background: #c0c0c0; /* Even darker when clicked */
            border-color: #aaa;
        }

        /* Adjust the content area to prevent it from growing too much if needed */
        ph-extra-box .content-cnt {
            flex-grow: 1; /* Allow content to take up available space */
            margin-right: 15px; /* Add some space before the button if button is close to text */
        }

        /* Ensure ph-text itself doesn't interfere with the new flex layout if it has its own flex properties */
        ph-text.ng-star-inserted {
            display: block !important; /* Revert ph-text to block display if it was flex before */
        }
    `);

})();