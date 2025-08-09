// Script to analyze CSS usage in the project
const fs = require('fs');
const path = require('path');

// Collect all CSS selectors
function extractSelectors(cssContent) {
    const selectors = new Set();
    
    // Remove comments
    cssContent = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Match CSS selectors (simplified regex)
    const selectorRegex = /([^{}\s][^{}]*?)\s*{[^}]*}/g;
    let match;
    
    while ((match = selectorRegex.exec(cssContent)) !== null) {
        const selector = match[1].trim();
        
        // Split compound selectors
        const parts = selector.split(/\s*,\s*/);
        parts.forEach(part => {
            // Extract class names, IDs, and element selectors
            const classMatches = part.match(/\.[a-zA-Z0-9_-]+/g) || [];
            const idMatches = part.match(/#[a-zA-Z0-9_-]+/g) || [];
            const elementMatches = part.match(/^[a-zA-Z]+/g) || [];
            
            classMatches.forEach(cls => selectors.add(cls));
            idMatches.forEach(id => selectors.add(id));
            elementMatches.forEach(elem => selectors.add(elem));
        });
    }
    
    return selectors;
}

// Collect all used selectors from HTML and JS files
function findUsedSelectors() {
    const used = new Set();
    
    // Read HTML files
    const htmlFiles = ['index.html', 'data-repair.html', 'test-account-validation.html', 'test-undo-redo.html'];
    
    htmlFiles.forEach(file => {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            
            // Find classes
            const classMatches = content.match(/class\s*=\s*["']([^"']+)["']/g) || [];
            classMatches.forEach(match => {
                const classes = match.match(/class\s*=\s*["']([^"']+)["']/)[1].split(/\s+/);
                classes.forEach(cls => used.add('.' + cls));
            });
            
            // Find IDs
            const idMatches = content.match(/id\s*=\s*["']([^"']+)["']/g) || [];
            idMatches.forEach(match => {
                const id = match.match(/id\s*=\s*["']([^"']+)["']/)[1];
                used.add('#' + id);
            });
            
            // Find element usage
            const elementMatches = content.match(/<([a-zA-Z]+)[^>]*>/g) || [];
            elementMatches.forEach(match => {
                const element = match.match(/<([a-zA-Z]+)/)[1];
                used.add(element);
            });
        }
    });
    
    // Read JS files for dynamic class/ID usage
    function scanJSFiles(dir) {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory() && !file.startsWith('.')) {
                scanJSFiles(filePath);
            } else if (file.endsWith('.js')) {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Find class additions
                const classAddMatches = content.match(/classList\.(add|toggle|remove)\s*\(\s*["']([^"']+)["']/g) || [];
                classAddMatches.forEach(match => {
                    const cls = match.match(/["']([^"']+)["']/)[1];
                    used.add('.' + cls);
                });
                
                // Find querySelector usage
                const queryMatches = content.match(/querySelector(All)?\s*\(\s*["']([^"']+)["']/g) || [];
                queryMatches.forEach(match => {
                    const selector = match.match(/["']([^"']+)["']/)[1];
                    // Extract classes and IDs from selector
                    const classMatches = selector.match(/\.[a-zA-Z0-9_-]+/g) || [];
                    const idMatches = selector.match(/#[a-zA-Z0-9_-]+/g) || [];
                    
                    classMatches.forEach(cls => used.add(cls));
                    idMatches.forEach(id => used.add(id));
                });
                
                // Find getElementById
                const getByIdMatches = content.match(/getElementById\s*\(\s*["']([^"']+)["']/g) || [];
                getByIdMatches.forEach(match => {
                    const id = match.match(/["']([^"']+)["']/)[1];
                    used.add('#' + id);
                });
                
                // Find className assignments
                const classNameMatches = content.match(/className\s*=\s*["']([^"']+)["']/g) || [];
                classNameMatches.forEach(match => {
                    const classes = match.match(/["']([^"']+)["']/)[1].split(/\s+/);
                    classes.forEach(cls => used.add('.' + cls));
                });
            }
        });
    }
    
    scanJSFiles('js');
    
    return used;
}

// Main analysis
console.log('Analyzing CSS usage...\n');

const usedSelectors = findUsedSelectors();
console.log(`Found ${usedSelectors.size} used selectors\n`);

// Analyze each CSS file
const cssFiles = fs.readdirSync('css').filter(f => f.endsWith('.css'));
const unusedByFile = {};

cssFiles.forEach(file => {
    const cssPath = path.join('css', file);
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const selectors = extractSelectors(cssContent);
    
    const unused = [];
    selectors.forEach(selector => {
        if (!usedSelectors.has(selector)) {
            unused.push(selector);
        }
    });
    
    unusedByFile[file] = {
        total: selectors.size,
        unused: unused.length,
        percentage: Math.round((unused.length / selectors.size) * 100),
        selectors: unused
    };
});

// Report results
console.log('CSS Usage Report:\n');
console.log('File                        | Total | Unused | % Unused');
console.log('---------------------------|-------|--------|----------');

Object.entries(unusedByFile).forEach(([file, data]) => {
    console.log(
        `${file.padEnd(26)} | ${data.total.toString().padStart(5)} | ${data.unused.toString().padStart(6)} | ${data.percentage.toString().padStart(7)}%`
    );
});

// Show top unused selectors
console.log('\n\nTop 10 potentially unused selectors:');
let count = 0;
Object.entries(unusedByFile).forEach(([file, data]) => {
    if (count < 10 && data.selectors.length > 0) {
        console.log(`\nFrom ${file}:`);
        data.selectors.slice(0, 5).forEach(sel => {
            console.log(`  - ${sel}`);
            count++;
        });
    }
});

console.log('\n\nNote: This is a simple static analysis. Some selectors may be used dynamically.');
console.log('Always test thoroughly after removing CSS rules.');
