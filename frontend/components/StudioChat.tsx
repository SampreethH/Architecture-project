"use client";

import { useRef, useState, type FormEvent } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageName?: string;
  imageUrl?: string;
};

export default function StudioChat({
  messages,
  draft,
  onDraft,
  pending,
  onSend,
  status,
}: {
  messages: ChatMessage[];
  draft: string;
  onDraft: (value: string) => void;
  pending: boolean;
  onSend: (text: string, file: File | null) => void;
  status: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);
  const [fileLabel, setFileLabel] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    const file = pendingFile.current ?? fileRef.current?.files?.[0] ?? null;
    if (!text && !file) return;
    onSend(text, file);
    pendingFile.current = null;
    setFileLabel("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <aside className="glass flex h-full min-h-[480px] flex-col rounded-[28px] lg:min-h-[640px]">
      <header className="border-b border-white/10 px-5 py-4">
        <p className="font-display text-lg text-white">Chat with Cadence</p>
        <p className="mt-1 font-sans text-sm leading-relaxed text-titanium">
          Say what you want in plain words, or upload a photo of a hand drawing. We turn it
          into a 3D house.
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
              message.role === "user"
                ? "ml-auto bg-champagne/15 text-champagne-mist"
                : "bg-white/5 text-titanium-bright"
            }`}
          >
            {message.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={message.imageUrl}
                alt={message.imageName ?? "Uploaded sketch"}
                className="mb-2 max-h-36 w-full rounded-xl object-cover"
              />
            ) : null}
            <p className="font-sans">{message.text}</p>
            {message.imageName ? (
              <p className="mt-1 font-sans text-xs text-titanium">Photo: {message.imageName}</p>
            ) : null}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-white/10 p-4">
        <textarea
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          rows={3}
          placeholder="Example: 3 bedroom house, open kitchen, windows on the garden side. I also want a bigger living room."
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-sans text-sm text-white outline-none placeholder:text-titanium/60 focus:border-champagne/40"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-white/15 px-4 py-2 font-sans text-sm text-titanium-bright"
          >
            Upload hand drawing
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              pendingFile.current = event.target.files?.[0] ?? null;
              setFileLabel(pendingFile.current?.name ?? "");
            }}
          />
          <button
            type="submit"
            disabled={pending}
            className="ml-auto rounded-full bg-champagne px-5 py-2 font-sans text-sm font-semibold text-onyx-950 disabled:opacity-50"
          >
            {pending ? "Building 3D…" : "Make 3D"}
          </button>
        </div>
        {fileLabel ? (
          <p className="mt-2 font-sans text-xs text-champagne-mist">Ready to send: {fileLabel}</p>
        ) : null}
        <p className="mt-2 font-sans text-xs text-cobalt">{status}</p>
      </form>
    </aside>
  );
}
