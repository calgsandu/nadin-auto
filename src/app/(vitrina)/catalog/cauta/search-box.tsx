"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  return (
    <form
      className="flex gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        router.push(query ? `/catalog/cauta?q=${encodeURIComponent(query)}` : "/catalog/cauta");
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Cod, denumire, marcă sau model…"
        className="w-full rounded-full border border-white/15 bg-white/[0.04] px-6 py-4 text-base text-[#f4f1ea] outline-none transition-colors placeholder:text-[#57524a] focus:border-[#d97706]/70"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-[#d97706] px-7 py-4 text-sm font-semibold text-[#0b0a08] transition-colors hover:bg-[#f59e0b]"
      >
        Caută
      </button>
    </form>
  );
}
