/**
 * Test script for Animated Backgrounds Extension
 * Run this in browser console to test functionality
 */

(function() {
    'use strict';

    console.log('🎬 Testing Animated Backgrounds Extension...');

    // Test URLs for different media types
    const testData = {
        youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeShort: 'https://youtu.be/dQw4w9WgXcQ',
        mp4: 'sample.mp4',
        webm: 'sample.webm',
        gif: 'animated.gif',
        webp: 'animated.webp',
        jpg: 'image.jpg',
        png: 'image.png',
        invalidUrl: 'not-a-url'
    };

    function runTests() {
        console.group('Media Type Detection Tests');
        
        // Test if the extension loaded
        if (typeof window.AnimatedBackgrounds === 'undefined') {
            console.error('❌ AnimatedBackgrounds not found in window. Extension may not be loaded.');
            return;
        }
        
        const extension = window.AnimatedBackgrounds;
        
        // Test media type detection
        console.log('Testing YouTube URL:', extension.getEnhancedMediaType(testData.youtube));
        console.log('Testing YouTube Short URL:', extension.getEnhancedMediaType(testData.youtubeShort));
        console.log('Testing MP4:', extension.getEnhancedMediaType(testData.mp4));
        console.log('Testing WebM:', extension.getEnhancedMediaType(testData.webm));
        console.log('Testing GIF:', extension.getEnhancedMediaType(testData.gif));
        console.log('Testing WebP:', extension.getEnhancedMediaType(testData.webp));
        console.log('Testing JPG:', extension.getEnhancedMediaType(testData.jpg));
        console.log('Testing PNG:', extension.getEnhancedMediaType(testData.png));
        console.log('Testing Invalid:', extension.getEnhancedMediaType(testData.invalidUrl));
        
        console.groupEnd();
        
        // Test settings
        console.group('Settings Tests');
        console.log('Current settings:', extension.extensionSettings);
        console.groupEnd();
        
        // Test UI elements
        console.group('UI Tests');
        
        const backgroundContainer = document.getElementById('enhanced-background-container');
        console.log('Background container exists:', !!backgroundContainer);
        
        const settingsPanel = document.getElementById('animated-backgrounds-settings');
        console.log('Settings panel exists:', !!settingsPanel);
        
        const urlInput = document.getElementById('bg-url-input');
        console.log('URL input exists:', !!urlInput);
        
        const uploadArea = document.getElementById('bg_menu_content');
        console.log('Upload area exists:', !!uploadArea);
        
        console.groupEnd();
        
        // Test functionality
        console.group('Functionality Tests');
        
        // Test YouTube URL validation
        const isValidYouTube1 = testYouTubeUrl(testData.youtube);
        const isValidYouTube2 = testYouTubeUrl(testData.youtubeShort);
        const isInvalidYouTube = testYouTubeUrl('https://example.com');
        
        console.log('YouTube URL validation test 1:', isValidYouTube1 ? '✅ Pass' : '❌ Fail');
        console.log('YouTube URL validation test 2:', isValidYouTube2 ? '✅ Pass' : '❌ Fail');  
        console.log('Invalid URL rejection test:', !isInvalidYouTube ? '✅ Pass' : '❌ Fail');
        
        console.groupEnd();
        
        console.log('✅ Testing complete!');
    }
    
    function testYouTubeUrl(url) {
        return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(url);
    }
    
    // Test if extension module exists
    if (typeof window.AnimatedBackgrounds !== 'undefined') {
        runTests();
    } else {
        console.warn('⏳ AnimatedBackgrounds not loaded yet. Waiting...');
        
        // Wait for extension to load
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof window.AnimatedBackgrounds !== 'undefined') {
                clearInterval(checkInterval);
                console.log('✅ AnimatedBackgrounds loaded!');
                runTests();
            } else if (attempts > 20) {
                clearInterval(checkInterval);
                console.error('❌ AnimatedBackgrounds failed to load after 10 seconds');
            }
        }, 500);
    }
    
    // Additional manual test functions
    window.testAnimatedBackgrounds = {
        testYouTube: function(url) {
            url = url || testData.youtube;
            console.log('Testing YouTube background:', url);
            if (window.AnimatedBackgrounds && window.AnimatedBackgrounds.setAnimatedBackground) {
                window.AnimatedBackgrounds.setAnimatedBackground(url, 'youtube');
            }
        },
        
        testVideo: function(url) {
            url = url || 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4';
            console.log('Testing video background:', url);
            if (window.AnimatedBackgrounds && window.AnimatedBackgrounds.setAnimatedBackground) {
                window.AnimatedBackgrounds.setAnimatedBackground(url, 'video');
            }
        },
        
        showSettings: function() {
            console.log('Current settings:', window.AnimatedBackgrounds?.extensionSettings);
        }
    };
    
    console.log('📋 Manual test functions available:');
    console.log('  testAnimatedBackgrounds.testYouTube(url)');
    console.log('  testAnimatedBackgrounds.testVideo(url)');
    console.log('  testAnimatedBackgrounds.showSettings()');

})();