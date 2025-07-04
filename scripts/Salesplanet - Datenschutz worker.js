// ==UserScript==
// @name         Salesplanet - Datenschutz worker
// @namespace    http://tampermonkey.net/
// @version      2.26
// @description  Adds highly persistent, right-aligned, vertically-centered copy buttons for Name, Email, Kunden-ID, Address, and automated Datenschutz and a dropdown for Sperrung/Widerruf buttons on salesplanet.planethome.de, visible only when a customer's detail page is active, now handling multiple email/phone fields for Datenschutz, with a toggle button for action buttons, success notifications, and auto-scrolling/focusing to Quill editor.
// @author       Gemini AI & aldjan
// @match        https://salesplanet.planethome.de/*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // A map to keep track of whether elements have been added for specific IDs/types
    const elementAddedFlags = { // Renamed from buttonAddedFlags for broader use
        name: false,
        email: false,
        customerId: false,
        street: false,
        postalCode: false,
        city: false,
        address: false,
        datenschutz: false,
        datenschutzActionsDropdown: false // New flag for the dropdown
    };

    // Variable to store the current visibility state of action buttons, default to true
    // This value is persistently stored by Tampermonkey's GM_getValue/GM_setValue.
    let areActionButtonsVisible = GM_getValue('salesplanet_action_buttons_visible', true);

    // Variable to store the timeout ID for the notification to allow clearing it
    let notificationTimeoutId = null;

    /**
     * Function to add CSS styles for button hover effects.
     * This is called once at the start to inject the styles.
     */
    function addHoverStyles() {
        let style = document.createElement('style');
        style.type = 'text/css';
        let css = `
            /* Target all salesplanet-created buttons for hover effect */
            .salesplanet-copy-name-button:hover,
            .salesplanet-copy-email-button:hover,
            .salesplanet-copy-customer-id-button:hover,
            .salesplanet-copy-street-button:hover,
            .salesplanet-copy-postal-code-button:hover,
            .salesplanet-copy-city-button:hover,
            .salesplanet-copy-address-button:hover,
            .salesplanet-datenschutz-button:hover,
            .salesplanet-action-toggle:hover {
                filter: brightness(0.9); /* Darken by 10% */
                transition: filter 0.2s ease-in-out; /* Smooth transition */
            }
            /* Style for the new dropdown */
            .salesplanet-datenschutz-actions-dropdown {
                box-sizing: border-box; /* Ensure padding is included in element's total width/height */
                padding: 5px 15px 5px 5px; /* Top, Right, Bottom, Left padding - adjusted for compactness */
                margin-top: -7px; /* Align with existing button */
                font-size: 12px;
                border: 1px solid #ccc;
                border-radius: 4px;
                background-color: #f8f9fa; /* Light background */
                color: #333;
                cursor: pointer;
                flex-shrink: 0;
                appearance: none; /* Remove default system dropdown arrow */
                background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23000%22%20d%3D%22M287%2C114.7L154.7%2C247.1c-2.4%2C2.4-5.8%2C4.1-9.3%2C4.1s-6.9-1.7-9.3-4.1L5.4%2C114.7c-2.4-2.4-4.1-5.8-4.1-9.3s1.7-6.9%2C4.1-9.3l19.7-19.7c2.4-2.4%2C5.8-4.1%2C9.3-4.1s6.9%2C1.7%2C9.3%2C4.1L146.2%2C178.6l102.7-102.7c2.4-2.4%2C5.8-4.1%2C9.3-4.1s6.9%2C1.7%2C9.3%2C4.1l19.7%2C19.7c2.4%2C2.4%2C4.1%2C5.8%2C4.1%2C9.3S289.4%2C112.3%2C287%2C114.7z%22%2F%3E%3C%2Fsvg%3E'); /* Custom arrow */
                background-repeat: no-repeat;
                background-position: right 8px center;
                background-size: 8px;
            }
            .salesplanet-datenschutz-actions-dropdown:hover {
                filter: brightness(0.95); /* Slightly darken on hover */
            }
        `;
        if (style.styleSheet) { // For IE compatibility
            style.styleSheet.cssText = css;
        } else {
            style.appendChild(document.createTextNode(css));
        }
        document.head.appendChild(style);
        console.log("Salesplanet Copier: Injected button and dropdown hover styles.");
    }

    /**
     * Helper function to simulate input to a field and trigger change events.
     * Important for frameworks like Angular to detect changes.
     * @param {HTMLElement} element - The input element to update.
     * @param {string} value - The new value for the input.
     */
    function setInputValue(element, value) {
        if (!element) return;
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    /**
     * Helper function to simulate text input into a contenteditable div (like Quill editor).
     * @param {HTMLElement} element - The contenteditable div.
     * @param {string} text - The text to insert.
     */
    function setContentEditableText(element, text) {
        if (!element) return;

        const currentContent = element.innerHTML.trim();
        if (currentContent && currentContent !== '<p><br></p>' && currentContent !== '<p></p>') {
            element.innerHTML += `<p>${text}</p>`;
        } else {
            element.innerHTML = `<p>${text}</p>`;
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Checks if a customer's detail page is currently active in the DOM.
     * This is indicated by the presence of the <ph-customer-tab-details> element.
     * @returns {boolean} True if customer details are active, false otherwise.
     */
    function isCustomerDetailsPageActive() {
        return document.querySelector('ph-customer-tab-details') !== null;
    }

    /**
     * Hides the notification.
     * This is a helper for both auto-dismiss and click-dismiss.
     */
    function hideNotification() {
        const notificationDiv = document.getElementById('salesplanet-notification');
        if (notificationDiv) {
            notificationDiv.classList.remove('show');
            // Clear any pending auto-hide timeout if dismissed manually
            if (notificationTimeoutId) {
                clearTimeout(notificationTimeoutId);
                notificationTimeoutId = null;
            }
            // Fully hide the element after its transition to avoid taking up space
            setTimeout(() => {
                notificationDiv.style.display = 'none';
            }, 500); // Match CSS transition duration
        }
    }


    /**
     * Displays a transient notification in the bottom-right corner.
     * @param {string} message - The message to display.
     * @param {string} type - 'success', 'info', 'warning', 'error' for different styles.
     * @param {number} duration - How long the notification stays visible in ms.
     */
    function showNotification(message, type = 'info', duration = 3000) {
        let notificationDiv = document.getElementById('salesplanet-notification');
        if (!notificationDiv) {
            notificationDiv = document.createElement('div');
            notificationDiv.id = 'salesplanet-notification';
            notificationDiv.classList.add('salesplanet-notification');
            document.body.appendChild(notificationDiv);

            // Add the notification CSS once to the head
            let style = document.createElement('style');
            style.type = 'text/css';
            style.innerHTML = `
                .salesplanet-notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px; /* Changed from left to right */
                    background-color: #333;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 5px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                    z-index: 9999;
                    opacity: 0; /* Initially hidden */
                    transform: translateX(120%); /* Slide in from right */
                    transition: opacity 0.5s ease-out, transform 0.5s ease-out;
                    font-family: Arial, sans-serif; /* Or match Salesplanet's font */
                    font-size: 14px;
                    white-space: nowrap;
                    cursor: pointer; /* Indicate it's clickable */
                }
                .salesplanet-notification.show {
                    opacity: 1;
                    transform: translateX(0); /* Slide in to position */
                }
                .salesplanet-notification.success { background-color: #28a745; } /* Green */
                .salesplanet-notification.info { background-color: #17a2b8; } /* Blue */
                .salesplanet-notification.warning { background-color: #ffc107; color: #333; } /* Yellow */
                .salesplanet-notification.error { background-color: #dc3545; } /* Red */
            `;
            document.head.appendChild(style);

            // Add click listener only once when the element is created
            notificationDiv.addEventListener('click', hideNotification);
            console.log("Salesplanet Copier: Notification element created and click listener added.");
        }

        // Clear any existing timeout to prevent interference
        if (notificationTimeoutId) {
            clearTimeout(notificationTimeoutId);
            notificationTimeoutId = null;
        }

        // Clear previous classes and set new ones
        notificationDiv.className = 'salesplanet-notification'; // Reset classes
        notificationDiv.classList.add(type);
        notificationDiv.textContent = message; // Set the message text

        // Ensure it's visible for the animation
        notificationDiv.style.display = 'block';

        // Trigger the show animation
        // Use requestAnimationFrame to ensure reflow happens before applying 'show' class for transition
        requestAnimationFrame(() => {
            notificationDiv.classList.add('show');
        });

        // Set timeout to auto-hide
        notificationTimeoutId = setTimeout(hideNotification, duration);
    }

    /**
     * Scrolls the view to the Quill editor and focuses it.
     */
    function scrollToQuillEditor() {
        // Try to find the main Quill container first (often .ql-container)
        const quillContainer = document.querySelector('.ql-container');
        // The actual editable area (contenteditable div)
        const quillEditor = document.querySelector('.ql-editor');

        let targetElementForScroll = null;

        if (quillContainer) {
            targetElementForScroll = quillContainer;
            console.log('Salesplanet Copier: Found .ql-container for scrolling.');
        } else if (quillEditor) {
            targetElementForScroll = quillEditor;
            console.log('Salesplanet Copier: Found .ql-editor (fallback) for scrolling.');
        } else {
            console.warn('Salesplanet Copier: Could not find Quill editor or its container to scroll to.');
            return; // Exit if no target is found
        }

        // Use a small delay to ensure the DOM has settled after content insertion
        setTimeout(() => {
            if (targetElementForScroll) {
                targetElementForScroll.scrollIntoView({ behavior: 'smooth', block: 'start' });
                console.log('Salesplanet Copier: Scrolled view to Quill editor area.');

                // After scrolling, explicitly focus the editor
                if (quillEditor) {
                    quillEditor.focus();
                    console.log('Salesplanet Copier: Focused Quill editor.');

                    // Optional: Move cursor to the end of the content for better UX
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(quillEditor);
                    range.collapse(false); // Collapse to the end of the content
                    sel.removeAllRanges();
                    sel.addRange(range);
                    console.log('Salesplanet Copier: Placed cursor at end of Quill editor content.');
                }
            }
        }, 100); // 100ms delay
    }

    /**
     * Performs the "Sperrung" action: fills specific text into the Quill editor.
     */
    function performSperrungAction() {
        const quillEditor = document.querySelector('.ql-editor.ql-blank');
        const sperrungText = "DATENSCHUTZ: Kunde hat die Löschung/Sperrung seiner personenbezogenen Daten bei der PlanetHome Group GmbH gefordert. Der Kunde darf durch die PlanetHome Group GmbH daher nicht mehr kontaktiert werden.";
        if (!quillEditor) {
            console.error('Löschung / Sperrung: Quill editor not found!');
            showNotification('Löschung / Sperrung: Quill editor not found!', 'error');
            return;
        }
        setContentEditableText(quillEditor, sperrungText);
        console.log('Löschung / Sperrung action completed.');
        // showNotification('Löschung / Sperrung action completed!', 'success'); // Removed success notification for dropdown actions
        scrollToQuillEditor();
    }

    /**
     * Performs the "Widerruf" action: fills specific text into the Quill editor.
     */
    function performWiderrufAction() {
        const quillEditor = document.querySelector('.ql-editor.ql-blank');
        const widerrufText = "DATENSCHUTZ: Kunde hat die Einwilligung zur Weitergabe seiner / ihrer personenbezogenen Daten an Dritte am XXXX widerrufen. Kunde darf ab sofort nicht länger zu einer Finanzierungsberatung kontaktiert werden.";
        if (!quillEditor) {
            console.error('Widerruf Weitergabe Daten an Dritte: Quill editor not found!');
            showNotification('Widerruf Weitergabe Daten an Dritte: Quill editor not found!', 'error');
            return;
        }
        setContentEditableText(quillEditor, widerrufText);
        console.log('Widerruf Weitergabe Daten an Dritte action completed.');
        // showNotification('Widerruf Weitergabe Daten an Dritte action completed!', 'success'); // Removed success notification for dropdown actions
        scrollToQuillEditor();
    }


    /**
     * Attempts to add or remove a button or dropdown based on visibility requirements.
     * @param {string} type - 'name', 'email', 'customerId', 'street', 'postalCode', 'city', 'address', 'datenschutz', or 'datenschutzActionsDropdown'.
     */
    function addElement(type) { // Renamed from addButton for broader use
        let elementIdClass; // Can be a button class or dropdown class
        let requiresFlexParent = false;
        let elementText; // For buttons, this is textContent; for dropdowns, it's just a general identifier
        let copyValue = null;
        let clickAction = null; // For buttons

        // Common variables and parsing for address-related buttons
        let commonParentForAddressButtons = null;
        let streetValue = '';
        let postalCodeValue = '';
        let cityValue = '';
        let fullAddressValue = '';

        const isAddressRelatedElement = ['street', 'postalCode', 'city', 'address'].includes(type);

        if (isAddressRelatedElement) {
            const addressElement = document.getElementById('lbl-customer-address');
            if (addressElement) {
                fullAddressValue = addressElement.textContent.trim();
                const parts = fullAddressValue.split(',');
                if (parts.length > 0) {
                    streetValue = parts[0].trim();
                }
                if (parts.length > 1) {
                    const postalCodeCity = parts[1].trim();
                    const postalCityParts = postalCodeCity.split(' ', 2);
                    if (postalCityParts.length > 0) {
                        postalCodeValue = postalCityParts[0];
                    }
                    if (postalCityParts.length > 1) {
                        cityValue = postalCityParts[1];
                    }
                }

                const addressBox = addressElement.closest('ph-extra-box');
                commonParentForAddressButtons = addressBox ? addressBox.querySelector('.right-cnt') : null;
                if (commonParentForAddressButtons) {
                    // Ensure the parent is a flex container to align properly
                    if (window.getComputedStyle(commonParentForAddressButtons).display !== 'flex') {
                        commonParentForAddressButtons.style.display = 'flex';
                        commonParentForAddressButtons.style.alignItems = 'center';
                        commonParentForAddressButtons.style.gap = '5px';
                        console.log(`Debug: Applied flex styles to .right-cnt for address buttons.`);
                    }
                }
            }
        }

        let parentElementToAppendTo;
        let insertionReferenceNode = null; // Used for inserting before a specific element
        let shouldBeVisibleNow; // Visibility check depends on type

        // Determine parent element and visibility for action elements
        if (type === 'datenschutz' || type === 'datenschutzActionsDropdown') {
            const templateDiv = document.querySelector('div.template');
            const phSelectElement = templateDiv ? templateDiv.querySelector('ph-select.select-action') : null;

            if (!templateDiv || !phSelectElement) {
                console.warn(`Salesplanet Copier Debug: Target 'div.template' or 'ph-select.select-action' not found for ${type}.`);
                if (elementAddedFlags[type]) {
                    console.log(`Debug: ${type} parent not found, resetting flag.`);
                    elementAddedFlags[type] = false;
                }
                return; // Exit if the target parent or reference is not found
            }

            // Ensure the parent 'div.template' is a flex container for horizontal alignment
            if (window.getComputedStyle(templateDiv).display !== 'flex') {
                templateDiv.style.display = 'flex';
                templateDiv.style.alignItems = 'center';
                templateDiv.style.flexWrap = 'wrap'; // Allow items to wrap if space is limited
                templateDiv.style.gap = '8px'; // Add consistent spacing between items
                console.log(`Debug: Applied flex styles to div.template.`);
            }

            // Reset any old conflicting styles on the ph-select's internal divs from previous attempts
            const selectCntDiv = phSelectElement.querySelector('div.select-cnt');
            const innerSelectDiv = phSelectElement.querySelector('div.select');
            if (selectCntDiv) {
                selectCntDiv.style.padding = ''; // Reset
                selectCntDiv.style.marginTop = ''; // Reset
            }
            if (innerSelectDiv) {
                innerSelectDiv.style.display = ''; // Reset
                innerSelectDiv.style.alignItems = ''; // Reset
                innerSelectDiv.style.justifyContent = ''; // Reset
                innerSelectDiv.style.flexWrap = ''; // Reset
                innerSelectDiv.style.gap = ''; // Reset
                innerSelectDiv.style.padding = ''; // Reset
                innerSelectDiv.style.marginTop = ''; // Reset
            }
            // console.log(`Debug: Resetting old styles on internal divs of ph-select.`);

            parentElementToAppendTo = templateDiv;
            insertionReferenceNode = phSelectElement; // Insert elements *before* phSelectElement within templateDiv
            shouldBeVisibleNow = isCustomerDetailsPageActive() && areActionButtonsVisible;
        } else if (isAddressRelatedElement) {
            parentElementToAppendTo = commonParentForAddressButtons;
            shouldBeVisibleNow = true; // Copy buttons are always visible if data exists
        } else if (type === 'name' || type === 'email' || type === 'customerId') {
            const labelElement = document.querySelector(`ph-title span.title:contains("${type === 'name' ? 'Name:' : type === 'email' ? 'E-Mail:' : 'Kunden-ID:'}")`);
            parentElementToAppendTo = labelElement ? labelElement.closest('.title-wrap') : null;
            shouldBeVisibleNow = true; // Copy buttons are always visible if data exists
        } else {
            console.warn('Salesplanet Copier: Invalid element type specified:', type);
            return;
        }

        // Exit if parent element not found
        if (!parentElementToAppendTo) {
            if (elementAddedFlags[type]) {
                console.log(`Debug: ${type} parent not found, resetting flag.`);
                elementAddedFlags[type] = false;
            }
            return;
        }

        // --- Handle specific element types ---
        if (type === 'datenschutz') {
            elementIdClass = 'salesplanet-datenschutz-button';
            elementText = 'Datenschutz';
            clickAction = function() {
                const emailInputs = document.querySelectorAll('input[id^="txt-contact-email-address-"]');
                const phoneInputs = document.querySelectorAll('input[id^="txt-contact-phone-number-"]');
                const quillEditor = document.querySelector('.ql-editor.ql-blank');

                let emailsToCopy = [];
                emailInputs.forEach(input => {
                    const val = input.value.trim();
                    if (val) emailsToCopy.push(val);
                });

                let phonesToCopy = [];
                phoneInputs.forEach(input => {
                    const val = input.value.trim();
                    if (val) phonesToCopy.push(val);
                });

                if (!quillEditor) {
                    console.error('Datenschutz: Quill editor not found!');
                    showNotification('Datenschutz: Quill editor not found!', 'error');
                    return;
                }

                if (emailsToCopy.length > 0) {
                    setContentEditableText(quillEditor, emailsToCopy.join(', '));
                }
                if (phonesToCopy.length > 0) {
                    setTimeout(() => {
                        setContentEditableText(quillEditor, phonesToCopy.join(', '));
                    }, emailsToCopy.length > 0 ? 50 : 0);
                }

                emailInputs.forEach(input => { setInputValue(input, 'nn@nn.de'); });
                phoneInputs.forEach(input => { setInputValue(input, '0'); });
                console.log('Datenschutz action completed for all relevant fields.');
                // showNotification('Datenschutz action completed!', 'success'); -------------- Notification removed because it just adds another useles click -- can be always reactivated //
                scrollToQuillEditor();
            };

            const existingButtonInDom = parentElementToAppendTo.querySelector(`.${elementIdClass}`);

            if (shouldBeVisibleNow && !existingButtonInDom) {
                const newButton = document.createElement('button');
                newButton.textContent = elementText;
                newButton.classList.add(elementIdClass);

                // Apply common button styles
                newButton.style.color = 'white';
                newButton.style.border = 'none';
                newButton.style.borderRadius = '4px';
                newButton.style.cursor = 'pointer';
                newButton.style.fontSize = '12px';
                newButton.style.whiteSpace = 'nowrap';
                newButton.style.flexShrink = '0';
                newButton.style.backgroundColor = '#AF3E3E'; // Specific color for Datenschutz
                newButton.style.padding = '9px'; // Explicitly set padding
                newButton.style.marginTop = '-7px'; // Explicitly set top-margin

                newButton.addEventListener('click', clickAction);

                // Insert before the phSelectElement (insertionReferenceNode)
                if (insertionReferenceNode && parentElementToAppendTo.contains(insertionReferenceNode)) {
                    parentElementToAppendTo.insertBefore(newButton, insertionReferenceNode);
                    console.log(`Debug: Inserted ${type} button before ph-select within templateDiv.`);
                } else {
                    parentElementToAppendTo.appendChild(newButton); // Fallback append
                    console.warn(`Debug: Insertion reference node for ${type} not found, appended to templateDiv instead.`);
                }

                elementAddedFlags[type] = true;
                console.log(`Salesplanet Copier: '${type}' button added.`);

            } else if (!shouldBeVisibleNow && existingButtonInDom) {
                existingButtonInDom.remove();
                elementAddedFlags[type] = false;
                console.log(`Salesplanet Copier: Removed '${type}' button.`);
            } else {
                if (shouldBeVisibleNow && existingButtonInDom) {
                    if (!elementAddedFlags[type]) console.log(`Debug: ${type} button re-detected in DOM, setting flag to true.`);
                    elementAddedFlags[type] = true;
                }
            }

        } else if (type === 'datenschutzActionsDropdown') {
            elementIdClass = 'salesplanet-datenschutz-actions-dropdown';
            const existingDropdownInDom = parentElementToAppendTo.querySelector(`.${elementIdClass}`);

            if (shouldBeVisibleNow && !existingDropdownInDom) {
                const newDropdown = document.createElement('select');
                newDropdown.classList.add(elementIdClass);
                // Styles are now primarily handled by the addHoverStyles function via CSS class.
                // Removed newDropdown.style.padding = '9px'; to avoid inline style conflict.
                newDropdown.style.marginTop = '-7px'; // Keep specific inline styles not managed by class for now
                newDropdown.style.fontSize = '12px';
                newDropdown.style.border = '1px solid #ccc';
                newDropdown.style.borderRadius = '4px';
                newDropdown.style.backgroundColor = '#f8f9fa';
                newDropdown.style.color = '#333';
                newDropdown.style.cursor = 'pointer';
                newDropdown.style.flexShrink = '0';


                // Add options
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'DSGVO Grund';
                newDropdown.appendChild(defaultOption);

                const sperrungOption = document.createElement('option');
                sperrungOption.value = 'sperrung';
                sperrungOption.textContent = 'Löschung / Sperrung'; // Updated text here
                newDropdown.appendChild(sperrungOption);

                const widerrufOption = document.createElement('option');
                widerrufOption.value = 'widerruf';
                widerrufOption.textContent = 'Widerruf Weitergabe Daten an Dritte'; // Updated text here
                newDropdown.appendChild(widerrufOption);

                newDropdown.addEventListener('change', function() {
                    const selectedValue = this.value;
                    if (selectedValue === 'sperrung') {
                        performSperrungAction();
                    } else if (selectedValue === 'widerruf') {
                        performWiderrufAction();
                    }
                    // Reset dropdown to default option after action
                    this.value = '';
                });

                const datenschutzButton = parentElementToAppendTo.querySelector('.salesplanet-datenschutz-button');
                if (datenschutzButton && datenschutzButton.parentElement === parentElementToAppendTo) {
                    parentElementToAppendTo.insertBefore(newDropdown, datenschutzButton.nextSibling);
                    console.log('Salesplanet Copier: Inserted dropdown after Datenschutz button.');
                } else {
                    parentElementToAppendTo.insertBefore(newDropdown, insertionReferenceNode);
                    console.log('Salesplanet Copier: Inserted dropdown before ph-select element (fallback).');
                }

                elementAddedFlags[type] = true;
                console.log('Salesplanet Copier: Datenschutz Actions Dropdown added.');

            } else if (!shouldBeVisibleNow && existingDropdownInDom) {
                existingDropdownInDom.remove();
                elementAddedFlags[type] = false;
                console.log(`Salesplanet Copier: Removed '${type}' dropdown.`);
            } else {
                 if (shouldBeVisibleNow && existingDropdownInDom) {
                    if (!elementAddedFlags[type]) console.log(`Debug: ${type} dropdown re-detected in DOM, setting flag to true.`);
                    elementAddedFlags[type] = true;
                }
            }

            // Ensure old individual buttons are removed if they somehow persist
            const oldSperrungBtn = parentElementToAppendTo.querySelector('.salesplanet-sperrung-button');
            if (oldSperrungBtn) oldSperrungBtn.remove();
            const oldWiderrufBtn = parentElementToAppendTo.querySelector('.salesplanet-widerruf-button');
            if (oldWiderrufBtn) oldWiderrufBtn.remove();


        } else { // Handle copy buttons
            // Determine button specifics based on type
            let buttonIdClass;
            if (type === 'name') {
                buttonIdClass = 'salesplanet-copy-name-button';
                elementText = 'Copy Name';
                requiresFlexParent = true;
                const valueElement = document.querySelector('ph-text.ph-bold-text-size-xl.ph-text-weight-light .bold-text');
                if (valueElement) copyValue = valueElement.textContent.trim();
            } else if (type === 'email') {
                buttonIdClass = 'salesplanet-copy-email-button';
                elementText = 'Copy E-Mail';
                requiresFlexParent = true;
                const valueElement = document.getElementById('lbl-customer-email');
                if (valueElement) copyValue = valueElement.querySelector('a') ? valueElement.querySelector('a').textContent.trim() : valueElement.textContent.trim();
            } else if (type === 'customerId') {
                buttonIdClass = 'salesplanet-copy-customer-id-button';
                elementText = 'Copy ID';
                requiresFlexParent = true;
                const valueElement = document.getElementById('lbl-public-customer-id');
                if (valueElement) copyValue = valueElement.textContent.trim();
            } else if (type === 'street') {
                buttonIdClass = 'salesplanet-copy-street-button';
                elementText = 'Copy Street';
                copyValue = streetValue;
            } else if (type === 'postalCode') {
                buttonIdClass = 'salesplanet-copy-postal-code-button';
                elementText = 'Copy Postal Code';
                copyValue = postalCodeValue;
            } else if (type === 'city') {
                buttonIdClass = 'salesplanet-copy-city-button';
                elementText = 'Copy City';
                copyValue = cityValue;
            } else if (type === 'address') {
                buttonIdClass = 'salesplanet-copy-address-button';
                elementText = 'Copy Address';
                copyValue = fullAddressValue;
            }

            // Exit if no copy value is present for copy buttons
            if (copyValue === null) {
                if (elementAddedFlags[type]) {
                    console.log(`Debug: ${type} copy value not found, resetting flag.`);
                    elementAddedFlags[type] = false;
                }
                return;
            }

            const existingButtonInDom = parentElementToAppendTo.querySelector(`.${buttonIdClass}`);

            if (shouldBeVisibleNow && !existingButtonInDom) {
                const newButton = document.createElement('button');
                newButton.textContent = elementText;
                newButton.classList.add(buttonIdClass);

                // Apply common button styles
                newButton.style.color = 'white';
                newButton.style.border = 'none';
                newButton.style.borderRadius = '4px';
                newButton.style.cursor = 'pointer';
                newButton.style.fontSize = '12px';
                newButton.style.whiteSpace = 'nowrap';
                newButton.style.flexShrink = '0';
                newButton.style.backgroundColor = '#007bff'; // Default for copy buttons

                if (isAddressRelatedElement) {
                    newButton.style.marginRight = '5px';
                } else if (type === 'name' || type === 'email' || type === 'customerId') {
                    newButton.style.marginLeft = 'auto'; // These buttons still go to the far right of their parent
                }

                newButton.addEventListener('click', function() {
                    GM_setClipboard(copyValue);
                    const originalText = newButton.textContent;
                    const originalBg = newButton.style.backgroundColor;
                    newButton.textContent = 'Copied!';
                    newButton.style.backgroundColor = '#28a745';
                    setTimeout(() => {
                        newButton.textContent = originalText;
                        newButton.style.backgroundColor = originalBg;
                    }, 1500);
                });

                if (requiresFlexParent && window.getComputedStyle(parentElementToAppendTo).display !== 'flex') {
                    parentElementToAppendTo.style.display = 'flex';
                    parentElementToAppendTo.style.alignItems = 'center';
                    // Only apply justifyContent for specific parents that need it (e.g., top right)
                    if (parentElementToAppendTo.matches('ph-tabs .tabs.clear-after') || parentElementToAppendTo.matches('.title-wrap')) {
                        parentElementToAppendTo.style.justifyContent = 'space-between';
                    } else {
                        parentElementToAppendTo.style.justifyContent = ''; // Clear if not needed
                    }
                    console.log(`Debug: Applied flex styles to parent for ${type}.`);
                }
                parentElementToAppendTo.appendChild(newButton);

                elementAddedFlags[type] = true;
                console.log(`Salesplanet Copier: '${type}' button added.`);

            } else if (!shouldBeVisibleNow && existingButtonInDom) {
                existingButtonInDom.remove();
                elementAddedFlags[type] = false;
                console.log(`Salesplanet Copier: Removed '${type}' button.`);

            } else {
                if (shouldBeVisibleNow && existingButtonInDom) {
                    if (!elementAddedFlags[type]) console.log(`Debug: ${type} button re-detected in DOM, setting flag to true.`);
                    elementAddedFlags[type] = true;
                }
            }
        }
    }

    /**
     * Helper function to update the button's appearance (text and background color).
     * @param {HTMLElement} button - The toggle button element.
     */
    function updateToggleButtonAppearance(button) {
        if (areActionButtonsVisible) {
            button.textContent = 'Datenschutz On';
            button.style.backgroundColor = '#AF3E3E'; // Red when active (buttons visible)
        } else {
            button.textContent = 'Datenschutz Off';
            button.style.backgroundColor = '#6c757d'; // Gray when inactive (buttons hidden)
        }
    }

    /**
     * Creates and places the toggle button for action elements.
     */
    function createActionButtonToggle() {
        const localesSwitchDiv = document.querySelector('div.locales-switch');

        if (!localesSwitchDiv) {
            const existingButton = document.querySelector('.salesplanet-action-toggle');
            if (existingButton) {
                existingButton.remove();
                console.log("Salesplanet Copier: Removed existing toggle button as placement target not found.");
            }
            return;
        }

        // 1. Ensure localesSwitchDiv is a flex container and stacks its direct children vertically
        if (window.getComputedStyle(localesSwitchDiv).display !== 'flex' ||
            window.getComputedStyle(localesSwitchDiv).flexDirection !== 'column') {
            localesSwitchDiv.style.display = 'flex';
            localesSwitchDiv.style.flexDirection = 'column';
            localesSwitchDiv.style.alignItems = 'center'; // Center the items horizontally within the column
            localesSwitchDiv.style.gap = '5px'; // Space between the horizontal links wrapper and the button
            console.log("Debug: Applied flex column styles to .locales-switch.");
        }

        // 2. Manage the horizontal links wrapper (to keep EN DE AT horizontal)
        let localesLinksWrapper = localesSwitchDiv.querySelector('.salesplanet-locales-wrapper');

        if (!localesLinksWrapper) {
            localesLinksWrapper = document.createElement('div');
            localesLinksWrapper.classList.add('salesplanet-locales-wrapper');
            localesLinksWrapper.style.display = 'flex';
            localesLinksWrapper.style.flexDirection = 'row'; // Make the links themselves horizontal
            localesLinksWrapper.style.gap = '0px'; // SET ROW GAP TO 0PX FOR LINKS
            localesLinksWrapper.style.padding = '0'; // Ensure no extra padding
            localesLinksWrapper.style.margin = '0'; // Ensure no extra margin

            // Move existing locale links into the new wrapper
            // Query all 'a.locale' children directly within localesSwitchDiv
            const localeLinks = Array.from(localesSwitchDiv.querySelectorAll(':scope > a.locale'));
            if (localeLinks.length > 0) {
                localeLinks.forEach(link => localesLinksWrapper.appendChild(link));
                console.log("Debug: Moved locale links into new horizontal wrapper.");
            }
            localesSwitchDiv.prepend(localesLinksWrapper); // Add wrapper as the first child of localesSwitchDiv
            console.log("Debug: Created and prepended .salesplanet-locales-wrapper.");
        }


        // 3. Manage the toggle button
        let toggleButton = document.querySelector('.salesplanet-action-toggle');

        if (!toggleButton) {
            toggleButton = document.createElement('button');
            toggleButton.classList.add('salesplanet-action-toggle');
            // Apply common button styles here (once)
            toggleButton.style.padding = '4px 8px';
            toggleButton.style.fontSize = '10px';
            toggleButton.style.color = 'white';
            toggleButton.style.border = 'none';
            toggleButton.style.borderRadius = '3px';
            toggleButton.style.cursor = 'pointer';
            toggleButton.style.whiteSpace = 'nowrap';
            toggleButton.style.flexShrink = '0';
            // Removed margin-top as gap on parent (localesSwitchDiv) will handle spacing

            toggleButton.addEventListener('click', () => {
                areActionButtonsVisible = !areActionButtonsVisible; // Toggle the state
                GM_setValue('salesplanet_action_buttons_visible', areActionButtonsVisible); // Save the state
                console.log(`Salesplanet Copier: Action elements visibility toggled to ${areActionButtonsVisible}`);
                manageActionElementsVisibility(); // Re-evaluate and update action element visibility
                updateToggleButtonAppearance(toggleButton); // Update the toggle button's appearance immediately
            });
        }

        // Update button text and color based on current state (important for initial load and after toggle)
        updateToggleButtonAppearance(toggleButton);

        // Ensure the toggle button is the last child of localesSwitchDiv
        // This ensures it stays underneath the wrapper of horizontal links
        if (toggleButton.parentElement !== localesSwitchDiv ||
            localesSwitchDiv.lastElementChild !== toggleButton) { // Check if it's the last child
            localesSwitchDiv.appendChild(toggleButton); // Append the button as the last child
            console.log("Salesplanet Copier: Action button toggle placed/re-placed inside locales switch, at the bottom.");
        } else {
            // console.log("Salesplanet Copier: Action button toggle already correctly placed.");
        }
    }

    /**
     * Manages the visibility of the "Datenschutz" button and the new dropdown.
     */
    function manageActionElementsVisibility() {
        // These calls to addElement will now re-evaluate their visibility based on `isCustomerDetailsPageActive()` AND `areActionButtonsVisible`
        addElement('datenschutz');
        addElement('datenschutzActionsDropdown');
    }


    // --- Polyfills for :contains, matches, closest ---
    (function() {
        if (!Element.prototype.matches) {
            Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
        }
        if (!Element.prototype.closest) {
            Element.prototype.closest = function(s) {
                let el = this;
                do {
                    if (el.matches(s)) return el;
                    el = el.parentElement || el.parentNode;
                } while (el !== null && el.nodeType === 1);
                return null;
            };
        }
        const originalQuerySelector = Document.prototype.querySelector;
        const originalQuerySelectorAll = Document.prototype.querySelectorAll;

        Document.prototype.querySelector = function(selector) {
            if (selector.includes(':contains(')) {
                const parts = selector.split(':contains(');
                const baseSelector = parts[0].trim();
                const searchText = parts[1].slice(0, -1).trim().replace(/['"]/g, '');
                const elements = this.querySelectorAll(baseSelector);
                for (const el of elements) {
                    if (el.textContent.includes(searchText)) {
                        return el;
                    }
                }
                return null;
            }
            return originalQuerySelector.call(this, selector);
        };

        Document.prototype.querySelectorAll = function(selector) {
            if (selector.includes(':contains(')) {
                const parts = selector.split(':contains(');
                const baseSelector = parts[0].trim();
                const searchText = parts[1].slice(0, -1).trim().replace(/['']/g, '');
                const elements = Array.from(this.querySelectorAll(baseSelector));
                return elements.filter(el => el.textContent.includes(searchText));
            }
            return originalQuerySelectorAll.call(this, selector);
        };
    })();

    // --- Strategy 1: MutationObserver for dynamic content ---
    const observer = new MutationObserver((mutationsList, observer) => {
        let relevantDomChange = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                const changedNodes = Array.from(mutation.addedNodes).concat(Array.from(mutation.removedNodes));
                for (const node of changedNodes) {
                    if (node.nodeType === 1) {
                        // Include the relevant elements for observation
                        if (node.matches('.form-header, ph-box, ph-tabs, ph-customer-tab-details, ph-extra-box, div.template, ph-select.select-action, div.locales-switch, .ql-container, .ql-editor') ||
                            node.querySelector('.form-header, ph-box, ph-tabs, ph-customer-tab-details, ph-extra-box, div.template, ph-select.select-action, div.locales-switch, .ql-container, .ql-editor') ||
                            node.closest('.form-header, ph-box, ph-tabs, ph-customer-tab-details, ph-extra-box, div.template, ph-select.select-action, div.locales-switch, .ql-container, .ql-editor')
                           ) {
                            relevantDomChange = true;
                            break;
                        }
                    }
                }
            }
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                 relevantDomChange = true;
            }
            if (relevantDomChange) break;
        }

        if (relevantDomChange || window.location.href !== observer.lastKnownUrl) {
            console.log("Debug: Relevant DOM/URL change detected by Observer. Re-checking all elements.");
            observer.lastKnownUrl = window.location.href;

            // Always try to create the toggle button when relevant DOM changes
            createActionButtonToggle();

            // Step 1: Attempt to remove the native Map Directions button
            const mapDirectionsNativeButton = document.querySelector('ph-button .mi-MapDirections');
            if (mapDirectionsNativeButton) {
                const mapBtnToRemove = mapDirectionsNativeButton.closest('ph-button');
                if (mapBtnToRemove) {
                    mapBtnToRemove.remove();
                    console.log('Salesplanet Copier: Removed Map Directions button via Observer.');
                }
            }

            // Step 2: Add our custom copy buttons (always active if data exists)
            addElement('address');
            addElement('street');
            addElement('postalCode');
            addElement('city');

            addElement('name');
            addElement('email');
            addElement('customerId');

            // Step 3: Manage action elements visibility based on toggle state and page activity
            manageActionElementsVisibility();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });


    // --- Strategy 2: Fallback Polling (Interval) ---
    const checkInterval = setInterval(() => {
        // Always try to create the toggle button
        createActionButtonToggle();

        // Step 1: Attempt to remove the native Map Directions button
        const mapDirectionsNativeButton = document.querySelector('ph-button .mi-MapDirections');
        if (mapDirectionsNativeButton) {
            const mapBtnToRemove = mapDirectionsNativeButton.closest('ph-button');
            if (mapBtnToRemove) {
                mapBtnToRemove.remove();
                console.log('Salesplanet Copier: Removed Map Directions button via Interval.');
            }
        }

        // Step 2: Add our custom copy buttons
        // It's safe to call these repeatedly as addElement is idempotent (manages its own state).
        if (!elementAddedFlags.address) addElement('address');
        if (!elementAddedFlags.street) addElement('street');
        if (!elementAddedFlags.postalCode) addElement('postalCode');
        if (!elementAddedFlags.city) addElement('city');

        if (!elementAddedFlags.name) addElement('name');
        if (!elementAddedFlags.email) addElement('email');
        if (!elementAddedFlags.customerId) addElement('customerId');

        // Step 3: Manage action elements visibility
        manageActionElementsVisibility(); // This will handle adding/removing based on toggle and page active state

    }, 500);

    // Initializations on page load
    console.log("Debug: Initial page load check.");
    addHoverStyles(); // Ensure hover styles are injected early

    // Initial check for native Map Directions button
    const mapDirectionsNativeButtonInitial = document.querySelector('ph-button .mi-MapDirections');
    if (mapDirectionsNativeButtonInitial) {
        const mapBtnToRemoveInitial = mapDirectionsNativeButtonInitial.closest('ph-button');
        if (mapBtnToRemoveInitial) {
            mapBtnToRemoveInitial.remove();
            console.log('Salesplanet Copier: Removed Map Directions button on initial load.');
        }
    }

    // Initial creation of toggle button and management of action elements
    createActionButtonToggle();
    manageActionElementsVisibility();
    addElement('address');
    addElement('street');
    addElement('postalCode');
    addElement('city');
    addElement('name');
    addElement('email');
    addElement('customerId');

})();
