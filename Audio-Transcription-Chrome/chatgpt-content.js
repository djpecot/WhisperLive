alert("ChatGPT content script loaded"); // This will be more obvious
console.log("ChatGPT content script loaded at:", new Date().toISOString());

// Add this to test if the script is running in the correct context
console.log("Current URL:", window.location.href);
console.log("Textarea exists:", !!document.querySelector('#prompt-textarea'));
console.log("ChatGPT content script initializing...");

// Notify that the content script is ready
chrome.runtime.sendMessage({ type: "contentScriptReady" });
async function findTextarea(maxAttempts = 10, delayMs = 500) {
    console.log("Starting textarea search...");
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const textarea = document.querySelector('#prompt-textarea');
        console.log(`Search attempt ${attempt + 1}, found textarea:`, !!textarea);
        
        if (textarea) {
            return textarea;
        }
        
        console.log(`Waiting ${delayMs}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    console.log("Failed to find textarea after all attempts");
    return null;
}

// Listen for messages with retry logic
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request); // Debug log
    
    if (request.type === "updateChatGPT") {
        const textarea = document.querySelector('#prompt-textarea');
        
        if (textarea) {
            console.log("Before update - textarea value:", textarea.value); // Debug log
            
            // Try different methods to update the textarea
            try {
                // Method 1: Direct value assignment
                textarea.value = request.text;
                
                // Method 2: Input event dispatch
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Method 3: Focus and blur events
                textarea.focus();
                textarea.dispatchEvent(new Event('focus'));
                textarea.dispatchEvent(new Event('blur'));
                
                // Method 4: Using textContent
                textarea.textContent = request.text;
                
                // Method 5: Using innerHTML
                textarea.innerHTML = request.text;

                console.log("After update - textarea value:", textarea.value); // Debug log
                
                // Verify the update
                if (textarea.value === request.text) {
                    console.log("Textarea update successful");
                    sendResponse({ success: true });
                } else {
                    console.log("Textarea update failed - values don't match");
                    sendResponse({ success: false, error: "Value not updated" });
                }
            } catch (error) {
                console.error("Error updating textarea:", error);
                sendResponse({ success: false, error: error.message });
            }
        } else {
            console.log("Textarea not found when trying to update");
            sendResponse({ success: false, error: "Textarea not found" });
        }
        
        return true; // Keep the message channel open
    }
});

// Additional check to verify the textarea is interactive
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.querySelector('#prompt-textarea');
    if (textarea) {
        console.log("Testing textarea interactivity...");
        const originalValue = textarea.value;
        
        try {
            textarea.value = "Test input";
            console.log("Test input successful:", textarea.value === "Test input");
            textarea.value = originalValue;
        } catch (error) {
            console.error("Textarea interaction test failed:", error);
        }
    }
});

// Additional debugging
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded");
    const textarea = document.querySelector('#prompt-textarea');
    console.log("Initial textarea check:", !!textarea);
});

window.addEventListener('load', () => {
    console.log("Window Loaded");
    const textarea = document.querySelector('#prompt-textarea');
    console.log("Window load textarea check:", !!textarea);
});

// Periodic check for textarea (first 10 seconds)
let checksRemaining = 20;
const checkInterval = setInterval(() => {
    const textarea = document.querySelector('#prompt-textarea');
    console.log(`Periodic check ${20 - checksRemaining + 1}/20:`, !!textarea);
    checksRemaining--;
    
    if (checksRemaining <= 0 || textarea) {
        clearInterval(checkInterval);
    }
}, 500);

// Log when the script is fully loaded
window.addEventListener('load', () => {
    console.log("Page fully loaded");
});