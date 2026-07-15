"use client";

import { useMemo } from "react";

type JsonHighlightProps = {
  json: string;
};

export function JsonHighlight({ json }: JsonHighlightProps) {
  const highlighted = useMemo(() => highlightJson(json), [json]);

  return (
    <pre className="overflow-auto rounded-md bg-[#1e1e1e] p-3 text-[11px] leading-relaxed text-[#d4d4d4]">
      <code>{highlighted}</code>
    </pre>
  );
}

type Token =
  | { type: "text"; value: string }
  | { type: "key"; value: string }
  | { type: "string"; value: string }
  | { type: "number"; value: string }
  | { type: "boolean"; value: string }
  | { type: "null"; value: string }
  | { type: "bracket"; value: string };

function tokenize(json: string): Token[] {
  const tokens: Token[] = [];
  // Full JSON tokenizer regex — matches strings, numbers, booleans, null, structural chars
  const re = /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\],:])/g;
  let lastIndex = 0;

  for (const match of json.matchAll(re)) {
    // Push any plain text between tokens
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: json.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // JSON key (string followed by colon — captured without the colon)
      tokens.push({ type: "key", value: `"${match[1].slice(1, -1)}"` });
      tokens.push({ type: "bracket", value: ": " });
    } else if (match[2]) {
      // JSON string value
      tokens.push({ type: "string", value: match[2] });
    } else if (match[3]) {
      // Number
      tokens.push({ type: "number", value: match[3] });
    } else if (match[4]) {
      // Boolean
      tokens.push({ type: "boolean", value: match[4] });
    } else if (match[5]) {
      // Null
      tokens.push({ type: "null", value: match[5] });
    } else if (match[6]) {
      // Bracket/comma/colon
      tokens.push({ type: "bracket", value: match[6] });
    }

    lastIndex = (match.index ?? 0) + match[0].length;
  }

  // Push any remaining text
  if (lastIndex < json.length) {
    tokens.push({ type: "text", value: json.slice(lastIndex) });
  }

  return tokens;
}

const COLOR_MAP: Record<Token["type"], string> = {
  key: "#9cdcfe",
  string: "#ce9178",
  number: "#b5cea8",
  boolean: "#569cd6",
  null: "#569cd6",
  bracket: "#d4d4d4",
  text: "#d4d4d4",
};

function highlightJson(json: string) {
  return tokenize(json).map((token, i) => (
    <span key={i} style={{ color: COLOR_MAP[token.type] }}>
      {token.value}
    </span>
  ));
}