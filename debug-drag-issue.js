/**
 * Debug script for drag handle issues
 * Run this in browser console to diagnose drag problems
 */

(function() {
    'use strict';

    console.log('🔧 Debugging Drag Handle Issues...');

    function debugDragHandle() {
        console.group('Drag Handle Debug');
        
        // Find the controls
        const controls = document.getElementById('video-background-controls');
        console.log('Controls found:', !!controls);
        
        if (!controls) {
            console.error('❌ No video controls found');
            console.groupEnd();
            return;
        }

        // Check drag handle
        const dragHandle = controls.querySelector('.drag-handle');
        console.log('Drag handle found:', !!dragHandle);
        
        if (!dragHandle) {
            console.error('❌ No drag handle found in controls');
            console.log('Controls HTML:', controls.innerHTML);
            console.groupEnd();
            return;
        }

        // Check drag handle properties
        const handleRect = dragHandle.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(dragHandle);
        
        console.log('Drag handle rect:', {
            x: handleRect.x,
            y: handleRect.y,
            width: handleRect.width,
            height: handleRect.height,
            top: handleRect.top,
            left: handleRect.left,
            bottom: handleRect.bottom,
            right: handleRect.right
        });
        
        console.log('Drag handle computed style:', {
            position: computedStyle.position,
            top: computedStyle.top,
            left: computedStyle.left,
            width: computedStyle.width,
            height: computedStyle.height,
            background: computedStyle.background,
            cursor: computedStyle.cursor,
            zIndex: computedStyle.zIndex,
            visibility: computedStyle.visibility,
            display: computedStyle.display
        });

        // Check if handle is visible and clickable
        const isVisible = handleRect.width > 0 && handleRect.height > 0;
        const centerX = handleRect.left + handleRect.width / 2;
        const centerY = handleRect.top + handleRect.height / 2;
        const elementAtCenter = document.elementFromPoint(centerX, centerY);
        
        console.log('Handle visibility check:', {
            isVisible,
            centerPoint: { x: centerX, y: centerY },
            elementAtCenter: elementAtCenter,
            isHandleClickable: elementAtCenter === dragHandle
        });

        // Check event listeners
        console.log('Drag handle element:', dragHandle);
        console.log('Has mousedown listeners:', !!dragHandle.onmousedown);

        // Check extension state
        if (window.AnimatedBackgrounds) {
            const extension = window.AnimatedBackgrounds;
            console.log('Extension drag data:', extension.dragData);
            console.log('Extension bound handlers:', !!extension.boundDragHandlers);
        }

        console.groupEnd();
    }

    function fixDragHandle() {
        console.log('🔧 Attempting to fix drag handle...');
        
        const controls = document.getElementById('video-background-controls');
        if (!controls) {
            console.error('No controls found to fix');
            return;
        }

        let dragHandle = controls.querySelector('.drag-handle');
        
        // If drag handle doesn't exist, create it
        if (!dragHandle) {
            console.log('Creating missing drag handle...');
            dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';
            dragHandle.title = 'Drag to move';
            controls.insertBefore(dragHandle, controls.firstChild);
        }

        // Force better positioning and visibility
        dragHandle.style.cssText = `
            position: absolute !important;
            top: -15px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 50px !important;
            height: 12px !important;
            background: rgba(76, 175, 80, 0.8) !important;
            border: 2px solid rgba(255, 255, 255, 0.8) !important;
            border-radius: 6px !important;
            cursor: grab !important;
            z-index: 1000 !important;
            transition: all 0.2s ease !important;
        `;

        // Add hover effect
        dragHandle.addEventListener('mouseenter', () => {
            dragHandle.style.background = 'rgba(76, 175, 80, 1)';
            dragHandle.style.transform = 'translateX(-50%) scale(1.1)';
        });

        dragHandle.addEventListener('mouseleave', () => {
            if (!window.AnimatedBackgrounds?.dragData?.isDragging) {
                dragHandle.style.background = 'rgba(76, 175, 80, 0.8)';
                dragHandle.style.transform = 'translateX(-50%)';
            }
        });

        // Bind drag events manually
        let isDragging = false;
        let startX, startY, elementX, elementY;

        dragHandle.addEventListener('mousedown', (e) => {
            console.log('🎯 Manual drag handle mousedown triggered');
            e.preventDefault();
            e.stopPropagation();
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = controls.getBoundingClientRect();
            elementX = rect.left;
            elementY = rect.top;
            
            controls.classList.add('dragging');
            controls.classList.remove('faded');
            document.body.style.userSelect = 'none';
            dragHandle.style.cursor = 'grabbing';
            
            console.log('Manual drag started from:', { startX, startY, elementX, elementY });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newX = elementX + deltaX;
            const newY = elementY + deltaY;
            
            // Constrain to viewport
            const rect = controls.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            
            const constrainedX = Math.max(0, Math.min(newX, maxX));
            const constrainedY = Math.max(0, Math.min(newY, maxY));
            
            controls.style.left = constrainedX + 'px';
            controls.style.top = constrainedY + 'px';
            controls.style.right = 'auto';
            controls.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            
            isDragging = false;
            controls.classList.remove('dragging');
            document.body.style.userSelect = '';
            dragHandle.style.cursor = 'grab';
            
            // Save position
            const rect = controls.getBoundingClientRect();
            const position = { x: rect.left, y: rect.top };
            localStorage.setItem('animated-bg-controls-position', JSON.stringify(position));
            
            console.log('Manual drag completed, saved position:', position);
        });

        console.log('✅ Drag handle fixed and manual events bound');
    }

    function testDragHandle() {
        console.log('🧪 Testing drag handle click...');
        
        const dragHandle = document.querySelector('#video-background-controls .drag-handle');
        if (!dragHandle) {
            console.error('No drag handle to test');
            return;
        }

        // Simulate a click
        const clickEvent = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100
        });

        console.log('Dispatching test mousedown event...');
        const result = dragHandle.dispatchEvent(clickEvent);
        console.log('Event dispatched result:', result);
        
        // Simulate mouseup to complete
        setTimeout(() => {
            const upEvent = new MouseEvent('mouseup', { bubbles: true });
            document.dispatchEvent(upEvent);
            console.log('Test mouseup dispatched');
        }, 100);
    }

    // Export functions for console use
    window.debugDrag = {
        debug: debugDragHandle,
        fix: fixDragHandle,
        test: testDragHandle,
        
        makeVisible: function() {
            const dragHandle = document.querySelector('#video-background-controls .drag-handle');
            if (dragHandle) {
                dragHandle.style.background = 'red !important';
                dragHandle.style.height = '20px !important';
                dragHandle.style.border = '3px solid yellow !important';
                console.log('Made drag handle more visible');
            }
        },

        resetPosition: function() {
            const controls = document.getElementById('video-background-controls');
            if (controls) {
                controls.style.left = 'auto';
                controls.style.top = 'auto';
                controls.style.right = '20px';
                controls.style.bottom = '20px';
                localStorage.removeItem('animated-bg-controls-position');
                console.log('Position reset to default');
            }
        }
    };

    // Run initial debug
    debugDragHandle();

    console.log('📋 Debug functions available:');
    console.log('  debugDrag.debug() - Full diagnostic');
    console.log('  debugDrag.fix() - Fix drag handle');
    console.log('  debugDrag.test() - Test drag events');
    console.log('  debugDrag.makeVisible() - Make handle more visible');
    console.log('  debugDrag.resetPosition() - Reset to default position');

})();