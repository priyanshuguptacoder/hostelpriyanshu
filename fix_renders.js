const fs = require('fs');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove showLoading(); and hideLoading(); calls from render functions
    // It's tricky to only target render functions with regex, but let's try to remove them all inside try blocks of render functions
    // Actually, we can just replace all `showLoading();` and `hideLoading();` that are alone on a line inside render functions.
    
    // Instead of complex regex, let's just do simple replacements.
    // We'll add the AbortError check to catch blocks.
    content = content.replace(/catch\s*\(\s*error\s*\)\s*\{/g, "catch (error) {\n        if (error.name === 'AbortError') throw error;");

    // Remove showLoading() and hideLoading() completely from these files where they are just bare function calls?
    // Wait, some actions like `createAnnouncement` might still need them.
    // Let's remove them from `render...` functions specifically.
    
    // A simpler approach is to find all functions starting with `render` and remove the loading calls inside them.
    const functionRegex = /(async function render[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)([\s\S]*?)(\n\})/g;
    
    content = content.replace(functionRegex, (match, p1, p2, p3) => {
        let body = p2;
        body = body.replace(/^[ \t]*showLoading\(\);\s*\n/gm, '');
        body = body.replace(/^[ \t]*hideLoading\(\);\s*\n/gm, '');
        return p1 + body + p3;
    });

    // Also remove from non-async render functions if any
    const syncFunctionRegex = /(function render[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)([\s\S]*?)(\n\})/g;
    content = content.replace(syncFunctionRegex, (match, p1, p2, p3) => {
        if (p1.includes('async')) return match; // Handled above
        let body = p2;
        body = body.replace(/^[ \t]*showLoading\(\);\s*\n/gm, '');
        body = body.replace(/^[ \t]*hideLoading\(\);\s*\n/gm, '');
        return p1 + body + p3;
    });
    
    // There might be some edge cases like `if (window.showLoading) window.showLoading();` in actions. We leave those.

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed ${filePath}`);
}

processFile('public/js/dashboard.js');
processFile('public/js/warden.js');
