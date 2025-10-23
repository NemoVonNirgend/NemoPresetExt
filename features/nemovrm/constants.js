import { loadFileToDocument } from "../../../../../utils.js";
import { ANIMATION_GROUPS } from "./animations.js";
export {
    MODULE_NAME,
    extensionFolderPath,
    DEBUG_PREFIX,
    VRM_CANVAS_ID,
    VRM_MODEL_FOLDER,
    CLASSIFY_EXPRESSIONS,
    FALLBACK_EXPRESSION,
    DEFAULT_EXPRESSION_MAPPING,
    ANIMATION_GROUPS,
    MIN_SCALE,
    MAX_SCALE,
    ANIMATION_FADE_TIME,
    SPRITE_DIV,
    VN_MODE_DIV,
    DEFAULT_SCALE,
    HITBOXES,
    HIT_BOX_DELAY,
    DEFAULT_LIGHT_COLOR,
    DEFAULT_LIGHT_INTENSITY,
    LOCAL_ASSETS_PATH,
    LOCAL_MODELS_PATH,
    LOCAL_ANIMATIONS_PATH,
    LOCAL_ENVIRONMENTS_PATH
}

const MODULE_NAME = "NemoVRM";
const VRM_MODEL_FOLDER = "vrm";
const extensionFolderPath = `scripts/extensions/third-party/NemoPresetExt/features/nemovrm`;
const DEBUG_PREFIX = "<NemoVRM module>";
const VRM_CANVAS_ID = "nemovrm-canvas";
const MIN_SCALE = 0.2;
const MAX_SCALE = 30;
const ANIMATION_FADE_TIME = 0.3;
const SPRITE_DIV = 'expression-wrapper';
const VN_MODE_DIV = 'visual-novel-wrapper';

const DEFAULT_SCALE = 3.0;
const HIT_BOX_DELAY = 100;
const DEFAULT_LIGHT_COLOR = "#FFFFFF";
const DEFAULT_LIGHT_INTENSITY = 100;

// Local asset paths
const LOCAL_ASSETS_PATH = `${extensionFolderPath}/assets`;
const LOCAL_MODELS_PATH = `${LOCAL_ASSETS_PATH}/models`;
const LOCAL_ANIMATIONS_PATH = `${LOCAL_ASSETS_PATH}/animations`;
const LOCAL_ENVIRONMENTS_PATH = `${LOCAL_ASSETS_PATH}/environments`;

const JS_LIBS = [
"es-module-shims.js"
]

// Load JS libraries
for(const i of JS_LIBS){
    await loadFileToDocument(
        `${extensionFolderPath}/lib/${i}`,
        "js"
    );
}

const CLASSIFY_EXPRESSIONS = [
    "admiration",
    "amusement",
    "anger",
    "annoyance",
    "approval",
    "caring",
    "confusion",
    "curiosity",
    "desire",
    "disappointment",
    "disapproval",
    "disgust",
    "embarrassment",
    "excitement",
    "fear",
    "gratitude",
    "grief",
    "joy",
    "love",
    "nervousness",
    "optimism",
    "pride",
    "realization",
    "relief",
    "remorse",
    "sadness",
    "surprise",
    "neutral"
];

const FALLBACK_EXPRESSION = "neutral";

const DEFAULT_EXPRESSION_MAPPING = {
    // Fallback
    "default": "neutral",

    // Classify class
    "admiration": "relaxed",
    "amusement": "relaxed",
    "anger": "angry",
    "annoyance": "angry",
    "approval": "relaxed",
    "caring": "relaxed",
    "confusion": "surprised",
    "curiosity": "surprised",
    "desire": "relaxed",
    "disappointment": "angry",
    "disapproval": "angry",
    "disgust": "angry",
    "embarrassment": "surprised",
    "excitement": "surprised",
    "fear": "sad",
    "gratitude": "relaxed",
    "grief": "sad",
    "joy": "relaxed",
    "love": "relaxed",
    "nervousness": "sad",
    "optimism": "relaxed",
    "pride": "relaxed",
    "realization": "surprised",
    "relief": "relaxed",
    "remorse": "sad",
    "sadness": "sad",
    "surprise": "surprised",
    "neutral": "neutral",
    "walk": "neutral",
    "activity": "neutral",
    "emotional_response": "neutral",

    // Hitboxes
    "head": "relaxed",
    "chest": "angry",
    "groin": "angry",
    "butt": "angry",
    "leftHand": "relaxed",
    "rightHand": "relaxed",
    "leftLeg": "surprised",
    "rightLeg": "surprised",
    "rightFoot": "surprised",
    "leftFoot": "surprised"
}


const HITBOXES = {
    "head": {
        "bone": "head",
        "size": {
            "x":0.1,
            "y":0.1,
            "z":0.1,
        },
        "offset": {
            "x":0,
            "y":0.08,
            "z":0,
        },
        "color": 0x6699ff
    },
    "chest": {
        "bone": "upperChest",
        "size": {
            "x":0.15,
            "y":0.1,
            "z":0.08,
        },
        "offset": {
            "x":0,
            "y":0.00,
            "z":-0.1,
        },
        "color": 0x6666ff
    },
    "leftHand": {
        "bone": "leftHand",
        "size": {
            "x":0.07,
            "y":0.07,
            "z":0.07,
        },
        "offset": {
            "x":0.05,
            "y":-0.05,
            "z":0.0,
        },
        "color": 0x6666ff
    },
    "rightHand": {
        "bone": "rightHand",
        "size": {
            "x":0.07,
            "y":0.07,
            "z":0.07,
        },
        "offset": {
            "x":-0.05,
            "y":-0.05,
            "z":0.0,
        },
        "color": 0x6666ff
    },
    "groin": {
        "bone": "hips",
        "size": {
            "x":0.05,
            "y":0.05,
            "z":0.12,
        },
        "offset": {
            "x":0,
            "y":-0.1,
            "z":-0.1,
        },
        "color": 0xff99e6
    },
    "butt": {
        "bone": "hips",
        "size": {
            "x":0.15,
            "y":0.1,
            "z":0.05,
        },
        "offset": {
            "x":0,
            "y":0,
            "z":0.1,
        },
        "color": 0xff00ff
    },
    "leftLeg": {
        "bone": "leftLowerLeg",
        "size": {
            "x":0.1,
            "y":0.2,
            "z":0.1,
        },
        "offset": {
            "x":0,
            "y":0,
            "z":0,
        },
        "color": 0x6600cc
    },
    "rightLeg": {
        "bone": "rightLowerLeg",
        "size": {
            "x":0.1,
            "y":0.2,
            "z":0.1,
        },
        "offset": {
            "x":0,
            "y":0,
            "z":0,
        },
        "color": 0x6600cc
    },
    "leftFoot": {
        "bone": "leftFoot",
        "size": {
            "x":0.1,
            "y":0.1,
            "z":0.1,
        },
        "offset": {
            "x":0,
            "y":0,
            "z":0,
        },
        "color": 0x6600cc
    },
    "rightFoot": {
        "bone": "rightFoot",
        "size": {
            "x":0.1,
            "y":0.1,
            "z":0.1,
        },
        "offset": {
            "x":0,
            "y":0,
            "z":0,
        },
        "color": 0x6600cc
    }
}