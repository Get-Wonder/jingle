const PLAUSIBLE_URL =
  process.env.PLAUSIBLE_URL || "https://analytics.weareamaze.app";
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "jafm.weareamaze.app";

export const trackJobCompletion = async (
  success: boolean,
  duration?: number
) => {
  try {
    await fetch(`${PLAUSIBLE_URL}/api/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Si configuraste un token API en tu instalación
        Authorization: `Bearer ${process.env.PLAUSIBLE_API_KEY}`,
      },
      body: JSON.stringify({
        name: "audio_generation",
        domain: DOMAIN,
        url: `https://${DOMAIN}/generate`,
        props: {
          status: success ? "completed" : "failed",
          duration: duration || 0,
        },
      }),
    });
  } catch (error) {
    console.error("Error tracking job:", error);
  }
};

export const trackLyricsGeneration = async (
  success: boolean,
  duration?: number,
  attempts?: number
) => {
  try {
    await fetch(`${PLAUSIBLE_URL}/api/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PLAUSIBLE_API_KEY}`,
      },
      body: JSON.stringify({
        name: "lyrics_generation",
        domain: DOMAIN,
        url: `https://${DOMAIN}/generate`,
        props: {
          status: success ? "completed" : "failed",
          duration: duration || 0,
          attempts: attempts || 1,
        },
      }),
    });
  } catch (error) {
    console.error("Error tracking lyrics generation:", error);
  }
};
