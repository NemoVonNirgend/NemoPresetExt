/**
 * Test script for volume control functionality
 * Run this in browser console to test volume controls while video is playing
 */

(function() {
    'use strict';

    console.log('🔊 Testing Volume Control Functionality...');

    function testVolumeControls() {
        console.group('Volume Control Tests');
        
        // Check if extension is loaded
        if (typeof window.AnimatedBackgrounds === 'undefined') {
            console.error('❌ AnimatedBackgrounds extension not loaded');
            console.groupEnd();
            return;
        }

        const extension = window.AnimatedBackgrounds;
        
        // Check if there's a current video
        const hasVideo = extension.hasCurrentVideo();
        console.log('Has current video:', hasVideo);
        
        if (hasVideo) {
            const video = extension.getCurrentVideoElement();
            console.log('Current video element:', video);
            console.log('Video properties:', {
                src: video.src,
                volume: video.volume,
                muted: video.muted,
                paused: video.paused,
                currentTime: video.currentTime,
                duration: video.duration
            });
            
            // Check for video controls
            const controls = document.getElementById('video-background-controls');
            console.log('Video controls visible:', !!controls);
            
            // Check settings UI
            const volumeSlider = document.getElementById('anim-bg-volume');
            const liveVolumeSlider = document.getElementById('video-live-volume');
            console.log('Settings volume slider:', !!volumeSlider);
            console.log('Live volume slider:', !!liveVolumeSlider);
            
            if (volumeSlider) {
                console.log('Settings volume value:', volumeSlider.value);
            }
            if (liveVolumeSlider) {
                console.log('Live volume value:', liveVolumeSlider.value);
            }
        } else {
            console.log('No video currently playing. Upload a video first.');
        }
        
        console.groupEnd();
    }

    // Manual test functions
    window.testVolumeControl = {
        runAllTests: testVolumeControls,
        
        getCurrentVideo: function() {
            if (window.AnimatedBackgrounds) {
                return window.AnimatedBackgrounds.getCurrentVideoElement();
            }
            return null;
        },
        
        setVolume: function(volume) {
            if (volume < 0 || volume > 1) {
                console.error('Volume must be between 0 and 1');
                return;
            }
            
            const video = this.getCurrentVideo();
            if (video) {
                video.volume = volume;
                video.muted = false;
                console.log(`Volume set to ${Math.round(volume * 100)}%`);
                
                // Update UI sliders
                const settingsSlider = document.getElementById('anim-bg-volume');
                const liveSlider = document.getElementById('video-live-volume');
                const settingsValue = document.getElementById('anim-bg-volume-value');
                const liveValue = document.getElementById('video-live-volume-value');
                
                if (settingsSlider) settingsSlider.value = volume;
                if (liveSlider) liveSlider.value = volume;
                if (settingsValue) settingsValue.textContent = Math.round(volume * 100) + '%';
                if (liveValue) liveValue.textContent = Math.round(volume * 100) + '%';
            } else {
                console.error('No video currently playing');
            }
        },
        
        mute: function() {
            const video = this.getCurrentVideo();
            if (video) {
                video.muted = true;
                console.log('Video muted');
            }
        },
        
        unmute: function() {
            const video = this.getCurrentVideo();
            if (video) {
                video.muted = false;
                console.log('Video unmuted');
            }
        },
        
        togglePause: function() {
            const video = this.getCurrentVideo();
            if (video) {
                if (video.paused) {
                    video.play();
                    console.log('Video resumed');
                } else {
                    video.pause();
                    console.log('Video paused');
                }
            }
        },
        
        restart: function() {
            const video = this.getCurrentVideo();
            if (video) {
                video.currentTime = 0;
                console.log('Video restarted');
            }
        },
        
        showControls: function() {
            if (window.AnimatedBackgrounds && window.AnimatedBackgrounds.showVideoControls) {
                window.AnimatedBackgrounds.showVideoControls();
                console.log('Video controls shown');
            }
        },
        
        hideControls: function() {
            if (window.AnimatedBackgrounds && window.AnimatedBackgrounds.hideVideoControls) {
                window.AnimatedBackgrounds.hideVideoControls();
                console.log('Video controls hidden');
            }
        },

        testVolumeRamping: function() {
            console.log('Testing volume ramping from 0% to 100% over 5 seconds...');
            const video = this.getCurrentVideo();
            if (!video) {
                console.error('No video currently playing');
                return;
            }

            let volume = 0;
            video.muted = false;
            
            const interval = setInterval(() => {
                volume += 0.1;
                if (volume > 1) {
                    volume = 1;
                    clearInterval(interval);
                    console.log('Volume ramping test complete');
                }
                
                this.setVolume(volume);
                console.log(`Volume: ${Math.round(volume * 100)}%`);
            }, 500);
        }
    };

    // Run initial tests
    testVolumeControls();

    console.log('📋 Manual test functions available:');
    console.log('  testVolumeControl.runAllTests()');
    console.log('  testVolumeControl.setVolume(0.5)  // 0-1');
    console.log('  testVolumeControl.mute()');
    console.log('  testVolumeControl.unmute()');
    console.log('  testVolumeControl.togglePause()');
    console.log('  testVolumeControl.restart()');
    console.log('  testVolumeControl.showControls()');
    console.log('  testVolumeControl.hideControls()');
    console.log('  testVolumeControl.testVolumeRamping()');

})();