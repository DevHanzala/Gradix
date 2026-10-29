import { extractLinkText, TRANSCRIPT_BLOCKED } from "../helper/linkIngest.js";

/**
 * Optional live check against real YouTube (network, no fakes). Skipped unless
 * YOUTUBE_LIVE_TEST=true. YOUTUBE_LIVE_VIDEO picks another public video with captions.
 *
 *   YOUTUBE_LIVE_TEST=true npm test -- tests/youtube.live.test.js
 */
const enabled = process.env.YOUTUBE_LIVE_TEST === "true";
const video = process.env.YOUTUBE_LIVE_VIDEO || "https://www.youtube.com/watch?v=iG9CE55wbtY";

(enabled ? describe : describe.skip)("YouTube (live)", () => {
  test(
    "a public video with captions is read as a transcript",
    async () => {
      let result;
      try {
        result = await extractLinkText(video, { language: "en" });
      } catch (error) {
        // Make the known failure mode obvious in the test output.
        if (error.message === TRANSCRIPT_BLOCKED) throw new Error(`YouTube refused the caption download: ${error.message}`, { cause: error });
        throw error;
      }
      expect(result.method).toBe("youtube");
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(500);
    },
    60000
  );
});
