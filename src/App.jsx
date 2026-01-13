import { useState, useEffect, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";

export default function App() {
  //State

  const [apiKeys, setApiKeys] = useState(
    JSON.parse(localStorage.getItem("apiKeys") || "[]")
  );
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);

  const [prompt, setPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [optimisedPrompt, setOptimisedPrompt] = useState("");
  const [optimisedScore, setOptimisedScore] = useState(null);

  const [response, setResponse] = useState("");
  const [history, setHistory] = useState(
    JSON.parse(localStorage.getItem("promptHistory") || "[]")
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [loadingOptimise, setLoadingOptimise] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [apiError, setApiError] = useState("");

  const currentKey = apiKeys[selectedKeyIndex]?.key || "";

  useEffect(() => {
    localStorage.setItem("apiKeys", JSON.stringify(apiKeys));
  }, [apiKeys]);

  useEffect(() => {
    localStorage.setItem("promptHistory", JSON.stringify(history));
  }, [history]);

  //OpenAI Calls
  const callOpenAI = async (messages, max_tokens = 200) => {
    if (!currentKey) {
      setApiError("Please add a valid OpenAI API key.");
      return null;
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages,
          max_tokens,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setApiError("Invalid API key. Please check your key.");
        } else if (res.status === 429) {
          setApiError("Rate limit or no credits available.");
        } else {
          setApiError("OpenAI API error.");
        }
        return null;
      }

      setApiError("");
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    } catch {
      setApiError("Network error contacting OpenAI.");
      return null;
    }
  };

  //Optimise Prompt
  const optimisePrompt = async () => {
    if (!prompt.trim()) return;

    setLoadingOptimise(true);
    setOriginalPrompt(prompt);
    setPrompt("");

    const improved = await callOpenAI([
      {
        role: "system",
        content:
          "You are a prompt engineer. Rewrite the user's prompt for clarity, precision, and effectiveness. Do NOT answer the prompt. Return ONLY the improved prompt.",
      },
      { role: "user", content: prompt },
    ]);

    if (!improved) {
      setLoadingOptimise(false);
      return;
    }

    const scoreText = await callOpenAI(
      [
        {
          role: "system",
          content:
            "Please score the following prompt from 1–10 for clarity, precision, and usefulness. Be very critical and provide specific feedback. Also, comment on whether the prompt is a proper sentence.",
        },
        { role: "user", content: improved },
      ],
      10
    );

    setOptimisedPrompt(improved);
    setOptimisedScore(parseInt(scoreText?.match(/\d+/)?.[0] || "0"));
    setResponse("");
    setLoadingOptimise(false);
  };

  //Run Prompt
  const runOptimisedPrompt = async () => {
    if (!optimisedPrompt) return;

    setLoadingRun(true);

    const result = await callOpenAI([
      { role: "user", content: optimisedPrompt },
    ]);

    if (!result) {
      setLoadingRun(false);
      return;
    }

    setResponse(result);
    setHistory([
      {
        originalPrompt,
        optimisedPrompt,
        response: result,
        timestamp: new Date().toISOString(),
      },
      ...history,
    ]);

    setLoadingRun(false);
  };

  //API Key Management
  const addApiKey = () =>
    setApiKeys([...apiKeys, { name: "OpenAI", key: "" }]);

  const updateApiKey = (i, field, value) => {
    const updated = [...apiKeys];
    updated[i][field] = value;
    setApiKeys(updated);
  };

  const removeApiKey = (i) => {
    const updated = apiKeys.filter((_, idx) => idx !== i);
    setApiKeys(updated);
    setSelectedKeyIndex(0);
  };

  //History
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("promptHistory");
  };

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prompt_history.json";
    a.click();
  };

  //UI
  return (
    <div className="min-h-screen bg-gray-50 font-sans p-8">
      {/* Header */}
      <header className="relative max-w-4xl mx-auto mb-10">
        <h1 className="text-4xl font-bold text-center">Prompt Tuner</h1>

        <div className="absolute right-0 top-0 flex gap-3">
          <button
            onClick={() => setGuideOpen(true)}
             className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg transition"
          >
            Guide
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-lg transition"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Prompt Input */}
      <div className="max-w-xl mx-auto mb-6 relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your prompt…"
          rows={2}
          className="w-full p-4 pr-32 rounded-xl border resize-none transition-all"
        />

        <button
          onClick={optimisePrompt}
          disabled={loadingOptimise}
          className="absolute top-2 right-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold px-4 py-2 rounded-lg transition"
        >
          {loadingOptimise ? "Optimising…" : "Optimise"}
        </button>
      </div>

      {/* Optimised Prompt */}
      {optimisedPrompt && (
        <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl border mb-6">
          <h3 className="font-bold mb-2">
            Original Prompt (Score: {optimisedScore}/10)
          </h3>
          <p className="mb-4 text-gray-700">{originalPrompt}</p>

          <h3 className="font-bold text-green-700 mb-2">
            Optimised Prompt
          </h3>
          <p className="mb-4">{optimisedPrompt}</p>

          <button
            onClick={runOptimisedPrompt}
            disabled={loadingRun}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold px-4 py-2 rounded-lg transition"
          >
            {loadingRun ? "Running…" : "Run Optimised Prompt"}
          </button>
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="max-w-4xl mx-auto bg-blue-50 p-6 rounded-xl">
          <h3 className="font-bold mb-2">Response</h3>
          <p className="whitespace-pre-wrap">{response}</p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="max-w-5xl mx-auto mt-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">History</h2>
            <div className="flex gap-3">
              <button
                onClick={clearHistory}
                className="bg-red-500 text-white font-bold px-4 py-2 rounded-lg"
              >
                Clear
              </button>
              <button
                onClick={exportHistory}
                className="bg-green-500 text-white font-bold px-4 py-2 rounded-lg"
              >
                Export
              </button>
            </div>
          </div>

          {history.map((h, i) => (
            <div key={i} className="bg-white p-4 rounded-lg mb-3">
              <strong>Original:</strong> {h.originalPrompt}
              <br />
              <strong>Optimised:</strong> {h.optimisedPrompt}
              <br />
              <strong>Response:</strong> {h.response}
            </div>
          ))}
        </div>
      )}


      {/* Settings Modal */}
      <Transition show={settingsOpen} as={Fragment}>
        <Dialog onClose={() => setSettingsOpen(false)} className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/40" />
          <div className="fixed inset-0 flex items-center justify-center">
            <Dialog.Panel className="bg-white p-6 rounded-xl w-full max-w-md">
              <Dialog.Title className="font-bold text-xl mb-4">
                API Keys
              </Dialog.Title>

              {apiKeys.map((k, i) => (
                <div key={i} className="flex gap-2 mb-3">
                  <select
                    value={k.name}
                    disabled
                    className="border p-2 rounded min-w-[110px] bg-gray-100"
                  >
                    <option>OpenAI</option>
                  </select>

                  <input
                    type="password"
                    placeholder="API key"
                    value={k.key}
                    onChange={(e) => updateApiKey(i, "key", e.target.value)}
                    className="border p-2 rounded flex-1"
                  />

                  <button
                    onClick={() => removeApiKey(i)}
                    className="bg-red-500 text-white px-3 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                onClick={addApiKey}
                className="bg-green-500 text-white font-bold px-4 py-2 rounded"
              >
                Add API Key
              </button>

              <button
                onClick={() => setSettingsOpen(false)}
                className="mt-4 block ml-auto font-bold"
              >
                Close
              </button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      {/* Guide Modal */}
      <Transition show={guideOpen} as={Fragment}>
        <Dialog onClose={() => setGuideOpen(false)} className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/40" />
          <div className="fixed inset-0 flex items-center justify-center">
            <Dialog.Panel className="bg-white p-6 rounded-xl max-w-lg">
              <Dialog.Title className="font-bold text-xl mb-4">
                How Prompt Tuner Works
              </Dialog.Title>
              <ul className="list-disc ml-5 text-lg space-y-2">
                <li>
                  Prompt Tuner helps improve prompts for clarity, precision, and usefulness.
                </li>
                <li>
                  Clicking <strong>Optimise</strong> rewrites your prompt.
                </li>
                <li>
                  The score (1–10) measures how clear, precise, and useful the prompt is.
                </li>
                <li>
                  You can run the optimised prompt to get a response from OpenAI.
                </li>
                <li>
                  Only OpenAI API keys are currently supported.
                </li>
              </ul>

              <button
                onClick={() => setGuideOpen(false)}
                className="mt-6 font-bold"
              >
                Close
              </button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      {apiError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded">
          {apiError}
        </div>
      )}
    </div>
  );
}
