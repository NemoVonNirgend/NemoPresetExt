export const ANIMATION_GROUPS = {
    "idle": [
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle2.bvh"
        // FBX files moved to separate group due to potential loading issues
        // "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Old Man Idle.fbx",
        // "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Hanging Idle.fbx"
    ],
    "walk": {
        "neutral": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/action_walk.bvh"
            // FBX files commented out due to loading reliability issues
            // "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Standard Walk.fbx",
            // "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Walk.fbx"
        ],
        "sad": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/action_walk.bvh" // Fallback to reliable BVH
            // "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Sad Walk.fbx"
        ],
        "drunk": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/action_walk.bvh" // Fallback to reliable BVH
            // "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Drunk Walk.fbx"
        ]
    },
    "activity": [
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/action_gaming.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/action_greeting.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/action_greeting1.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/action_pat.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/action_pickingup.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Bicycle Crunch.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Box Jump.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Capoeira.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/exercise_crunches.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/exercise_jogging.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/exercise_jumping_jacks.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Female Dance Pose.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Golf Pre-Putt.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Hip Hop Dancing.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Petting Animal.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Praying.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Salsa Dancing.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Sitting Laughing.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Sitting.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Situps.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Talking On Phone.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Talking.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Taunt.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_1.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_2.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_backup.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_dab.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_gangnam_style.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_headdrop.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_marachinostep.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_northern_soul_spin.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_ontop.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_pushback.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_rumba.bvh"
    ],
    "dance": [
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_1.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_2.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_backup.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_dab.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_gangnam_style.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_headdrop.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_marachinostep.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_northern_soul_spin.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_ontop.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_pushback.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/dance_rumba.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Hip Hop Dancing.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Salsa Dancing.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Female Dance Pose.fbx"
    ],
    "exercise": [
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/exercise_crunch.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/exercise_crunches.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/exercise_jogging.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/exercise_jumping_jacks.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Bicycle Crunch.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Box Jump.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Situps.fbx"
    ],
    "sit_idle": [
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/sit_idle.bvh",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Sitting.fbx",
        "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Sitting Laughing.fbx"
    ],
    "emotional_response": {
        "admiration": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/admiration.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/admiration2.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/admiration3.bvh"
        ],
        "amusement": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/amusement.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/amusement2.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/amusement3.bvh"
        ],
        "anger": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/anger.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/anger2.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/anger3.bvh"
        ],
        "annoyance": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/annoyance.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/annoyance1.bvh"
        ],
        "approval": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/approval.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/approval2.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/approval3.bvh"
        ],
        "caring": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/caring.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/caring1.bvh"
        ],
        "confusion": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/confusion.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/confusion2.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/confusion3.bvh"
        ],
        "curiosity": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral2.bvh"
        ],
        "desire": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/desire.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/desire1.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/desire2.bvh"
        ],
        "disappointment": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/disappointment.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/disappointment2.bvh"
        ],
        "disapproval": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/disapproval.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/disaproval1.bvh"
        ],
        "disgust": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/disgust.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/disgust1.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/disgust2.bvh"
        ],
        "embarrassment": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/embarrassment.bvh"
        ],
        "excitement": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/excitement.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/excitement2.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/Excited.fbx"
        ],
        "fear": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh" // Using neutral as fallback
        ],
        "gratitude": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/gratitude.bvh"
        ],
        "grief": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/grief.bvh"
        ],
        "joy": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh", // Using neutral as base
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral2.bvh"
        ],
        "love": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/love2.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/love3.bvh"
        ],
        "nervousness": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/nervousness.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/nervousness2.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/nervousnes3.bvh"
        ],
        "optimism": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/optimism.bvh"
        ],
        "pride": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh" // Using neutral as fallback
        ],
        "realization": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh" // Using neutral as fallback
        ],
        "relief": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh" // Using neutral as fallback
        ],
        "remorse": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh" // Using neutral as fallback
        ],
        "sadness": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh" // Using neutral as fallback
        ],
        "surprise": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh" // Using neutral as fallback
        ],
        "neutral": [
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral2.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral3.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral4.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle.bvh",
            "/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral_idle2.bvh"
        ]
    }
};