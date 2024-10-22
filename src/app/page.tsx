"use client";

import React, { useState, useEffect, useRef } from "react";
import CircularProgress from "@mui/material/CircularProgress";

const Home = () => {
  const [text, setText] = useState<string>("");
  const [sentences, setSentences] = useState<string[]>([]);
  const [selectedSentence, setSelectedSentence] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  }, [audioUrl]);

  const onSubmit = async () => {
    setLoading(true);
    const result = await fetch("/api/lyrics", {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    const data = await result?.json();

    setSentences(data);
    setLoading(false);
  };

  const onSentenceSelect = (sentence: string) => {
    setSelectedSentence(sentence);
  };

  const generateSong = async () => {
    setLoading(true)
    const result = await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({ selectedSentence }),
    });

    const data = await result?.json();

    setAudioUrl(data?.clipUrl);
    setLoading(false)
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100">
      <div className="flex flex-col space-y-4">
        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} className="hidden" controls />
        )}
        <p className="text-black text-center">Jingle song generator</p>
        {sentences.length === 0 && (
          <>
            <input
              type="text"
              className="rounded-lg border border-gray-300 px-4 py-2 text-black focus:border-blue-500 focus:outline-none"
              placeholder="Enter text..."
              onChange={(e) => setText(e.target.value)}
              value={text}
            />
            {loading ? (
              <div className="flex justify-center w-full">
                <CircularProgress />
              </div>
            ) : (
              <button
                onClick={onSubmit}
                disabled={text === ""}
                className={`rounded-lg px-4 py-2 text-white focus:outline-none cursor-pointer
    ${
      text === ""
        ? "bg-gray-400 cursor-not-allowed"
        : "bg-blue-500 hover:bg-blue-600"
    }`}
              >
                Submit
              </button>
            )}
          </>
        )}

        {sentences.length > 0 && (
          <div>
            <p className="text-black mb-4">Select one of the following:</p>
            <ul className="space-y-2">
              {sentences.map((sentence) => (
                <li key={sentence} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={sentence}
                    name="sentence"
                    value={sentence}
                    checked={selectedSentence === sentence}
                    onChange={() => onSentenceSelect(sentence)}
                  />
                  <label htmlFor={sentence} className="text-gray-800">
                    {sentence}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        {selectedSentence !== "" && (
          <>
            <div className="mt-4 p-4 bg-green-100 rounded-lg">
              <p className="text-black">
                You selected: <strong>{selectedSentence}</strong>
              </p>
            </div>
            {loading ? (
              <div className="flex justify-center w-full">
                <CircularProgress />
              </div>
            ) : (
              <button
                onClick={() => generateSong()}
                className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none"
              >
                Generate song
              </button>
            )}
          </>
        )}
        {sentences.length > 0 && (
          <button
            onClick={() => {
              setSelectedSentence("");
              setSentences([]);
              setText("");
              setAudioUrl("");
            }}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none"
          >
            Go back
          </button>
        )}
      </div>
    </div>
  );
};

export default Home;
