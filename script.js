// Configuration
const CONFIG = {
    //    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzGDv2G1B6UscJVE7ME-UGqZ-ksM2CCc5_ySJO_yRQ2d4PuQY9XvdFJQBqDfsinE2uH/exec',
    //SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzKMJnerToEOHE7T4a09asUzNHlBTrNwr-Smq6O3eVFTLYywk7tpuoH6UAVHkTToTii/exec',
    //    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwfOplCJdFaNTi4b9SQ3QgI3yYOvl9bS2tAwLvo6CZZV6R0MlBvyiQ1g8620JI4y7SL/exec',
    //SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx5jd0LgAlwGYhrQ7WWL002wGYMgx6_kpHCUc6bPYSiFLTa2vI_O-OLdmmRocsHPl6Q/exec',
    //SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw6NL5YmWAaYJITQxZbQI9GxTbj91emELDAqtU5-cdrQrByeKU7KETWi11lqZh4vmwV/exec',
    //SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxJ1MIivKRFq-wHJw1dgwAvQK6Ye4buhMygjNLXz6ppHEFiR6i5SnI_NZ2TxCGWVoNJ/exec',
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyfjqqrYoL57S_hLEeco4tr0tmTRV9ooR-KlorxJetyIgBt4UpztZFprp8hivSJKXfX/exec',

    // Set to true if you are running locally and getting CORS errors
    USE_PROXY: true
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const clearBtn = document.getElementById('clearBtn');

    // Allow pressing Enter in URL input
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startTranslation();
    });

    // Toggle Clear Button visibility
    urlInput.addEventListener('input', () => {
        clearBtn.style.display = urlInput.value ? 'block' : 'none';
    });

    // Clear Input Action
    clearBtn.addEventListener('click', () => {
        urlInput.value = '';
        clearBtn.style.display = 'none';
        urlInput.focus();
    });

    // Initial check
    clearBtn.style.display = urlInput.value ? 'block' : 'none';
});

async function startTranslation() {
    const urlInput = document.getElementById('urlInput');
    let targetUrl = urlInput.value.trim();

    const loader = document.getElementById('loader');
    const resultSection = document.getElementById('resultSection');
    const btn = document.querySelector('.btn-translate');

    // Reset UI
    document.getElementById('errorAlert').classList.add('d-none');
    resultSection.style.display = 'none';

    // Validation
    if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes('YOUR_GOOGLE_APPS_SCRIPT')) {
        showError('Please configure your Web App URL in script.js first.');
        return;
    }

    if (!targetUrl) {
        Swal.fire({
            icon: 'warning',
            title: 'No URL Found',
            text: 'Please enter an IslamQA URL.',
            confirmButtonColor: '#3b82f6'
        });
        return;
    }

    // Check Format & Auto-correct
    // Regex for: https://islamqa.info/<lang>/answers/<id>(/anything-else)
    const urlPattern = /^https?:\/\/islamqa\.info\/([a-z]{2,3})\/answers\/(\d+)/i;
    const match = targetUrl.match(urlPattern);

    if (match) {
        // match[1] = lang (e.g. en), match[2] = id (e.g. 192341)
        const lang = match[1];
        const id = match[2];
        const correctUrl = `https://islamqa.info/${lang}/answers/${id}`;

        // If the current URL is different (e.g. has extra slashes or query params), update it
        if (targetUrl !== correctUrl) {
            targetUrl = correctUrl;
            urlInput.value = correctUrl; // Auto-update input

            // Optional: Show a small toast or just proceed silently? 
            // The user asked to "adjust automatically", implying proceed.
        }
    } else {
        // Invalid Format
        Swal.fire({
            icon: 'error',
            title: 'Invalid URL Format',
            html: 'Please use the correct format:<br><b>https://islamqa.info/en/answers/12345</b>',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    // Start Loading
    loader.style.display = 'flex';
    btn.disabled = true;
    btn.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Translating...
    `;

    try {
        // Construct the final URL
        const gasUrl = `${CONFIG.SCRIPT_URL}?url=${encodeURIComponent(targetUrl)}`;

        let fetchUrl = gasUrl;

        // If Proxy is enabled
        if (CONFIG.USE_PROXY) {
            fetchUrl = `https://corsproxy.io/?${encodeURIComponent(gasUrl)}`;
        }

        console.log("Fetching:", fetchUrl);

        const response = await fetch(fetchUrl, {
            method: 'GET',
            // headers: { 'Content-Type': 'application/json' } // usually not needed for simple GET
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            renderResults(data);
        } else {
            showError(`API Error: ${data.message}`);
        }

    } catch (error) {
        console.error("Fetch error:", error);

        let msg = `Connection Error: ${error.message}.`;

        if (!CONFIG.USE_PROXY && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
            msg += ' <br><strong>Tip:</strong> Try setting "USE_PROXY: true" in script.js configuration.';
        }

        showError(msg);
    } finally {
        // Cleanup
        loader.style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = 'แปลภาษา (Translate)';
    }
}

function renderResults(data) {
    document.getElementById('resultTitle').innerText = data.translated.title || "No Title";

    // Question
    if (data.translated.question) {
        document.getElementById('resultQuestion').innerText = data.translated.question;
        document.getElementById('resultQuestion').parentElement.style.display = 'block';
    } else {
        document.getElementById('resultQuestion').parentElement.style.display = 'none';
    }

    // Summary - Only show if available
    var summaryEl = document.getElementById('resultSummary');
    if (summaryEl) {
        if (data.translated.summary) {
            summaryEl.innerText = data.translated.summary;
            summaryEl.parentElement.style.display = 'block';
        } else {
            summaryEl.parentElement.style.display = 'none';
        }
    }

    // Answer
    document.getElementById('resultAnswer').innerText = data.translated.answer || "No contents";

    document.getElementById('resultSection').style.display = 'block';
}

function showError(msg, type = 'error') {
    const errorAlert = document.getElementById('errorAlert');
    errorAlert.innerHTML = msg;

    errorAlert.classList.remove('d-none');
    errorAlert.className = type === 'success'
        ? 'alert-custom alert-success'
        : 'alert-custom';

    // Add success style dynamically if needed or just rely on CSS class
    if (type === 'success') {
        errorAlert.style.borderColor = 'rgba(74, 222, 128, 0.4)';
        errorAlert.style.color = '#86efac';
        errorAlert.style.background = 'rgba(74, 222, 128, 0.1)';
    } else {
        // Reset to error style
        errorAlert.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        errorAlert.style.color = '#fca5a5';
        errorAlert.style.background = 'rgba(239, 68, 68, 0.2)';
    }
}

function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text).then(() => {
        // Create a temporary tooltip or feedback
        const inputEl = document.getElementById(elementId);
        const originalBg = inputEl.parentElement.style.background;

        inputEl.parentElement.style.transition = 'background 0.3s';
        inputEl.parentElement.style.background = 'rgba(59, 130, 246, 0.2)'; // Blue tint

        setTimeout(() => {
            inputEl.parentElement.style.background = originalBg;
        }, 500);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}
