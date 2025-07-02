// ==UserScript==
// @name         CCplanet Abbruchgrund dropdown shortcut
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Fetches dropdown data from a URL, matches width, ensures persistence. Inserts text bolded on new lines, emulating Enter.
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
     * Fills the description field with the selected text, ensuring it's bolded and
     * placed on new lines, mimicking a paragraph break in Quill.
     * @param {string} textToInsert - The text to insert into the description field.
     */
    function fillDescriptionField(textToInsert) {
        const textEditorDiv = document.querySelector('ph-texteditor[formcontrolname="description"] .ql-editor');

        if (textEditorDiv) {
            const quillInstance = textEditorDiv.__quill; // Attempt to access Quill instance

            if (quillInstance) {
                // Get the current length of the document. This is the insertion point at the very end.
                let insertPoint = quillInstance.getLength();

                // 1. Ensure a new paragraph break *before* the bold text.
                // If the editor is not completely empty (length > 1) AND the last character before Quill's
                // implicit newline is not already a newline, insert one.
                // This creates a new paragraph block before our content.
                if (insertPoint > 1 && quillInstance.getText(insertPoint - 2, 1) !== '\n') {
                    quillInstance.insertText(insertPoint - 1, '\n', { 'bold': false });
                    insertPoint = quillInstance.getLength(); // Update insertPoint after inserting newline
                } else if (insertPoint === 1 && quillInstance.getText() === '\n') {
                    // Editor is empty (<p><br></p>), we want to clear this to start clean
                    quillInstance.setText('');
                    insertPoint = 0; // Reset insert point to beginning
                }

                // 2. Insert the bolded text at the determined insertPoint.
                quillInstance.insertText(insertPoint, textToInsert, { bold: true });
                // Update insertPoint after adding the bold text
                insertPoint = quillInstance.getLength();

                // 3. Ensure a new paragraph break *after* the bold text.
                // This creates a new paragraph block below our content.
                quillInstance.insertText(insertPoint, '\n', { 'bold': false });
                insertPoint = quillInstance.getLength(); // Update insertPoint after adding final newline

                // Set the selection (cursor) to the very end of the document after all insertions.
                quillInstance.setSelection(insertPoint);

                // Manually dispatch events to ensure Angular/Quill updates its internal model and UI.
                // This is crucial for rich text editors where direct DOM manipulation might not fully sync.
                textEditorDiv.dispatchEvent(new Event('input', { bubbles: true }));
                textEditorDiv.dispatchEvent(new Event('change', { bubbles: true }));
                textEditorDiv.dispatchEvent(new Event('blur', { bubbles: true }));
                textEditorDiv.focus(); // Set focus then blur can help trigger Angular change detection
                textEditorDiv.blur();

            } else {
                // Fallback for when Quill instance is not directly accessible (e.g., if page structure changes or it's a simple textarea)
                let currentContent = textEditorDiv.innerHTML.trim();
                const boldedTextHTML = `<strong>${textToInsert}</strong>`;
                const newParagraphHTML = `<p>${boldedTextHTML}</p>`;
                // This matches how Quill represents an empty line for a new paragraph break
                const emptyParagraphHTML = `<p><br></p>`;

                if (currentContent === '<p><br></p>' || currentContent === '<p></p>' || currentContent === '') {
                    // If the editor is empty, just insert the bold text paragraph followed by an empty line paragraph
                    textEditorDiv.innerHTML = newParagraphHTML + emptyParagraphHTML;
                } else {
                    // Otherwise, append an empty line paragraph, then the bold text paragraph, then another empty line paragraph.
                    // This creates the desired spacing around the new content.
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = currentContent;

                    // Append the new content block
                    tempDiv.innerHTML += emptyParagraphHTML + newParagraphHTML + emptyParagraphHTML;

                    textEditorDiv.innerHTML = tempDiv.innerHTML; // Update the editor's content
                }

                // Dispatch events to notify Angular/Quill of changes, mimicking user input for UI updates
                textEditorDiv.dispatchEvent(new Event('input', { bubbles: true }));
                textEditorDiv.dispatchEvent(new Event('change', { bubbles: true }));
                textEditorDiv.dispatchEvent(new Event('blur', { bubbles: true }));
                textEditorDiv.focus(); // Set focus then blur can help trigger Angular change detection
                textEditorDiv.blur();
            }
        }
    }

    // --- Main Execution Flow ---
    // 1. Fetch the primary JSON data from the GitHub URL.
    await fetchMainJsonData();

    // 2. Set up a MutationObserver to dynamically add the dropdown when the target elements appear.
    const observer = new MutationObserver((mutations, obs) => {
        addDropdown(); // This function internally checks if the dropdown already exists to prevent duplicates
    });

    observer.observe(document.body, {
        childList: true, // Observe direct children additions/removals
        subtree: true // Observe all descendants of body
    });

    // 3. Also, try to add the dropdown immediately on initial page load
    // in case the target elements are already present in the DOM.
    addDropdown();

})();