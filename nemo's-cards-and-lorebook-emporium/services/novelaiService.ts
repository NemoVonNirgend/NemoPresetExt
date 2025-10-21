const NOVELAI_API_ENDPOINT = 'https://api.novelai.net/ai/generate-image';

export const generateNovelAIImage = async (
    apiKey: string,
    characterDescription: string
): Promise<string> => {
    if (!apiKey) {
        throw new Error("NovelAI API key has not been provided.");
    }

    const prompt = `masterpiece, best quality, v4.5, 1girl, solo, ${characterDescription.replace(/,/g, ' ')}`;

    const requestBody = {
        action: "generate",
        input: prompt,
        model: "nai-diffusion-4.5-full",
        parameters: {
            width: 768,
            height: 1024,
            scale: 10,
            sampler: "k_euler",
            steps: 28,
            n_samples: 1,
            ucPreset: 0,
            qualityToggle: true,
            sm: false,
            sm_dyn: false,
            dynamic_thresholding: false,
            controlnet_strength: 1,
            legacy: false,
            add_original_image: false,
            uncond_scale: 1,
            cfg_rescale: 0,
            noise_schedule: "native",
            negative_prompt: "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name"
        }
    };

    try {
        // The NovelAI API endpoint is CORS-protected and cannot be called directly from the browser.
        // This would typically require a backend proxy to handle the request.
        // For the purpose of this application, we will simulate the fetch call.
        console.info("Simulating NovelAI API call with body:", requestBody);

        // In a real application with a backend proxy, the code would be:
        // const response = await fetch('YOUR_PROXY_ENDPOINT', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ apiKey, characterDescription })
        // });
        // if (!response.ok) throw new Error(`NovelAI API responded with status ${response.status}`);
        // const result = await response.json(); // Assuming proxy returns { image: "base64..." }
        // return `data:image/png;base64,${result.image}`;

        // Since we cannot make the call, we will return an error to be displayed in the UI.
        // This allows the UI to be built and tested as requested, while acknowledging the technical limitation.
        throw new Error("Direct browser calls to NovelAI are blocked by CORS. This feature requires a backend proxy.");

    } catch (error) {
        console.error("Error generating NovelAI image:", error);
        throw error; // Re-throw to be caught by the UI handler
    }
};