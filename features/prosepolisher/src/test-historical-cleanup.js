/**
 * Test suite for Historical Cleanup System
 * Provides test cases and utilities for validating HTML/CSS removal
 */

// Test data samples
const testSamples = {
    htmlWithText: `
        <div class="message" style="color: red;">
            Hello world! This is some text.
            <p>More text here</p>
        </div>
    `,
    
    cssBlock: `
        Some text before
        <style>
            .message { color: red; font-size: 14px; }
            #container { background: blue; }
        </style>
        Some text after
    `,
    
    scriptTags: `
        Text before script
        <script>
            console.log("This should be removed");
            function badFunction() { }
        </script>
        Text after script
    `,
    
    mixedContent: `
        <div style="padding: 10px;" class="user-message">
            Character said: "Hello there!"
            <p style="margin: 5px;">She smiled warmly.</p>
            <style>.temp { display: none; }</style>
        </div>
        The conversation continued.
    `,
    
    narrativeText: `
        She walked slowly into the room, her eyes scanning the dimly lit space.
        "What are you doing here?" she whispered, her voice barely audible.
        He looked up from his work, surprised by her sudden appearance.
    `,
    
    codeBlockNotCode: `
        \`\`\`
        She said softly, "I've been thinking about what you told me yesterday."
        He nodded, understanding the weight of her words.
        They sat in silence for a moment, contemplating.
        \`\`\`
    `,
    
    actualJavaScript: `
        \`\`\`javascript
        function processData(items) {
            const results = items.map(item => {
                return item.value * 2;
            });
            return results;
        }
        \`\`\`
    `,
    
    htmlEntities: `
        Text with &nbsp; spaces and &amp; symbols.
        Also has &quot;quotes&quot; and &lt;tags&gt;.
    `
};

/**
 * Run all tests and display results
 */
function runTests() {
    console.log('=== Historical Cleanup Test Suite ===\n');
    
    if (!window.ProsePolisher || !window.ProsePolisher.historicalCleanup) {
        console.error('❌ Historical Cleanup not initialized!');
        console.log('Make sure ProsePolisher is loaded and initialized.');
        return;
    }
    
    const cleanup = window.ProsePolisher.historicalCleanup;
    const results = [];
    
    // Test 1: HTML with text preservation
    console.log('Test 1: HTML Tag Removal with Text Preservation');
    const result1 = cleanup.testCleanup(testSamples.htmlWithText);
    console.log('Before:', result1.before);
    console.log('After:', result1.after);
    console.log('Stats:', result1);
    console.log(result1.after.includes('Hello world!') ? '✅ PASS' : '❌ FAIL');
    results.push({ test: 'HTML Text Preservation', pass: result1.after.includes('Hello world!') });
    console.log('\n---\n');
    
    // Test 2: CSS block removal
    console.log('Test 2: CSS Block Removal');
    const result2 = cleanup.testCleanup(testSamples.cssBlock);
    console.log('Before:', result2.before);
    console.log('After:', result2.after);
    console.log('Stats:', result2);
    console.log(!result2.after.includes('<style>') ? '✅ PASS' : '❌ FAIL');
    results.push({ test: 'CSS Block Removal', pass: !result2.after.includes('<style>') });
    console.log('\n---\n');
    
    // Test 3: Script tag removal
    console.log('Test 3: Script Tag Removal');
    const result3 = cleanup.testCleanup(testSamples.scriptTags);
    console.log('Before:', result3.before);
    console.log('After:', result3.after);
    console.log('Stats:', result3);
    console.log(!result3.after.includes('<script>') ? '✅ PASS' : '❌ FAIL');
    results.push({ test: 'Script Removal', pass: !result3.after.includes('<script>') });
    console.log('\n---\n');
    
    // Test 4: Mixed content cleanup
    console.log('Test 4: Mixed HTML/CSS Cleanup');
    const result4 = cleanup.testCleanup(testSamples.mixedContent);
    console.log('Before:', result4.before);
    console.log('After:', result4.after);
    console.log('Stats:', result4);
    const hasText = result4.after.includes('Hello there!') && result4.after.includes('She smiled warmly');
    const noHtml = !result4.after.includes('<div>') && !result4.after.includes('style=');
    console.log(hasText && noHtml ? '✅ PASS' : '❌ FAIL');
    results.push({ test: 'Mixed Content', pass: hasText && noHtml });
    console.log('\n---\n');
    
    // Test 5: Narrative text preservation
    console.log('Test 5: Narrative Text Preservation (No Changes)');
    const result5 = cleanup.testCleanup(testSamples.narrativeText);
    console.log('Before:', result5.before);
    console.log('After:', result5.after);
    console.log('Stats:', result5);
    const unchanged = result5.after.trim() === testSamples.narrativeText.trim();
    console.log(unchanged ? '✅ PASS' : '❌ FAIL');
    results.push({ test: 'Narrative Preservation', pass: unchanged });
    console.log('\n---\n');
    
    // Test 6: Message processing
    console.log('Test 6: Message Array Processing');
    const messages = [
        { mes: testSamples.htmlWithText, name: 'Old Message 1' },
        { mes: testSamples.cssBlock, name: 'Old Message 2' },
        { mes: testSamples.mixedContent, name: 'Old Message 3' },
        { mes: testSamples.narrativeText, name: 'Recent Message' },
        { mes: 'Current message', name: 'Current' }
    ];
    const processed = cleanup.processMessages(messages);
    console.log('Processed', processed.length, 'messages');
    console.log('Message 0 (should be cleaned):', processed[0].mes.substring(0, 100));
    console.log('Message 3 (should be unchanged):', processed[3].mes.substring(0, 100));
    const msg0Clean = !processed[0].mes.includes('<div>');
    const msg3Unchanged = processed[3].mes === testSamples.narrativeText;
    console.log(msg0Clean && msg3Unchanged ? '✅ PASS' : '❌ FAIL');
    results.push({ test: 'Message Processing', pass: msg0Clean && msg3Unchanged });
    console.log('\n---\n');
    
    // Summary
    console.log('\n=== Test Summary ===');
    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    console.log(`${passed}/${total} tests passed`);
    results.forEach(r => {
        console.log(`${r.pass ? '✅' : '❌'} ${r.test}`);
    });
    
    return results;
}

/**
 * Interactive test function for custom input
 */
function testCustomInput(input) {
    if (!window.ProsePolisher || !window.ProsePolisher.historicalCleanup) {
        console.error('❌ Historical Cleanup not initialized!');
        return;
    }
    
    const cleanup = window.ProsePolisher.historicalCleanup;
    const result = cleanup.testCleanup(input);
    
    console.log('=== Custom Input Test ===');
    console.log('Input:', result.before);
    console.log('\nOutput:', result.after);
    console.log('\nStats:', {
        lengthBefore: result.lengthBefore,
        lengthAfter: result.lengthAfter,
        reduction: result.reduction,
        patternsUsed: result.patternsUsed
    });
    
    return result;
}

/**
 * Test Ember code detection
 */
function testEmberCodeDetection() {
    console.log('=== Ember Code Detection Tests ===\n');
    
    // These should NOT be processed as code
    const notCode = [
        testSamples.narrativeText,
        testSamples.codeBlockNotCode
    ];
    
    // This SHOULD be processed as code
    const isCode = [
        testSamples.actualJavaScript
    ];
    
    console.log('Samples that should NOT be detected as code:');
    notCode.forEach((sample, i) => {
        console.log(`\nSample ${i + 1}:`, sample.substring(0, 100) + '...');
        // Note: Ember detection would happen in the Ember extension
        // This is just showing what content we're testing
    });
    
    console.log('\n\nSamples that SHOULD be detected as code:');
    isCode.forEach((sample, i) => {
        console.log(`\nSample ${i + 1}:`, sample.substring(0, 100) + '...');
    });
}

// Expose test functions globally
window.testHistoricalCleanup = runTests;
window.testCustomCleanup = testCustomInput;
window.testEmberDetection = testEmberCodeDetection;

// Auto-run tests if requested
if (typeof window !== 'undefined' && window.location.search.includes('autotest=true')) {
    setTimeout(() => {
        console.log('Auto-running Historical Cleanup tests...');
        runTests();
    }, 2000);
}

console.log('Historical Cleanup test functions loaded:');
console.log('- testHistoricalCleanup() - Run all tests');
console.log('- testCustomCleanup(text) - Test custom input');
console.log('- testEmberDetection() - Show Ember detection samples');