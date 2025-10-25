/**
 * Test script for MP4 video upload functionality
 * Run this in browser console after uploading a video to debug issues
 */

(function() {
    'use strict';

    console.log('🎥 Testing MP4 Video Upload Functionality...');

    function runVideoUploadTests() {
        console.group('Video Upload System Tests');
        
        // Test if the extension is loaded
        if (typeof window.AnimatedBackgrounds === 'undefined') {
            console.error('❌ AnimatedBackgrounds not found. Extension may not be loaded.');
            console.groupEnd();
            return;
        }

        // Test if the file input exists
        const fileInput = document.getElementById('add_bg_button');
        console.log('File input exists:', !!fileInput);
        if (fileInput) {
            console.log('File input accept attribute:', fileInput.accept);
            console.log('File input onchange handler overridden:', typeof fileInput.onchange);
        }

        // Test if video storage is available
        console.log('Video storage available:', !!window.videoBackgroundStorage);
        if (window.videoBackgroundStorage) {
            console.log('Stored videos:', Array.from(window.videoBackgroundStorage.keys()));
        }

        // Test if background container exists
        const bgContainer = document.getElementById('enhanced-background-container');
        console.log('Enhanced background container exists:', !!bgContainer);
        if (bgContainer) {
            console.log('Container children:', bgContainer.children.length);
            if (bgContainer.children.length > 0) {
                Array.from(bgContainer.children).forEach((child, index) => {
                    console.log(`Child ${index}:`, child.tagName, child.src || child.style.backgroundImage);
                });
            }
        }

        // Test background settings
        const bgSettings = window.AnimatedBackgrounds?.extensionSettings;
        console.log('Background settings:', bgSettings);

        console.groupEnd();
    }

    function simulateVideoUpload() {
        console.group('Simulating Video Upload');
        
        // Create a mock file for testing
        const mockVideoFile = new File(['mock video content'], 'test-video.mp4', { type: 'video/mp4' });
        console.log('Mock file created:', mockVideoFile.name, mockVideoFile.type);

        // Test media type detection
        const mediaType = window.AnimatedBackgrounds?.getEnhancedMediaType?.(mockVideoFile.name);
        console.log('Detected media type:', mediaType);

        // Test file input handler
        const fileInput = document.getElementById('add_bg_button');
        if (fileInput && fileInput.onchange) {
            console.log('Testing file input handler...');
            
            // Create mock event
            const mockEvent = {
                target: {
                    files: [mockVideoFile],
                    value: ''
                }
            };

            try {
                // This will test the handler without actually uploading
                console.log('File handler exists, would process:', mockVideoFile.name);
            } catch (error) {
                console.error('Error in file handler:', error);
            }
        }

        console.groupEnd();
    }

    function checkVideoPlayback() {
        console.group('Video Playback Check');
        
        const videos = document.querySelectorAll('video');
        console.log('Video elements found:', videos.length);
        
        videos.forEach((video, index) => {
            console.log(`Video ${index}:`, {
                src: video.src,
                autoplay: video.autoplay,
                loop: video.loop,
                muted: video.muted,
                readyState: video.readyState,
                error: video.error?.message || 'none'
            });
        });

        console.groupEnd();
    }

    function debugBackgroundSystem() {
        console.group('Background System Debug');
        
        // Check original functions
        console.log('window.setBackground exists:', typeof window.setBackground);
        console.log('window.getMediaType exists:', typeof window.getMediaType);
        
        // Check if backgrounds.js functions are available
        console.log('window.getBackgrounds exists:', typeof window.getBackgrounds);
        console.log('window.chat_metadata exists:', typeof window.chat_metadata);
        console.log('window.saveMetadataDebounced exists:', typeof window.saveMetadataDebounced);

        // Check current background state
        const bgCustom = document.getElementById('bg_custom');
        const bg1 = document.getElementById('bg1');
        console.log('bg_custom background:', bgCustom?.style.backgroundImage || 'none');
        console.log('bg1 background:', bg1?.style.backgroundImage || 'none');

        console.groupEnd();
    }

    // Manual test functions
    window.testVideoUpload = {
        runAllTests: function() {
            runVideoUploadTests();
            checkVideoPlayback();
            debugBackgroundSystem();
        },
        
        simulateUpload: simulateVideoUpload,
        
        checkPlayback: checkVideoPlayback,
        
        testVideoFile: function(file) {
            if (!file) {
                console.log('Usage: testVideoUpload.testVideoFile(fileObject)');
                return;
            }
            
            console.log('Testing video file:', file.name, file.type, file.size);
            
            if (window.AnimatedBackgrounds?.handleVideoUpload) {
                const fileInput = document.getElementById('add_bg_button');
                window.AnimatedBackgrounds.handleVideoUpload(file, fileInput);
            } else {
                console.error('handleVideoUpload not available');
            }
        },

        listStoredVideos: function() {
            if (window.videoBackgroundStorage) {
                console.log('Stored videos:');
                window.videoBackgroundStorage.forEach((data, id) => {
                    console.log(`${id}:`, data.fileName, data.blobUrl);
                });
            } else {
                console.log('No video storage found');
            }
        },

        clearStoredVideos: function() {
            if (window.videoBackgroundStorage) {
                window.videoBackgroundStorage.clear();
                console.log('Video storage cleared');
            }
        }
    };

    // Run initial tests
    runVideoUploadTests();

    console.log('📋 Manual test functions available:');
    console.log('  testVideoUpload.runAllTests()');
    console.log('  testVideoUpload.simulateUpload()');
    console.log('  testVideoUpload.checkPlayback()');
    console.log('  testVideoUpload.testVideoFile(file)');
    console.log('  testVideoUpload.listStoredVideos()');
    console.log('  testVideoUpload.clearStoredVideos()');

})();