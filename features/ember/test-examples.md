# Ember 2.0 Test Examples

These are examples of completely natural code that AIs can write without knowing anything about Ember. All of these will be automatically detected and executed by Ember 2.0.

## Simple Interactive Button

```javascript
const button = document.createElement('button');
button.textContent = 'Click me!';
button.style.padding = '10px 20px';
button.style.backgroundColor = '#007bff';
button.style.color = 'white';
button.style.border = 'none';
button.style.borderRadius = '5px';
button.style.cursor = 'pointer';

button.addEventListener('click', () => {
    alert('Hello from Ember!');
});

document.body.appendChild(button);
```

## Simple Chart

```javascript
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

new Chart(canvas, {
    type: 'bar',
    data: {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
        datasets: [{
            label: '# of Votes',
            data: [12, 19, 3, 5, 2, 3],
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 205, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 159, 64, 0.2)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 205, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ],
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});
```

## Simple Calculator

```javascript
const container = document.createElement('div');
container.style.padding = '20px';
container.style.backgroundColor = '#f0f0f0';
container.style.borderRadius = '10px';
container.style.maxWidth = '300px';

const display = document.createElement('input');
display.type = 'text';
display.style.width = '100%';
display.style.padding = '10px';
display.style.fontSize = '18px';
display.style.textAlign = 'right';
display.style.marginBottom = '10px';
display.readOnly = true;

container.appendChild(display);

const buttons = [
    ['C', '±', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '=']
];

let currentInput = '';
let operator = '';
let previousInput = '';

buttons.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.style.display = 'flex';
    rowDiv.style.gap = '5px';
    rowDiv.style.marginBottom = '5px';

    row.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn;
        button.style.flex = btn === '0' ? '2' : '1';
        button.style.padding = '15px';
        button.style.fontSize = '16px';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.backgroundColor = '#fff';

        button.addEventListener('click', () => {
            if (btn === 'C') {
                currentInput = '';
                operator = '';
                previousInput = '';
                display.value = '';
            } else if (btn === '=') {
                if (previousInput && operator && currentInput) {
                    const prev = parseFloat(previousInput);
                    const curr = parseFloat(currentInput);
                    let result;

                    switch (operator) {
                        case '+': result = prev + curr; break;
                        case '-': result = prev - curr; break;
                        case '×': result = prev * curr; break;
                        case '÷': result = prev / curr; break;
                    }

                    display.value = result;
                    currentInput = result.toString();
                    operator = '';
                    previousInput = '';
                }
            } else if (['+', '-', '×', '÷'].includes(btn)) {
                if (currentInput) {
                    operator = btn;
                    previousInput = currentInput;
                    currentInput = '';
                }
            } else {
                currentInput += btn;
                display.value = currentInput;
            }
        });

        rowDiv.appendChild(button);
    });

    container.appendChild(rowDiv);
});

document.body.appendChild(container);
```

## Interactive Form

```html
<div style="padding: 20px; background: #f8f9fa; border-radius: 10px; max-width: 400px;">
    <h3>Contact Form</h3>

    <label for="name">Name:</label>
    <input type="text" id="name" placeholder="Your name" style="width: 100%; padding: 8px; margin: 5px 0 15px 0;">

    <label for="email">Email:</label>
    <input type="email" id="email" placeholder="your@email.com" style="width: 100%; padding: 8px; margin: 5px 0 15px 0;">

    <label for="message">Message:</label>
    <textarea id="message" placeholder="Your message..." style="width: 100%; padding: 8px; margin: 5px 0 15px 0; height: 80px;"></textarea>

    <button onclick="submitForm()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
        Submit
    </button>
</div>

<script>
function submitForm() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;

    if (name && email && message) {
        alert(`Thank you ${name}! Your message has been received.`);
        // Clear form
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('message').value = '';
    } else {
        alert('Please fill in all fields.');
    }
}
</script>
```

## Simple Animation

```javascript
const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 300;
canvas.style.border = '1px solid #000';
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d');

let x = 50;
let y = 150;
let dx = 2;
let dy = 1;

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bouncing ball
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b6b';
    ctx.fill();

    // Update position
    x += dx;
    y += dy;

    // Bounce off walls
    if (x + 20 > canvas.width || x - 20 < 0) dx = -dx;
    if (y + 20 > canvas.height || y - 20 < 0) dy = -dy;

    requestAnimationFrame(animate);
}

animate();
```

## D3.js Visualization

```javascript
const svg = d3.select(document.body)
    .append('svg')
    .attr('width', 400)
    .attr('height', 300);

const data = [30, 86, 168, 281, 303, 365];

svg.selectAll('rect')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', (d, i) => i * 60)
    .attr('y', d => 300 - d)
    .attr('width', 50)
    .attr('height', d => d)
    .attr('fill', 'steelblue');

svg.selectAll('text')
    .data(data)
    .enter()
    .append('text')
    .text(d => d)
    .attr('x', (d, i) => i * 60 + 25)
    .attr('y', d => 300 - d - 5)
    .attr('text-anchor', 'middle')
    .attr('fill', 'black');
```

## Simple Game

```javascript
const gameContainer = document.createElement('div');
gameContainer.style.padding = '20px';
gameContainer.style.backgroundColor = '#e8f5e8';
gameContainer.style.borderRadius = '10px';
gameContainer.style.maxWidth = '400px';
gameContainer.style.textAlign = 'center';

const title = document.createElement('h2');
title.textContent = 'Number Guessing Game';
gameContainer.appendChild(title);

const instructions = document.createElement('p');
instructions.textContent = 'Guess a number between 1 and 100!';
gameContainer.appendChild(instructions);

const input = document.createElement('input');
input.type = 'number';
input.placeholder = 'Enter your guess';
input.style.padding = '10px';
input.style.margin = '10px';
gameContainer.appendChild(input);

const button = document.createElement('button');
button.textContent = 'Guess';
button.style.padding = '10px 20px';
button.style.backgroundColor = '#4CAF50';
button.style.color = 'white';
button.style.border = 'none';
button.style.borderRadius = '5px';
button.style.cursor = 'pointer';
gameContainer.appendChild(button);

const result = document.createElement('p');
result.style.fontSize = '18px';
result.style.fontWeight = 'bold';
gameContainer.appendChild(result);

const randomNumber = Math.floor(Math.random() * 100) + 1;
let attempts = 0;

button.addEventListener('click', () => {
    const guess = parseInt(input.value);
    attempts++;

    if (guess === randomNumber) {
        result.textContent = `🎉 Correct! You guessed it in ${attempts} attempts!`;
        result.style.color = 'green';
        button.disabled = true;
    } else if (guess < randomNumber) {
        result.textContent = 'Too low! Try again.';
        result.style.color = 'blue';
    } else {
        result.textContent = 'Too high! Try again.';
        result.style.color = 'red';
    }

    input.value = '';
});

document.body.appendChild(gameContainer);
```

## All of these examples will work automatically with Ember 2.0!

The AI doesn't need to know about:
- `root` elements
- `ember.inject()`
- Special formatting
- Library loading
- Sandbox setup

It just writes normal, natural code and Ember handles everything automatically!