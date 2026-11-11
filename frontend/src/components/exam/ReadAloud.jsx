import { useEffect, useState } from "react";
import { FaVolumeUp, FaStop } from "react-icons/fa";

const VOICE_LANG = { en: "en", ur: "ur", ar: "ar", fa: "fa", sd: "sd" };

/** Voices for a language, if this browser/device has any (they load asynchronously). */
const useVoice = (language) => {
  const [voice, setVoice] = useState(null);
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
    const pick = () => {
      const prefix = VOICE_LANG[language] || language;
      setVoice(window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith(prefix)) || null);
    };
    pick();
    window.speechSynthesis.addEventListener?.("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", pick);
  }, [language]);
  return voice;
};

/**
 * "Read aloud" with the browser's own speech synthesis: shown only when the device
 * has a voice for the exam language. Nothing is sent to a server.
 */
function ReadAloud({ text, language, t }) {
  const voice = useVoice(language);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), [text]);
  if (!voice || !text) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utterance);
    setSpeaking(true);
  };

  return (
    <button type="button" onClick={toggle} className="btn-ghost" aria-pressed={speaking}>
      {speaking ? <FaStop aria-hidden="true" /> : <FaVolumeUp aria-hidden="true" />}
      <span>{speaking ? t("exam.stopReading") : t("exam.readAloud")}</span>
    </button>
  );
}

export default ReadAloud;
