// ==UserScript==
// @name         CCplanet Abbruchgrund dropdown shortcut
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  Fetches dropdown data from a URL, matches width, and ensures persistence.
// @author       Gemini AI & aldjan
// @match        https://ccplanet.planethome.de/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(async function() { // Use an async IIFE to allow awaiting network requests
    'use strict';

    // This will hold the JSON data after it's fetched
    let jsonData = {};

    /**
     * Fetches the primary JSON data from the specified GitHub URL.
     * @returns {Promise<void>} A promise that resolves when jsonData is fetched or on error.
     */
    async function fetchMainJsonData() {
        console.log("Attempting to fetch main JSON data from GitHub...");
        return new Promise((resolve) => {
            if (typeof GM_xmlhttpRequest === 'undefined') {
                console.error("GM_xmlhttpRequest is not available. Cannot fetch external JSON data. Please ensure '@grant GM_xmlhttpRequest' is in your script header.");
                jsonData = {}; // Fallback to empty data
                resolve();
                return;
            }

            GM_xmlhttpRequest({
                method: "GET",
                url: "https://raw.githubusercontent.com/jizzy002/planeth0me-helperscripts/refs/heads/main/configurations/abbruchgrund.json",
                timeout: 10000, // 10 seconds timeout
                onload: function(response) {
                    try {
                        const fetchedData = JSON.parse(response.responseText);
                        jsonData = fetchedData; // Assign fetched data to the global jsonData variable
                        console.log("Main JSON data fetched successfully:", jsonData);
                        resolve();
                    } catch (e) {
                        console.error("Error parsing fetched JSON data from GitHub:", e);
                        jsonData = {}; // Ensure jsonData is an empty object on parse error
                        resolve();
                    }
                },
                onerror: function(response) {
                    console.error("GM_xmlhttpRequest error fetching main JSON from GitHub:", response.status, response.statusText);
                    jsonData = {}; // Ensure jsonData is an empty object on network error
                    resolve();
                },
                ontimeout: function() {
                    console.error("GM_xmlhttpRequest timeout for main JSON fetch from GitHub.");
                    jsonData = {}; // Ensure jsonData is an empty object on timeout
                    resolve();
                }
            });
        });
    }

    /**
     * Adds the dropdown box next to the target element.
     * Checks if dropdown already exists to prevent duplicates.
     */
    function addDropdown() {
        const targetTextEditor = document.querySelector('ph-texteditor[formcontrolname="description"]');
        const existingDropdown = document.getElementById('textHelperDropdown');

        // Only add the dropdown if the target editor exists AND the dropdown doesn't already exist
        // And ensure jsonData is populated before attempting to build options
        if (targetTextEditor && !existingDropdown && Object.keys(jsonData).length > 0) {
            console.log("Adding dropdown...");
            const dropdown = document.createElement('select');
            dropdown.id = 'textHelperDropdown';

            const editorWidth = targetTextEditor.offsetWidth;
            dropdown.style.width = `${editorWidth}px`;

            dropdown.style.marginTop = '10px';
            dropdown.style.marginBottom = '10px';
            dropdown.style.padding = '8px 12px';
            dropdown.style.border = '1px solid #ccc';
            dropdown.style.borderRadius = '4px';
            dropdown.style.backgroundColor = '#fff';
            dropdown.style.cursor = 'pointer';
            dropdown.style.fontSize = '14px';
            dropdown.style.display = 'block';

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Abbruchgrund auswählen...';
            defaultOption.disabled = true;
            defaultOption.selected = true;
            dropdown.appendChild(defaultOption);

            for (const category in jsonData) {
                if (Object.hasOwnProperty.call(jsonData, category)) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = category;

                    // Ensure category is an array before iterating to prevent errors
                    if (Array.isArray(jsonData[category])) {
                        jsonData[category].forEach(phrase => {
                            const option = document.createElement('option');
                            option.value = phrase;
                            option.textContent = phrase;
                            optgroup.appendChild(option);
                        });
                    } else {
                        console.warn(`Category "${category}" in fetched JSON is not an array. Skipping options for this category.`);
                    }
                    dropdown.appendChild(optgroup);
                }
            }

            targetTextEditor.insertAdjacentElement('afterend', dropdown);

            dropdown.addEventListener('change', (event) => {
                const selectedText = event.target.value;
                if (selectedText) {
                    fillDescriptionField(selectedText);
                }
                event.target.value = ''; // Reset dropdown to default after selection
            });
        }
    }

    /**
     * Fills the description field with the selected text.
     * @param {string} textToInsert - The text to insert into the description field.
     */
    function fillDescriptionField(textToInsert) {
        const textEditorDiv = document.querySelector('ph-texteditor[formcontrolname="description"] .ql-editor');

        if (textEditorDiv) {
            const quillInstance = textEditorDiv.__quill; // Attempt to access Quill instance

            if (quillInstance) {
                const currentLength = quillInstance.getLength(); // Get current text length (includes a trailing newline)
                // Insert new text followed by a newline at the end (before Quill's internal trailing newline)
                quillInstance.insertText(currentLength - 1, '\n' + textToInsert + '\n');
                quillInstance.setSelection(currentLength + textToInsert.length + 1); // Set cursor to end of inserted text
            } else {
                // Fallback for when Quill instance is not directly accessible
                let currentContent = textEditorDiv.innerHTML.trim();
                const newParagraphHTML = `<p>${textToInsert}</p>`;

                if (currentContent === '<p><br></p>' || currentContent === '') {
                    textEditorDiv.innerHTML = newParagraphHTML;
                } else {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = currentContent;
                    let lastP = tempDiv.querySelector('p:last-of-type');

                    if (lastP) {
                        lastP.innerHTML += `<br>${textToInsert}`;
                    } else {
                        tempDiv.innerHTML += newParagraphHTML;
                    }
                    textEditorDiv.innerHTML = tempDiv.innerHTML;
                }

                // Dispatch events to notify Angular/Quill of changes
                textEditorDiv.dispatchEvent(new Event('input', { bubbles: true }));
                textEditorDiv.dispatchEvent(new Event('change', { bubbles: true }));
                textEditorDiv.dispatchEvent(new Event('blur', { bubbles: true }));
                textEditorDiv.focus(); // Set focus and then blur to potentially trigger more updates
                textEditorDiv.blur();
            }
        }
    }

    // --- Main Execution Flow ---
    // 1. Fetch the primary JSON data from the GitHub URL.
    await fetchMainJsonData();

    // 2. Set up the MutationObserver to ensure the dropdown is added/re-added dynamically
    // whenever the relevant part of the DOM changes.
    const observer = new MutationObserver((mutations, obs) => {
        addDropdown(); // This function internally checks if the dropdown already exists
    });

    observer.observe(document.body, {
        childList: true, // Observe direct children additions/removals
        subtree: true // Observe all descendants of body
    });

    // 3. Also, try to add the dropdown immediately on initial page load
    // in case the target elements are already present.
    addDropdown();

})();