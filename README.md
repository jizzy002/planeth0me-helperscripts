![planeth0me](https://s3-eu-west-1.amazonaws.com/tpd/logos/5c90bafbc0170b0001e600bf/0x0.png)
# Salesplanet, CCPlanet & Immoplanet Datenschutz Scripts

This repository contains a collection of JavaScript userscripts developed and written to streamline and simplify my daily work processes. While I am not a person that knows to code there are many AI tools available these days with which I'm able to plan, construct, test and generate all the code needed for these scripts to work.

## Scripts

The following userscripts are included in this repository:

-   **`Immoplanet - Datenschutz worker.user.js`**: A userscript likely designed to assist with data protection (Datenschutz) related tasks on the Immoplanet platform.
    
-   **`Salesplanet - Datenschutz worker.user.js`**: A userscript likely designed to assist with data protection (Datenschutz) related tasks on the Salesplanet platform.


## Script Installation and Usage


These scripts are designed to be installed using a browser extension like **Tampermonkey**. If you're unfamiliar with Tampermonkey, it's a popular userscript manager that allows you to run custom JavaScript on webpages.

For detailed instructions on how to install userscripts with Tampermonkey, please refer to the [Tampermonkey FAQ](https://www.tampermonkey.net/faq.php?locale=en).

Once installed, these scripts simplify your workflow by automating the process of **filling specific fields and replacing data** on web pages. While the exact steps will depend on the specific script and the page you're on, their core function is to streamline repetitive data entry and manipulation.

## Salesplanet Script in-dept

This Tampermonkey script for `salesplanet.planethome.de` enhances the user's workflow by adding persistent UI elements and automating data handling. It features:

-   **Copy Buttons:** Adds buttons to quickly copy customer Name, Email, Customer ID, and Address details to the clipboard, extracting data from relevant page elements.
    
-   **"Datenschutz" Automation:** A "Datenschutz" button automates data privacy actions by replacing email and phone numbers in input fields with placeholders and logging the original data into a Quill editor on the page. It handles multiple contact fields and auto-scrolls to and focuses the Quill editor.
    
-   **GDPR Action Dropdown:** A "DSGVO Grund" (GDPR Reason) dropdown allows for inserting predefined "Löschung / Sperrung" (Deletion / Blocking) or "Widerruf Weitergabe Daten an Dritte" (Revocation of Data Transfer to Third Parties) text into the Quill editor.
    
-   **Toggle Visibility:** A "Datenschutz On/Off" toggle button controls the visibility of the "Datenschutz" button and dropdown, with its state persistently saved across sessions.
    
-   **UI Enhancements:** The script injects custom CSS for button styling, displays transient notifications (e.g., "Copied!"), and includes polyfills for broader browser compatibility. It also removes a native "Map Directions" button.

## Immoplanet Script in-depth

This Tampermonkey userscript, "Immoplanet - Datenschutz worker," is designed to automate specific data protection (Datenschutz) and data transfer ("Weitergabe an Dritte") actions on `mak.planethome.de` for two distinct page types: "Objekttipp" and "F-Lead" pages.

Here's a summary of its functionality:

-   **Page-Specific Automation:** The script detects if the user is on an "Objekttipp" or "F-Lead" page based on the URL paths (`/immoplanet/views/tips` and `/immoplanet/views/leads` respectively). It then dynamically adds specific "Datenschutz" and "Weitergabe an Dritte" buttons relevant to that page type.
    
-   **"Datenschutz" Action:**
    
    -   For **Objekttipp** pages, clicking the "Datenschutz" button captures the original email and phone numbers, replaces them with generic placeholders (e.g., 'nn@nn.de', '0'), checks the "Automated Emails" checkbox, unchecks the "Coop Forward" checkbox, and inserts a predefined data protection text along with the captured original contact info into the notes textarea.
        
    -   For **F-Lead** pages, it similarly captures and masks email and phone numbers, then inserts a predefined data protection text and the original contact info into the notes textarea.
        
    -   In both cases, it scrolls the page to the relevant notes field after performing the actions.
        
-   **"Weitergabe an Dritte" (Data Transfer to Third Parties) Action:** A separate button, "Weitergabe an Dritte," is added. When clicked, it inserts a specific privacy-related text (indicating revocation of data transfer consent) into the notes textarea for both "Objekttipp" and "F-Lead" pages. For F-Lead pages, it also scrolls to the notes field.
    
-   **Persistent Buttons:** The script uses `MutationObserver` and a `setInterval` fallback to ensure the buttons are persistently added and re-appear if removed due to dynamic content loading on the single-page application (SPA).
    
-   **Helper Functions:** It includes helper functions to simulate user input (`setInputValue`, `setCheckboxState`), add custom CSS for button hover effects, and scroll to specific fields.
