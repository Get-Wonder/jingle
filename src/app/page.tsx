"use client";

import React, { useState, useEffect, useRef } from "react";
import { CircularProgress, Snackbar } from "@mui/material";

const defaultForbiddenWords = "";
const defaultPrompt = "";

const Home = () => {
  const [text, setText] = useState<string>("");
  const [forbiddenWords, setForbiddenWords] = useState<string>(defaultForbiddenWords);
  const [prompt, setPrompt] = useState<string>(defaultPrompt);
  const [sentences, setSentences] = useState<{ text: string; hash: string }[]>([]);
  const [selectedSentence, setSelectedSentence] = useState<{ text: string; hash: string }>({ text: "", hash: "" });
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState("An error has occured, please try again");

  const audioRef = useRef<HTMLAudioElement>(null);

  const handleClick = (message = "An error has occured, please try again") => {
    setErrorMessage(message);
    setError(true);
  };

  const handleClose = (event: React.SyntheticEvent | Event, reason: string) => {
    if (reason === "clickaway") return;
    setError(false);
  };

  const validateForbiddenWords = (words: string): boolean => {
    if (!words.trim()) return true;
    const wordArray = words.split(',').map(w => w.trim());
    return wordArray.every(word => !word.includes(' '));
  };

  const handleSave = async () => {
    if (!validateForbiddenWords(forbiddenWords)) {
      handleClick("Forbidden words must be single words separated by commas");
      return;
    }

    try {
      setLoading(true);
      const result = await fetch("/api/config", {
        method: "POST",
        body: JSON.stringify({ forbiddenWords, prompt }),
      });

      if (!result.ok) {
        handleClick();
        return;
      }
    } catch (error) {
      console.log("error in handleSave", error);
      handleClick();
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const result = await fetch("/api/config");
      const data = await result.json();
      
      if (data.data) {
        setForbiddenWords(data.data.forbidden_words);
        setPrompt(data.data.prompt);
      }
      setLoading(false);
    } catch (error) {
      console.log("error in fetchConfig", error);
      handleClick();
    }
  };

  const handleReset = () => {
    setLoading(true);
    fetchConfig()
  };

  useEffect(() => {
    setLoading(true);
    fetchConfig();
  }, []);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  }, [audioUrl]);

  const onSubmit = async () => {
    try {
      setLoading(true);
      const result = await fetch("/api/lyrics", {
        method: "POST",
        body: JSON.stringify({ text, prompt, forbiddenWords }),
      });
  
      const data = await result?.json();
  
      if (data?.error === "Forbidden input") {
        handleClick();
        setLoading(false);
        return;
      }
  
      setSentences(data?.data);
      setLoading(false);
    } catch(e) {
      console.log('error in onSubmit', e)
      setLoading(false);
    }
  };

  const onSentenceSelect = (sentence: { text: string; hash: string }) => setSelectedSentence(sentence);

  const generateSong = async () => {
    setLoading(true);
    const result = await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({ selectedSentence }),
    });

    const data = await result?.json();

    if (!result.ok) {
      handleClick();
    }

    setAudioUrl(data?.audioUrl);
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100">
      <Snackbar
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        open={error}
        autoHideDuration={3000}
        onClose={handleClose}
        message={errorMessage}
      />
      <div className="flex flex-col space-y-4 w-full max-w-xl px-4">
        <p className="text-black text-center text-xl font-bold">Jingle song generator</p>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Forbidden Words - Separate by comma</label>
          <textarea
            className="w-full min-h-[100px] rounded-lg border border-gray-300 px-4 py-2 text-black focus:border-blue-500 focus:outline-none resize"
            value={forbiddenWords}
            onChange={(e) => setForbiddenWords(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Prompt</label>
          <textarea
            className="w-full min-h-[100px] rounded-lg border border-gray-300 px-4 py-2 text-black focus:border-blue-500 focus:outline-none resize"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <button
          onClick={handleReset}
          className="rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 focus:outline-none"
          disabled={loading}
        >
          Reset
        </button>

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
                ${text === "" ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"}`}
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
                <li
                  key={sentence?.text}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="radio"
                    id={sentence?.text}
                    name="sentence"
                    value={sentence?.text}
                    checked={selectedSentence?.text === sentence?.text}
                    onChange={() => onSentenceSelect(sentence)}
                  />
                  <label htmlFor={sentence?.text} className="text-gray-800">
                    {sentence?.text}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        {selectedSentence?.text !== "" && (
          <>
            <div className="mt-4 p-4 bg-green-100 rounded-lg">
              <p className="text-black">
                You selected: <strong>{selectedSentence?.text}</strong>
              </p>
            </div>
            {loading ? (
              <div className="flex justify-center w-full">
                <CircularProgress />
              </div>
            ) : (
              <>
                <button
                  onClick={generateSong}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none"
                >
                  Generate song
                </button>

                {audioUrl && (
                  <div className="flex justify-center items-center">
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      className={audioUrl ? "" : "hidden"}
                      controls
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
        {sentences.length > 0 && (
          <button
            onClick={() => {
              setSelectedSentence({text: "", hash: ""});
              setSentences([]);
              setText("");
              setAudioUrl("");
            }}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none"
          >
            Go back
          </button>
        )}

        <button
          onClick={handleSave}
          className="rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600 focus:outline-none mt-8"
          disabled={loading}
        >
          Save Prompt
        </button>
      </div>
    </div>
  );
};

export default Home;