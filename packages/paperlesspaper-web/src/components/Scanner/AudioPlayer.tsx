import React, { useEffect, useRef, useState } from "react";

export default function AudioPlayer({ text }: any) {
  const audioRef = useRef(null);
  //const [last];
  const [audioSrc, setAudioSrc] = useState("");

  const fetchAudio = async (text) => {
    try {
      const response = await fetch(
        "http://localhost:5002/v1/ai/generate-audio",
        {
          method: "POST",
          body: JSON.stringify({
            text: text,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      playAudio();
      setAudioSrc(audioUrl);
    } catch (error) {
      console.error("Error fetching audio:", error);
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  };
  useEffect(() => {
    if (text) fetchAudio(text);
  }, [text]);

  return (
    <div>
      {/* } <button onClick={fetchAudio}>Load Audio</button>
      <button onClick={playAudio} disabled={!audioSrc}>
        Play Audio
  </button>*/}
      <audio ref={audioRef} controls src={audioSrc} />
    </div>
  );
}
