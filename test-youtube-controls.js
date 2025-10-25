/**
 * Test script for YouTube volume control functionality
 * Run this in browser console to test YouTube controls
 */

(function() {
    'use strict';

    console.log('📺 Testing YouTube Volume Control...');

    function testYouTubeControls() {
        console.group('YouTube Control Tests');
        
        // Check if extension is loaded
        if (typeof window.AnimatedBackgrounds === 'undefined') {
            console.error('❌ AnimatedBackgrounds extension not loaded');
            console.groupEnd();
            return;
        }

        const extension = window.AnimatedBackgrounds;
        
        // Check YouTube API status
        console.log('YouTube API loaded:', !!window.YT);
        console.log('YouTube Player class available:', !!(window.YT && window.YT.Player));
        console.log('Extension YouTube API ready:', extension.youtubeApiReady);
        
        // Check if there's a current YouTube player
        const hasVideo = extension.hasCurrentVideo();
        console.log('Has current video/player:', hasVideo);
        
        if (hasVideo) {
            const player = extension.getCurrentVideoElement();
            console.log('Current player element:', player);
            
            // Test if it's a YouTube player
            if (player && typeof player.setVolume === 'function') {
                console.log('✅ YouTube player detected');
                console.log('Player properties:', {
                    volume: player.getVolume(),
                    muted: player.isMuted(),
                    playerState: player.getPlayerState(),
                    videoId: player.getVideoData()?.video_id || 'unknown'
                });
            } else if (player && player.tagName === 'VIDEO') {
                console.log('✅ HTML5 video detected');
                console.log('Video properties:', {
                    volume: player.volume,
                    muted: player.muted,
                    paused: player.paused
                });
            } else {
                console.log('❓ Unknown player type');
            }
            
            // Check for YouTube controls
            const youtubeControls = document.getElementById('video-background-controls');
            console.log('YouTube controls visible:', !!youtubeControls);
            
            // Check settings UI
            const volumeSlider = document.getElementById('anim-bg-volume');
            const youtubeVolumeSlider = document.getElementById('youtube-live-volume');
            console.log('Settings volume slider:', !!volumeSlider);
            console.log('YouTube live volume slider:', !!youtubeVolumeSlider);
            
        } else {
            console.log('No video/player currently active. Load a YouTube video first.');
        }
        
        console.groupEnd();
    }

    // Manual test functions
    window.testYouTubeControls = {
        runAllTests: testYouTubeControls,
        
        getCurrentPlayer: function() {
            if (window.AnimatedBackgrounds) {
                return window.AnimatedBackgrounds.getCurrentVideoElement();
            }
            return null;
        },
        
        testYouTubeVideo: function(url) {
            url = url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
            console.log('Testing YouTube video:', url);
            
            if (window.AnimatedBackgrounds && window.AnimatedBackgrounds.handleYouTubePaste) {
                window.AnimatedBackgrounds.handleYouTubePaste(url);
            } else {
                console.error('YouTube paste handler not available');
            }
        },
        
        setYouTubeVolume: function(volume) {
            if (volume < 0 || volume > 100) {
                console.error('Volume must be between 0 and 100');
                return;
            }
            
            const player = this.getCurrentPlayer();
            if (player && typeof player.setVolume === 'function') {
                player.setVolume(volume);
                player.unMute();
                console.log(`YouTube volume set to ${volume}%`);
                
                // Update UI sliders
                const settingsSlider = document.getElementById('anim-bg-volume');
                const youtubeSlider = document.getElementById('youtube-live-volume');
                const settingsValue = document.getElementById('anim-bg-volume-value');
                const youtubeValue = document.getElementById('youtube-live-volume-value');
                
                if (settingsSlider) settingsSlider.value = volume / 100;
                if (youtubeSlider) youtubeSlider.value = volume;
                if (settingsValue) settingsValue.textContent = volume + '%';
                if (youtubeValue) youtubeValue.textContent = volume + '%';
            } else {
                console.error('No YouTube player currently active');
            }
        },
        
        muteYouTube: function() {
            const player = this.getCurrentPlayer();
            if (player && typeof player.mute === 'function') {
                player.mute();
                console.log('YouTube player muted');
            } else {
                console.error('No YouTube player currently active');
            }
        },
        
        unmuteYouTube: function() {
            const player = this.getCurrentPlayer();
            if (player && typeof player.unMute === 'function') {
                player.unMute();
                console.log('YouTube player unmuted');
            } else {
                console.error('No YouTube player currently active');
            }
        },
        
        playPauseYouTube: function() {
            const player = this.getCurrentPlayer();
            if (player && typeof player.getPlayerState === 'function') {
                const state = player.getPlayerState();
                if (state === window.YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                    console.log('YouTube player paused');
                } else {
                    player.playVideo();
                    console.log('YouTube player resumed');
                }
            } else {
                console.error('No YouTube player currently active');
            }
        },
        
        restartYouTube: function() {
            const player = this.getCurrentPlayer();
            if (player && typeof player.seekTo === 'function') {
                player.seekTo(0);
                player.playVideo();
                console.log('YouTube player restarted');
            } else {
                console.error('No YouTube player currently active');
            }
        },
        
        getYouTubeInfo: function() {
            const player = this.getCurrentPlayer();
            if (player && typeof player.getVideoData === 'function') {
                const data = player.getVideoData();
                const info = {
                    title: data.title,
                    videoId: data.video_id,
                    author: data.author,
                    volume: player.getVolume(),
                    muted: player.isMuted(),
                    duration: player.getDuration(),
                    currentTime: player.getCurrentTime(),
                    playerState: player.getPlayerState()
                };
                console.log('YouTube player info:', info);
                return info;
            } else {
                console.error('No YouTube player currently active');
                return null;
            }
        },

        testVolumeSync: function() {
            console.log('Testing volume synchronization between UI elements...');
            const player = this.getCurrentPlayer();
            if (!player || typeof player.setVolume !== 'function') {
                console.error('No YouTube player currently active');
                return;
            }

            const volumes = [0, 25, 50, 75, 100];
            let index = 0;

            const testNext = () => {
                if (index >= volumes.length) {
                    console.log('✅ Volume sync test complete');
                    return;
                }

                const volume = volumes[index];
                console.log(`Setting volume to ${volume}%...`);
                
                // Set via extension method to test synchronization
                if (window.AnimatedBackgrounds && window.AnimatedBackgrounds.updateCurrentVideoProperties) {
                    const settings = window.AnimatedBackgrounds.getSettings();
                    settings.videoVolume = volume / 100;
                    settings.enableMute = false;
                    window.AnimatedBackgrounds.updateCurrentVideoProperties(settings);
                }

                // Check if UI elements are synced
                setTimeout(() => {
                    const settingsSlider = document.getElementById('anim-bg-volume');
                    const youtubeSlider = document.getElementById('youtube-live-volume');
                    
                    console.log('Sync check:', {
                        playerVolume: player.getVolume(),
                        settingsSlider: settingsSlider ? Math.round(settingsSlider.value * 100) : 'N/A',
                        youtubeSlider: youtubeSlider ? youtubeSlider.value : 'N/A'
                    });

                    index++;
                    setTimeout(testNext, 1000);
                }, 500);
            };

            testNext();
        }
    };

    // Run initial tests
    testYouTubeControls();

    console.log('📋 YouTube test functions available:');
    console.log('  testYouTubeControls.runAllTests()');
    console.log('  testYouTubeControls.testYouTubeVideo(url)');
    console.log('  testYouTubeControls.setYouTubeVolume(50)  // 0-100');
    console.log('  testYouTubeControls.muteYouTube()');
    console.log('  testYouTubeControls.unmuteYouTube()');
    console.log('  testYouTubeControls.playPauseYouTube()');
    console.log('  testYouTubeControls.restartYouTube()');
    console.log('  testYouTubeControls.getYouTubeInfo()');
    console.log('  testYouTubeControls.testVolumeSync()');

})();