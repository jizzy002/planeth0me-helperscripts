// ==UserScript==
// @name         CCplanet Abbruchgrund dropdown shortcut
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Adds a dropdown below the description field to quickly insert predefined text, matching its width, and ensures persistence on dynamic page loads.
// @author       Gemini AI & aldjan
// @match        https://ccplanet.planethome.de/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const jsonData = {
        "Kein Interesse / Anruf von KD beendet": [
            "Kein Interesse, das Gespräch vom KD beendet.",
            "KD hat das Gespräch sofort nach der Vorstellung beendet.",
            "Das Gespräch wurde vom KD beendet.",
            "KD war auf der Arbeit, hat das Gespräch beendet.",
            "KD wünscht keine Anrufe mehr, meldet sich bei Bedarf.",
            "Kontakt besteht Preisvorschlag abgelehnt, Gespräch beendet vom KD."
        ],
        "Follow-Up benötigt / Möchte kontakt später": [
            "KD hat sich das Exposé noch nicht angesehen, wird sich bei Bedarf melden.",
            "Die Ehefrau konnte keine Infos geben, der Partner wird sich bei Bedarf melden.",
            "Der Mann konnte keine Infos geben, die Partnerin wird sich bei Bedarf melden.",
            "KD war in einer Besprechung, wird sich bei Bedarf melden.",
            "KD beim Autofahren erreicht wird sich bei uns melden.",
            "KD möchte sich noch die Gegend ansehen und wird sich bei uns melden.",
            "KD wird sich bei Bedarf melden, hat das Gespräch beendet.",
            "Exposé für einen Kunden heruntergeladen, kommt bei Bedarf auf uns zu.",
            "Exposé für einen Angehörigen heruntergeladen, kommt bei Bedarf auf uns zu.",
            "KD ist in der Findungsphase, wird sich bei Bedarf melden.",
            "KD möchte seinen Preisvorschlag zusenden, braucht noch ein wenig Zeit!",
            "KD ist gerade im Urlaub, meldet sich bei der Rückkehr.",
            "KD ist gerade auf der Geschäftsreise, meldet sich bei der Rückkehr.",
            "KD ist im Kontakt mit dem Makler."
        ],
        "Falscher Kontakt": [
            "Abbruch Grund: Rufnummer existiert nicht!",
            "Abbruch Grund: Rufnummer ist nicht vergeben!",
            "XX Nummer kein Kontakt möglich.",
            "Keine gültige Nummer hinterlassen!",
            "Die Nummer gehört nicht dem KD.",
            "Da Heute Feiertag ist, den KD nicht kontaktiert."
        ],
        "Mehr informationen / Abwarten": [
            "KD hat keine Zeit, erneut kontaktieren.",
            "KD wollte wissen wann sich der Makler meldet um etwas Geduld gebeten.",
            "Auf die Frage nach dem Immobilienstatus möchte der KD nicht antworten.",
            "KD hat sich kein Exposé heruntergeladen!",
            "Bereits mit dem KD gesprochen."
        ]
    };

    function addDropdown() {
        const targetTextEditor = document.querySelector('ph-texteditor[formcontrolname="description"]');
        const existingDropdown = document.getElementById('textHelperDropdown');

        // Only add the dropdown if the target editor exists AND the dropdown doesn't already exist
        if (targetTextEditor && !existingDropdown) {
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

                    jsonData[category].forEach(phrase => {
                        const option = document.createElement('option');
                        option.value = phrase;
                        option.textContent = phrase;
                        optgroup.appendChild(option);
                    });
                    dropdown.appendChild(optgroup);
                }
            }

            targetTextEditor.insertAdjacentElement('afterend', dropdown);

            dropdown.addEventListener('change', (event) => {
                const selectedText = event.target.value;
                if (selectedText) {
                    fillDescriptionField(selectedText);
                }
                event.target.value = '';
            });
        }
    }

    function fillDescriptionField(textToInsert) {
        const textEditorDiv = document.querySelector('ph-texteditor[formcontrolname="description"] .ql-editor');

        if (textEditorDiv) {
            const quillInstance = textEditorDiv.__quill;

            if (quillInstance) {
                const currentLength = quillInstance.getLength();
                quillInstance.insertText(currentLength - 1, '\n' + textToInsert + '\n');
                quillInstance.setSelection(currentLength + textToInsert.length + 1);
            } else {
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

                textEditorDiv.dispatchEvent(new Event('input', { bubbles: true }));
                textEditorDiv.dispatchEvent(new Event('change', { bubbles: true }));
                textEditorDiv.dispatchEvent(new Event('blur', { bubbles: true }));
                textEditorDiv.focus();
                textEditorDiv.blur();
            }
        }
    }

    // Use a MutationObserver to ensure the script runs after the necessary DOM elements are loaded.
    // This observer will now remain active.
    const observer = new MutationObserver((mutations, obs) => {
        // We call addDropdown on every mutation, but the addDropdown function itself
        // now checks if the dropdown already exists before creating it.
        addDropdown();
    });

    // Start observing the document body for changes in its children and their descendants.
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Also, try to add the dropdown immediately in case the elements are already present on initial load
    addDropdown();

})();