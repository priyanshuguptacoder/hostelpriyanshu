/**
 * Hostel Management System - Enhanced Features Module
 * 
 * @author Priyanshu
 * @copyright 2026 Priyanshu. All Rights Reserved.
 */

// Enhanced Features for Hostel Management System

// ==================== THEME TOGGLE ====================
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.textContent = newTheme === 'light' ? '🌙' : '☀️';
    }
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    }
}

// ==================== SEARCH FUNCTIONALITY ====================
function addSearchBar(containerId, tableId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const searchBar = document.createElement('div');
    searchBar.className = 'search-bar';
    searchBar.innerHTML = `
        <input type="text" id="search-input-${tableId}" placeholder="Search..." 
               onkeyup="filterTable('${tableId}', this.value)">
    `;
    
    container.insertBefore(searchBar, container.firstChild);
}

function filterTable(tableId, searchTerm) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    searchTerm = searchTerm.toLowerCase();
    
    Array.from(rows).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// ==================== NOTIFICATION SYSTEM ====================
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }
    
    init() {
        // Create notification container
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 400px;
        `;
        document.body.appendChild(this.container);
    }
    
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.style.cssText = `
            animation: slideIn 0.4s ease-out;
            box-shadow: var(--shadow-lg);
        `;
        notification.textContent = message;
        
        this.container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

const notifications = new NotificationManager();

// Loading functions moved to app.js

// ==================== EXPORT TO CSV ====================
function exportTableToCSV(tableId, filename = 'export.csv') {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const csvRow = Array.from(cols).map(col => {
            let text = col.textContent.trim();
            // Escape quotes and wrap in quotes if contains comma
            text = text.replace(/"/g, '""');
            return text.includes(',') ? `"${text}"` : text;
        });
        csv.push(csvRow.join(','));
    });
    
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ==================== PRINT FUNCTIONALITY ====================
function printContent(elementId) {
    const content = document.getElementById(elementId);
    if (!content) return;
    
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Print</title>');
    printWindow.document.write('<link rel="stylesheet" href="css/style.css">');
    printWindow.document.write('</head><body>');
    printWindow.document.write(content.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

// ==================== CONFIRMATION DIALOG ====================
function confirmAction(message, callback) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3>Confirm Action</h3>
            </div>
            <div>
                <p style="margin-bottom: 24px; font-size: 16px;">${message}</p>
                <div class="flex gap-2">
                    <button class="btn btn-danger" onclick="this.closest('.modal').remove(); (${callback})()">
                        Confirm
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ==================== FORM VALIDATION ====================
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.style.borderColor = 'var(--danger)';
            isValid = false;
        } else {
            input.style.borderColor = 'var(--border)';
        }
    });
    
    return isValid;
}

// ==================== AUTO-SAVE FUNCTIONALITY ====================
class AutoSave {
    constructor(formId, key, interval = 30000) {
        this.formId = formId;
        this.key = key;
        this.interval = interval;
        this.timer = null;
        this.init();
    }
    
    init() {
        const form = document.getElementById(this.formId);
        if (!form) return;
        
        // Load saved data
        this.load();
        
        // Auto-save on input
        form.addEventListener('input', () => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.save(), this.interval);
        });
    }
    
    save() {
        const form = document.getElementById(this.formId);
        if (!form) return;
        
        const data = {};
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (input.id) {
                data[input.id] = input.value;
            }
        });
        
        localStorage.setItem(this.key, JSON.stringify(data));
        notifications.show('Draft saved', 'success', 2000);
    }
    
    load() {
        const saved = localStorage.getItem(this.key);
        if (!saved) return;
        
        const data = JSON.parse(saved);
        Object.keys(data).forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = data[id];
        });
    }
    
    clear() {
        localStorage.removeItem(this.key);
    }
}

// ==================== STATISTICS CHARTS (Simple Text-based) ====================
function createProgressChart(percentage, label) {
    return `
        <div style="margin: 16px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 600;">${label}</span>
                <span style="font-weight: 700; color: var(--primary);">${percentage}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
        </div>
    `;
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-bar input');
        if (searchInput) searchInput.focus();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => modal.remove());
    }
});

// ==================== COPY TO CLIPBOARD ====================
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        notifications.show('Copied to clipboard!', 'success', 2000);
    }).catch(() => {
        notifications.show('Failed to copy', 'error', 2000);
    });
}

// ==================== INITIALIZE ON LOAD ====================
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
});

// Make functions globally accessible
window.toggleTheme = toggleTheme;
window.loadTheme = loadTheme;
window.addSearchBar = addSearchBar;
window.filterTable = filterTable;
window.notifications = notifications;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.exportTableToCSV = exportTableToCSV;
window.printContent = printContent;
window.confirmAction = confirmAction;
window.validateForm = validateForm;
window.AutoSave = AutoSave;
window.createProgressChart = createProgressChart;
window.copyToClipboard = copyToClipboard;


// ==================== WELCOME ANIMATION ====================
function showWelcomeAnimation(userName) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.5s ease-out;
    `;
    
    overlay.innerHTML = `
        <div style="text-align: center; color: white;">
            <div style="font-size: 80px; margin-bottom: 20px; animation: bounce 1s infinite;">🏠</div>
            <h1 style="font-size: 48px; font-weight: 800; margin-bottom: 16px; animation: fadeIn 0.8s ease-out;">
                Welcome, ${userName}!
            </h1>
            <p style="font-size: 20px; opacity: 0.9; animation: fadeIn 1s ease-out;">
                Loading your dashboard...
            </p>
            <div class="spinner" style="margin-top: 32px; border-color: rgba(255,255,255,0.3); border-top-color: white;"></div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        overlay.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => overlay.remove(), 500);
    }, 2000);
}

// ==================== FADE OUT ANIMATION ====================
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==================== SCROLL TO TOP BUTTON ====================
function addScrollToTop() {
    const button = document.createElement('button');
    button.id = 'scroll-to-top';
    button.innerHTML = '↑';
    button.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        box-shadow: var(--shadow-lg);
        display: none;
        z-index: 1000;
        transition: var(--transition);
    `;
    
    button.onclick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    document.body.appendChild(button);
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            button.style.display = 'block';
        } else {
            button.style.display = 'none';
        }
    });
}

// Initialize scroll to top on dashboard load
if (document.getElementById('dashboard-section')) {
    addScrollToTop();
}

// Make functions globally accessible
window.showWelcomeAnimation = showWelcomeAnimation;
window.addScrollToTop = addScrollToTop;
