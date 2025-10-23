const fs = require('fs');
const path = require('path');

// Read the NemoEngine preset
const presetPath = path.join(__dirname, 'NemoEngine 7.5.json');
const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

console.log(`Processing ${preset.prompts.length} prompts...`);

// Function to add directive line to content
function addDirective(content, directive) {
    // Only add if not already present
    if (content.includes(directive)) {
        return content;
    }
    return `{{// ${directive} }}\n` + content;
}

// Process each prompt
preset.prompts.forEach((prompt, index) => {
    const name = prompt.name || 'Unnamed';
    console.log(`\nProcessing: ${name}`);

    let content = prompt.content || '';

    // Add tooltip based on name/content
    let tooltip = '';
    if (name.includes('Pacing')) {
        tooltip = '@tooltip Controls the speed and intensity of story progression';
    } else if (name.includes('Genre')) {
        tooltip = '@tooltip Sets the emotional tone and style of the narrative';
    } else if (name.includes('World')) {
        tooltip = '@tooltip Manages background characters and living world dynamics';
    } else if (name.includes('Persona')) {
        tooltip = '@tooltip Complete personality override for Vex storytelling style';
    } else if (name.includes('Difficulty') || name.includes('STANCE')) {
        tooltip = '@tooltip Adjusts NPC cooperation and challenge level';
    } else if (name.includes('Combat') || name.includes('Injuries')) {
        tooltip = '@tooltip Realistic combat mechanics with injury simulation';
    } else if (name.includes('NSFW') || name.includes('Explicit')) {
        tooltip = '@tooltip Adult content controls and explicit scene handling';
    } else if (name.includes('Romance')) {
        tooltip = '@tooltip Romance and relationship development settings';
    } else if (name.includes('Comedy')) {
        tooltip = '@tooltip Humor and comedic timing controls';
    } else if (name.includes('Output') || name.includes('Response')) {
        tooltip = '@tooltip Controls response length and formatting';
    } else {
        tooltip = `@tooltip ${name} - Toggle this prompt on/off`;
    }

    // Add category
    let category = '';
    if (name.includes('Fluff') || name.includes('Angst') || name.includes('Romance') || name.includes('Comedy') || name.includes('Tragedy') || name.includes('Medieval') || name.includes('Melancholy') || name.includes('Ao3')) {
        category = '@category Genre';
    } else if (name.includes('Pacing') || name.includes('World')) {
        category = '@category Pacing & World';
    } else if (name.includes('Persona') || name.includes('Party') || name.includes('Goth')) {
        category = '@category Vex Personas';
    } else if (name.includes('Difficulty') || name.includes('STANCE')) {
        category = '@category Difficulty';
    } else if (name.includes('Output') || name.includes('Response') || name.includes('Length')) {
        category = '@category Output Format';
    } else if (name.includes('NSFW') || name.includes('Explicit')) {
        category = '@category NSFW';
    } else {
        category = '@category Misc';
    }

    // Add icon
    let icon = '';
    if (name.includes('Fluff')) icon = '@icon 💕';
    else if (name.includes('Angst')) icon = '@icon 💔';
    else if (name.includes('Romance')) icon = '@icon ❤️';
    else if (name.includes('Comedy')) icon = '@icon 😂';
    else if (name.includes('Tragedy')) icon = '@icon 😢';
    else if (name.includes('Ao3')) icon = '@icon 📝';
    else if (name.includes('Medieval')) icon = '@icon ⚔️';
    else if (name.includes('Melancholy')) icon = '@icon 🌙';
    else if (name.includes('Party')) icon = '@icon 🎉';
    else if (name.includes('Goth')) icon = '@icon 🖤';
    else if (name.includes('Pacing')) icon = '@icon ⏱️';
    else if (name.includes('World')) icon = '@icon 🌍';
    else if (name.includes('Combat')) icon = '@icon ⚔️';
    else if (name.includes('NSFW')) icon = '@icon 🔞';

    // Add author
    const author = '@author NokiaArmour';

    // Add version
    const version = '@version 7.5.0';

    // Add directives to content
    if (tooltip) content = addDirective(content, tooltip);
    if (category) content = addDirective(content, category);
    if (icon) content = addDirective(content, icon);
    content = addDirective(content, author);
    content = addDirective(content, version);

    // Update the prompt
    prompt.content = content;

    console.log(`  ✓ Added: ${[tooltip ? 'tooltip' : '', category ? 'category' : '', icon ? 'icon' : '', 'author', 'version'].filter(Boolean).join(', ')}`);
});

// Write back to file with proper formatting
fs.writeFileSync(presetPath, JSON.stringify(preset, null, 4), 'utf8');
console.log(`\n✅ Successfully processed ${preset.prompts.length} prompts!`);
console.log(`📁 Updated: ${presetPath}`);
