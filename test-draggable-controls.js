/**
 * Test script for draggable video controls functionality
 * Run this in browser console to test drag and fade behavior
 */

(function() {
    'use strict';

    console.log('🎮 Testing Draggable Video Controls...');

    function testDraggableControls() {
        console.group('Draggable Controls Tests');
        
        // Check if extension is loaded
        if (typeof window.AnimatedBackgrounds === 'undefined') {
            console.error('❌ AnimatedBackgrounds extension not loaded');
            console.groupEnd();
            return;
        }

        const extension = window.AnimatedBackgrounds;
        
        // Check if there are currently visible controls
        const controls = document.getElementById('video-background-controls');
        console.log('Video controls visible:', !!controls);
        
        if (controls) {
            console.log('Controls element:', controls);
            console.log('Controls classes:', controls.className);
            console.log('Controls position:', {
                left: controls.style.left || 'auto',
                top: controls.style.top || 'auto',
                right: controls.style.right || 'auto',
                bottom: controls.style.bottom || 'auto'
            });
            
            // Check for drag handle
            const dragHandle = controls.querySelector('.drag-handle');
            console.log('Drag handle exists:', !!dragHandle);
            
            // Check drag state
            console.log('Current drag state:', extension.dragData);
            
            // Check saved position
            const savedPosition = localStorage.getItem('animated-bg-controls-position');
            console.log('Saved position:', savedPosition ? JSON.parse(savedPosition) : null);
            
            // Check fade state
            console.log('Is faded:', controls.classList.contains('faded'));
            console.log('Is dragging:', controls.classList.contains('dragging'));
            
        } else {
            console.log('No video controls visible. Load a video first.');
        }
        
        console.groupEnd();
    }

    // Manual test functions
    window.testDraggableControls = {
        runAllTests: testDraggableControls,
        
        getControls: function() {
            return document.getElementById('video-background-controls');
        },
        
        showControls: function() {
            if (window.AnimatedBackgrounds) {
                // Try to show video controls by loading a test video
                const hasVideo = window.AnimatedBackgrounds.hasCurrentVideo();
                if (hasVideo) {
                    if (window.AnimatedBackgrounds.showVideoControls) {
                        window.AnimatedBackgrounds.showVideoControls();
                    } else if (window.AnimatedBackgrounds.showYouTubeControls) {
                        const player = window.AnimatedBackgrounds.getCurrentVideoElement();
                        window.AnimatedBackgrounds.showYouTubeControls(player);
                    }
                } else {
                    console.log('No video loaded. Load a video first to see controls.');
                }
            }
        },
        
        forceShowControls: function() {
            // Create test controls for testing drag functionality
            const controls = document.createElement('div');
            controls.id = 'video-background-controls';
            controls.className = 'enhanced-bg-controls visible';
            controls.innerHTML = `
                <div class="drag-handle" title="Drag to move"></div>
                <div class="video-control-group">
                    <button title="Test Button">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <span>Test Controls</span>
                </div>
            `;
            
            // Remove existing controls
            const existing = document.getElementById('video-background-controls');
            if (existing) existing.remove();
            
            document.body.appendChild(controls);
            
            // Apply drag functionality manually
            if (window.AnimatedBackgrounds) {
                window.AnimatedBackgrounds.loadControlsPosition(controls);
                window.AnimatedBackgrounds.bindDragEvents(controls);
                window.AnimatedBackgrounds.setupControlsFadeBehavior(controls);
            }
            
            console.log('Test controls created');
        },
        
        testFade: function() {
            const controls = this.getControls();
            if (!controls) {
                console.log('No controls visible. Run forceShowControls() first.');
                return;
            }
            
            console.log('Testing fade behavior...');
            console.log('Initial state - faded:', controls.classList.contains('faded'));
            
            // Simulate hover
            controls.dispatchEvent(new MouseEvent('mouseenter'));
            console.log('After mouseenter - faded:', controls.classList.contains('faded'));
            
            // Simulate mouse leave
            setTimeout(() => {
                controls.dispatchEvent(new MouseEvent('mouseleave'));
                console.log('After mouseleave - faded:', controls.classList.contains('faded'));
                
                // Check fade after delay
                setTimeout(() => {
                    console.log('After fade delay - faded:', controls.classList.contains('faded'));
                }, 2500);
            }, 1000);
        },
        
        testDragSimulation: function() {
            const controls = this.getControls();
            if (!controls) {
                console.log('No controls visible. Run forceShowControls() first.');
                return;
            }
            
            const dragHandle = controls.querySelector('.drag-handle');
            if (!dragHandle) {
                console.log('No drag handle found');
                return;
            }
            
            console.log('Testing drag simulation...');
            
            // Get initial position
            const initialRect = controls.getBoundingClientRect();
            console.log('Initial position:', { x: initialRect.left, y: initialRect.top });
            
            // Simulate mousedown
            const startEvent = new MouseEvent('mousedown', {
                clientX: initialRect.left + 50,
                clientY: initialRect.top + 10,
                bubbles: true
            });
            dragHandle.dispatchEvent(startEvent);
            console.log('Drag started');
            
            // Simulate mousemove
            setTimeout(() => {
                const moveEvent = new MouseEvent('mousemove', {
                    clientX: initialRect.left + 150,
                    clientY: initialRect.top + 100,
                    bubbles: true
                });
                document.dispatchEvent(moveEvent);
                console.log('Drag moved');
                
                // Simulate mouseup
                setTimeout(() => {
                    const endEvent = new MouseEvent('mouseup', { bubbles: true });
                    document.dispatchEvent(endEvent);
                    
                    const finalRect = controls.getBoundingClientRect();
                    console.log('Final position:', { x: finalRect.left, y: finalRect.top });
                    console.log('Drag completed');
                }, 500);
            }, 500);
        },
        
        resetPosition: function() {
            const controls = this.getControls();
            if (controls) {
                controls.style.left = 'auto';
                controls.style.top = 'auto';
                controls.style.right = '20px';
                controls.style.bottom = '20px';
                localStorage.removeItem('animated-bg-controls-position');
                console.log('Position reset to default');
            }
        },
        
        moveTo: function(x, y) {
            const controls = this.getControls();
            if (controls) {
                controls.style.left = x + 'px';
                controls.style.top = y + 'px';
                controls.style.right = 'auto';
                controls.style.bottom = 'auto';
                
                // Save position
                if (window.AnimatedBackgrounds && window.AnimatedBackgrounds.saveControlsPosition) {
                    window.AnimatedBackgrounds.saveControlsPosition(controls);
                }
                
                console.log(`Moved controls to (${x}, ${y})`);
            }
        },
        
        getSavedPosition: function() {
            const saved = localStorage.getItem('animated-bg-controls-position');
            return saved ? JSON.parse(saved) : null;
        },
        
        testViewportConstraints: function() {
            console.log('Testing viewport constraints...');
            const controls = this.getControls();
            if (!controls) {
                console.log('No controls visible');
                return;
            }
            
            const positions = [
                { x: -100, y: -100, desc: 'negative coordinates' },
                { x: window.innerWidth + 100, y: 100, desc: 'beyond right edge' },
                { x: 100, y: window.innerHeight + 100, desc: 'beyond bottom edge' },
                { x: window.innerWidth / 2, y: window.innerHeight / 2, desc: 'center of screen' }
            ];
            
            positions.forEach((pos, index) => {
                setTimeout(() => {
                    this.moveTo(pos.x, pos.y);
                    const rect = controls.getBoundingClientRect();
                    console.log(`${pos.desc}: requested (${pos.x}, ${pos.y}) -> actual (${rect.left}, ${rect.top})`);
                }, index * 1000);
            });
        }
    };

    // Run initial tests
    testDraggableControls();

    console.log('📋 Draggable controls test functions available:');
    console.log('  testDraggableControls.runAllTests()');
    console.log('  testDraggableControls.showControls()');
    console.log('  testDraggableControls.forceShowControls()');
    console.log('  testDraggableControls.testFade()');
    console.log('  testDraggableControls.testDragSimulation()');
    console.log('  testDraggableControls.moveTo(x, y)');
    console.log('  testDraggableControls.resetPosition()');
    console.log('  testDraggableControls.getSavedPosition()');
    console.log('  testDraggableControls.testViewportConstraints()');

})();