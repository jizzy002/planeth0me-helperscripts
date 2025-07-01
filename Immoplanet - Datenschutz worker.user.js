// ==UserScript==
// @name         Immoplanet - Datenschutz worker
// @namespace    http://tampermonkey.net/
// @version      0.12
// @description  Adds "Datenschutz" and "Weitergabe an Dritte" buttons with specific colors and hover effects to fill fields and notes on mak.planethome.de. Includes scroll to notes for F-Leads.
// @author       aldjan
// @match        https://mak.planethome.de/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Helper Function for Input/Change Events ---
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
        element.dispatchEvent(new Event('blur', { bubbles: true })); // blur can also be important
        console.log(`Set value for ${element.id || element.name || 'unknown'}: ${value}`);
    }

    /**
     * Helper function to set checkbox state and trigger change events.
     * @param {HTMLInputElement} checkboxElement - The checkbox element.
     * @param {boolean} checkedState - true to check, false to uncheck.
     */
    function setCheckboxState(checkboxElement, checkedState) {
        if (!checkboxElement) return;
        if (checkboxElement.checked !== checkedState) {
            checkboxElement.checked = checkedState;
            checkboxElement.dispatchEvent(new Event('input', { bubbles: true })); // 'input' for checkbox value change
            checkboxElement.dispatchEvent(new Event('change', { bubbles: true })); // 'change' for checkbox state change
            console.log(`Set checkbox ${checkboxElement.id} to ${checkedState}`);
        } else {
            console.log(`Checkbox ${checkboxElement.id} already in desired state (${checkedState}).`);
        }
    }

    /**
     * Function to add CSS styles for button hover effects.
     * This is called once at the start to inject the styles.
     */
    function addHoverStyles() {
        let style = document.createElement('style');
        style.type = 'text/css';
        let css = `
            /* Target specific buttons for hover effect */
            #mak-objekttipp-datenschutz-button:hover,
            #mak-flead-datenschutz-button:hover,
            #mak-objekttipp-weitergabe-button:hover, /* New button hover */
            #mak-flead-weitergabe-button:hover /* New button hover */
            {
                filter: brightness(0.9); /* Darken by 10% */
                transition: filter 0.2s ease-in-out; /* Smooth transition */
            }
        `;
        if (style.styleSheet) { // For IE compatibility
            style.styleSheet.cssText = css;
        } else {
            style.appendChild(document.createTextNode(css));
        }
        document.head.appendChild(style);
        console.log("MAK Script: Injected button hover styles.");
    }

    /**
     * Helper function to scroll to a specific field.
     * @param {string} fieldId - The ID of the HTML element to scroll to.
     */
    function scrollToField(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log(`MAK Script: Scrolled to field: ${fieldId}`);
        } else {
            console.warn(`MAK Script: Field with ID '${fieldId}' not found for scrolling.`);
        }
    }

    // --- Common Constants ---
    const STATIC_DATENSCHUTZ_TEXT = 'DATENSCHUTZ: Kunde hat die Löschung/Sperrung seiner personenbezogenen Daten bei der PlanetHome Group GmbH gefordert. Der Kunde darf durch die PlanetHome Group GmbH daher nicht mehr kontaktiert werden.';
    const STATIC_WEITERGABE_TEXT = 'DATENSCHUTZ: Kunde hat die Einwilligung zur Weitergabe seiner / ihrer personenbezogenen Daten an Dritte am XXXX widerrufen. Kunde darf ab sofort nicht länger zu einer Finanzierungsberatung kontaktiert werden.';

    const COMMON_BUTTON_STYLE = `
        padding: 3px 8px;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        white-space: nowrap;
        margin-left: 10px;
    `;

    const DATENSCHUTZ_BUTTON_COLOR = '#AF3E3E'; // Reddish color
    const WEITERGABE_BUTTON_COLOR = 'rgb(141, 141, 141)'; // New gray color

    // --- Objekttipp Specific Configuration ---
    const OBJEKTTIPP_URL_PATH = '/immoplanet/views/tips'; // Confirmed URL path
    const OBJEKTTIPP_EMAIL_FIELD_ID = 'tipDetailsForm:contentInner:doubleColumn:ownerEmail:editableText';
    const OBJEKTTIPP_PHONE_FIELD_IDS = [
        'tipDetailsForm:contentInner:doubleColumn:ownerPhone1:editableText',
        'tipDetailsForm:contentInner:doubleColumn:ownerPhone2:editableText',
        'tipDetailsForm:contentInner:doubleColumn:ownerMobilePhone:editableText'
    ];
    const OBJEKTTIPP_TICK_EMAIL_CHECKBOX_ID = 'tipDetailsForm:contentInner:doubleColumn:automatedEmailsCheckBox:checkbox';
    const OBJEKTTIPP_UNTICK_COOP_CHECKBOX_ID = 'tipDetailsForm:contentInner:doubleColumn:ownerAgreeToCoopForwardCheckbox:checkbox';
    const OBJEKTTIPP_NOTES_TEXTAREA_ID = 'tipDetailsForm:contentInner:doubleColumn:tipReminderBS:editableText';
    const OBJEKTTIPP_BUTTON_TEXT = 'Datenschutz';
    const OBJEKTTIPP_WEITERGABE_BUTTON_TEXT = 'Weitergabe an Dritte'; // Text for the new button
    const OBJEKTTIPP_BUTTON_PLACEMENT_TARGET_ID = 'tipDetailsForm:contentInner:wizMenuButton';

    /**
     * Logic for Objekttipp pages.
     */
    function fillObjekttippDatenschutzFields() {
        console.log('MAK Script: Running Objekttipp Datenschutz actions.');

        // --- Capture Original Values First ---
        const originalEmail = document.getElementById(OBJEKTTIPP_EMAIL_FIELD_ID)?.value.trim() || '';
        const originalPhones = OBJEKTTIPP_PHONE_FIELD_IDS.map(id => {
            return document.getElementById(id)?.value.trim() || '';
        }).filter(val => val !== ''); // Filter out empty phone numbers

        let contactInfoString = '';
        if (originalEmail || originalPhones.length > 0) {
            const parts = [];
            if (originalEmail) parts.push(originalEmail);
            if (originalPhones.length > 0) parts.push(...originalPhones);
            contactInfoString = `(${parts.join(', ')})`;
        } else {
            contactInfoString = `()`;
        }

        // --- Perform Actions ---

        // 1. Fill Email Field
        const emailField = document.getElementById(OBJEKTTIPP_EMAIL_FIELD_ID);
        if (emailField) {
            setInputValue(emailField, 'nn@nn.de');
        } else {
            console.warn(`MAK Script (Objekttipp): Email field with ID '${OBJEKTTIPP_EMAIL_FIELD_ID}' not found.`);
        }

        // 2. Fill Phone Fields
        OBJEKTTIPP_PHONE_FIELD_IDS.forEach(id => {
            const phoneField = document.getElementById(id);
            if (phoneField) {
                setInputValue(phoneField, '0');
            } else {
                console.warn(`MAK Script (Objekttipp): Phone field with ID '${id}' not found.`);
            }
        });

        // 3. Manage Checkboxes
        const tickEmailCheckbox = document.getElementById(OBJEKTTIPP_TICK_EMAIL_CHECKBOX_ID);
        if (tickEmailCheckbox) {
            setCheckboxState(tickEmailCheckbox, true); // Ensure it's ticked
        } else {
            console.warn(`MAK Script (Objekttipp): Checkbox with ID '${OBJEKTTIPP_TICK_EMAIL_CHECKBOX_ID}' not found.`);
        }

        const untickCoopCheckbox = document.getElementById(OBJEKTTIPP_UNTICK_COOP_CHECKBOX_ID);
        if (untickCoopCheckbox) {
            setCheckboxState(untickCoopCheckbox, false); // Ensure it's unticked
        } else {
            console.warn(`MAK Script (Objekttipp): Checkbox with ID '${OBJEKTTIPP_UNTICK_COOP_CHECKBOX_ID}' not found.`);
        }

        // 4. Paste Formatted Data into Notes Textarea
        const notesTextarea = document.getElementById(OBJEKTTIPP_NOTES_TEXTAREA_ID);
        if (notesTextarea) {
            const finalNotesText = `${STATIC_DATENSCHUTZ_TEXT}\n\n${contactInfoString}`;
            setInputValue(notesTextarea, finalNotesText);
        } else {
            console.warn(`MAK Script (Objekttipp): Notes textarea with ID '${OBJEKTTIPP_NOTES_TEXTAREA_ID}' not found.`);
        }

        console.log('MAK Script (Objekttipp): All Datenschutz actions completed.');
    }

    /**
     * Performs the "Weitergabe an Dritte" action for Objekttipp or F-Lead pages.
     */
    function performWeitergabeAction(pageType) {
        console.log(`MAK Script: Running ${pageType} "Weitergabe an Dritte" action.`);

        let notesTextareaId;
        if (pageType === 'objekttipp') {
            notesTextareaId = OBJEKTTIPP_NOTES_TEXTAREA_ID;
        } else if (pageType === 'flead') {
            notesTextareaId = F_LEAD_NOTES_TEXTAREA_ID;
        } else {
            console.error(`MAK Script: Unknown page type for Weitergabe action: ${pageType}`);
            return;
        }

        const notesTextarea = document.getElementById(notesTextareaId);
        if (!notesTextarea) {
            console.warn(`MAK Script (${pageType}): Notes textarea with ID '${notesTextareaId}' not found for Weitergabe action.`);
            return;
        }

        // Use STATIC_WEITERGABE_TEXT directly without replacing XXXX
        const weitergabeText = STATIC_WEITERGABE_TEXT;

        // Append to existing notes, adding a newline for separation if content exists
        const currentNotes = notesTextarea.value.trim();
        const newNotesValue = currentNotes ? `${currentNotes}\n\n${weitergabeText}` : weitergabeText;

        setInputValue(notesTextarea, newNotesValue);

        // Scroll to the notes field only for F-Lead after this action
        if (pageType === 'flead') {
            scrollToField(F_LEAD_NOTES_TEXTAREA_ID);
        }

        console.log(`MAK Script (${pageType}): "Weitergabe an Dritte" action completed.`);
    }

    /**
     * Adds the "Datenschutz" and "Weitergabe an Dritte" buttons for Objekttipps.
     */
    function addObjekttippDatenschutzButtons() {
        const targetElement = document.getElementById(OBJEKTTIPP_BUTTON_PLACEMENT_TARGET_ID);
        const existingDatenschutzButton = document.getElementById('mak-objekttipp-datenschutz-button');
        const existingWeitergabeButton = document.getElementById('mak-objekttipp-weitergabe-button');

        let buttonsAdded = false;

        if (targetElement) {
            // Add Datenschutz button if it doesn't exist
            if (!existingDatenschutzButton) {
                const datenschutzButton = document.createElement('button');
                datenschutzButton.id = 'mak-objekttipp-datenschutz-button';
                datenschutzButton.textContent = OBJEKTTIPP_BUTTON_TEXT;
                datenschutzButton.type = 'button';
                datenschutzButton.style.cssText = `${COMMON_BUTTON_STYLE} background-color: ${DATENSCHUTZ_BUTTON_COLOR};`;
                datenschutzButton.addEventListener('click', fillObjekttippDatenschutzFields);

                targetElement.parentNode.insertBefore(datenschutzButton, targetElement.nextSibling);
                console.log('MAK Script: "Datenschutz" button for Objekttipp added.');
                buttonsAdded = true;
            }

            // Add Weitergabe an Dritte button if it doesn't exist
            if (!existingWeitergabeButton) {
                const weitergabeButton = document.createElement('button');
                weitergabeButton.id = 'mak-objekttipp-weitergabe-button';
                weitergabeButton.textContent = OBJEKTTIPP_WEITERGABE_BUTTON_TEXT;
                weitergabeButton.type = 'button';
                weitergabeButton.style.cssText = `${COMMON_BUTTON_STYLE} background-color: ${WEITERGABE_BUTTON_COLOR};`; // Apply specific color
                weitergabeButton.addEventListener('click', () => performWeitergabeAction('objekttipp'));

                // Insert after the Datenschutz button, or after targetElement if Datenschutz not present
                const referenceNode = document.getElementById('mak-objekttipp-datenschutz-button') || targetElement;
                if (referenceNode && referenceNode.nextSibling) {
                     targetElement.parentNode.insertBefore(weitergabeButton, referenceNode.nextSibling);
                } else if (referenceNode) {
                     targetElement.parentNode.appendChild(weitergabeButton); // Fallback if no nextSibling
                }

                console.log('MAK Script: "Weitergabe an Dritte" button for Objekttipp added.');
                buttonsAdded = true;
            }
        }
        return buttonsAdded;
    }


    // --- F-Lead Specific Configuration ---
    const F_LEAD_URL_PATH = '/immoplanet/views/leads'; // Confirmed URL path
    const F_LEAD_EMAIL_FIELD_SELECTOR = 'input[placeholder="E-Mail"]'; // Using placeholder due to dynamic ID
    const F_LEAD_PHONE_FIELD_ID = 'leadEditForm:contentInner:doubleColumn:phone:inputText';
    const F_LEAD_NOTES_TEXTAREA_ID = 'leadEditForm:contentInner:doubleColumn:textArea:editableText';
    const F_LEAD_BUTTON_TEXT = 'Datenschutz';
    const F_LEAD_WEITERGABE_BUTTON_TEXT = 'Weitergabe an Dritte'; // Text for the new button
    const F_LEAD_BUTTON_PLACEMENT_TARGET_ID = 'leadEditForm:contentInner:wizMenuButton';

    /**
     * Logic for F-Lead pages.
     */
    function fillFLeadDatenschutzFields() {
        console.log('MAK Script: Running F-Lead Datenschutz actions.');

        // --- Capture Original Values First ---
        // For F-Lead Email, use the placeholder selector
        const originalEmailField = document.querySelector(F_LEAD_EMAIL_FIELD_SELECTOR);
        const originalEmail = originalEmailField?.value.trim() || '';

        const originalPhone = document.getElementById(F_LEAD_PHONE_FIELD_ID)?.value.trim() || '';

        let contactInfoString = '';
        if (originalEmail || originalPhone) {
            const parts = [];
            if (originalEmail) parts.push(originalEmail);
            if (originalPhone) parts.push(originalPhone);
            contactInfoString = `(${parts.join(', ')})`;
        } else {
            contactInfoString = `()`;
        }

        // --- Perform Actions ---

        // 1. Fill Email Field
        if (originalEmailField) {
            setInputValue(originalEmailField, 'nn@nn.de');
        } else {
            console.warn(`MAK Script (F-Lead): Email field with selector '${F_LEAD_EMAIL_FIELD_SELECTOR}' not found.`);
        }

        // 2. Fill Phone Field
        const phoneField = document.getElementById(F_LEAD_PHONE_FIELD_ID);
        if (phoneField) {
            setInputValue(phoneField, '0');
        } else {
            console.warn(`MAK Script (F-Lead): Phone field with ID '${F_LEAD_PHONE_FIELD_ID}' not found.`);
        }

        // 3. No Checkboxes for F-Leads (as per confirmation)

        // 4. Paste Formatted Data into Notes Textarea
        const notesTextarea = document.getElementById(F_LEAD_NOTES_TEXTAREA_ID);
        if (notesTextarea) {
            const finalNotesText = `${STATIC_DATENSCHUTZ_TEXT}\n\n${contactInfoString}`;
            setInputValue(notesTextarea, finalNotesText);
        } else {
            console.warn(`MAK Script (F-Lead): Notes textarea with ID '${F_LEAD_NOTES_TEXTAREA_ID}' not found.`);
        }

        // Scroll to the notes field after filling
        scrollToField(F_LEAD_NOTES_TEXTAREA_ID);

        console.log('MAK Script (F-Lead): All Datenschutz actions completed.');
    }

    /**
     * Adds the "Datenschutz" and "Weitergabe an Dritte" buttons for F-Leads.
     */
    function addFLeadDatenschutzButtons() {
        const targetElement = document.getElementById(F_LEAD_BUTTON_PLACEMENT_TARGET_ID);
        const existingDatenschutzButton = document.getElementById('mak-flead-datenschutz-button');
        const existingWeitergabeButton = document.getElementById('mak-flead-weitergabe-button');

        let buttonsAdded = false;

        if (targetElement) {
            // Add Datenschutz button if it doesn't exist
            if (!existingDatenschutzButton) {
                const datenschutzButton = document.createElement('button');
                datenschutzButton.id = 'mak-flead-datenschutz-button';
                datenschutzButton.textContent = F_LEAD_BUTTON_TEXT;
                datenschutzButton.type = 'button';
                datenschutzButton.style.cssText = `${COMMON_BUTTON_STYLE} background-color: ${DATENSCHUTZ_BUTTON_COLOR};`;
                datenschutzButton.addEventListener('click', fillFLeadDatenschutzFields);

                targetElement.parentNode.insertBefore(datenschutzButton, targetElement.nextSibling);
                console.log('MAK Script: "Datenschutz" button for F-Lead added.');
                buttonsAdded = true;
            }

            // Add Weitergabe an Dritte button if it doesn't exist
            if (!existingWeitergabeButton) {
                const weitergabeButton = document.createElement('button');
                weitergabeButton.id = 'mak-flead-weitergabe-button';
                weitergabeButton.textContent = F_LEAD_WEITERGABE_BUTTON_TEXT;
                weitergabeButton.type = 'button';
                weitergabeButton.style.cssText = `${COMMON_BUTTON_STYLE} background-color: ${WEITERGABE_BUTTON_COLOR};`; // Apply specific color
                weitergabeButton.addEventListener('click', () => performWeitergabeAction('flead'));

                // Insert after the Datenschutz button, or after targetElement if Datenschutz not present
                const referenceNode = document.getElementById('mak-flead-datenschutz-button') || targetElement;
                if (referenceNode && referenceNode.nextSibling) {
                     targetElement.parentNode.insertBefore(weitergabeButton, referenceNode.nextSibling);
                } else if (referenceNode) {
                     targetElement.parentNode.appendChild(weitergabeButton); // Fallback if no nextSibling
                }

                console.log('MAK Script: "Weitergabe an Dritte" button for F-Lead added.');
                buttonsAdded = true;
            }
        }
        return buttonsAdded;
    }

    // --- Page Type Detection ---
    function isFLeadPage() {
        return window.location.href.includes(F_LEAD_URL_PATH);
    }

    function isObjekttippPage() {
        return window.location.href.includes(OBJEKTTIPP_URL_PATH);
    }

    // --- Main Initialization Logic ---
    function initializeScript() {
        let buttonsAdded = false;
        if (isFLeadPage()) {
            buttonsAdded = addFLeadDatenschutzButtons();
        } else if (isObjekttippPage()) {
            buttonsAdded = addObjekttippDatenschutzButtons();
        }
        // If neither page type, no button is added, and no specific logic runs.
        return buttonsAdded;
    }

    // --- Dynamic Content Handling ---

    // Use a MutationObserver for robust detection of DOM changes
    const observer = new MutationObserver((mutations) => {
        let relevantChange = false;
        for (let mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any of the target elements for buttons or key inputs were added
                if (isFLeadPage() && (document.getElementById(F_LEAD_BUTTON_PLACEMENT_TARGET_ID) || document.getElementById(F_LEAD_PHONE_FIELD_ID))) {
                    relevantChange = true;
                    break;
                }
                if (isObjekttippPage() && (document.getElementById(OBJEKTTIPP_BUTTON_PLACEMENT_TARGET_ID) || document.getElementById(OBJEKTTIPP_EMAIL_FIELD_ID))) {
                    relevantChange = true;
                    break;
                }
            }
        }
        if (relevantChange) {
            initializeScript();
        }
    });

    // Start observing the body for changes
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check and fallback polling (continues checking)
    addHoverStyles(); // Inject hover styles first
    initializeScript(); // Attempt to add on initial load

    const checkInterval = setInterval(() => {
        initializeScript();
        // The interval continues to run, ensuring the button re-appears if removed by SPA navigation etc.
    }, 1000); // Check every second

    console.log("MAK.planethome.de script initialized.");

})();