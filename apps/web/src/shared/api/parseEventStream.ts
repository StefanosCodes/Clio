export type FoundationStreamEvent = {
  event: string;
  cursor: number;
  [key: string]: unknown;
};

function parseBlock(block: string): FoundationStreamEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());
  if (data.length === 0) return null;
  const payload: unknown = JSON.parse(data.join("\n"));
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }
  const event = (payload as Record<string, unknown>).event;
  const cursor = (payload as Record<string, unknown>).cursor;
  if (typeof event !== "string" || typeof cursor !== "number") return null;
  return payload as FoundationStreamEvent;
}

export async function* parseEventStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<FoundationStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let match = /\r?\n\r?\n/.exec(buffer);
      while (match?.index !== undefined) {
        const event = parseBlock(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
        if (event) yield event;
        match = /\r?\n\r?\n/.exec(buffer);
      }
      if (done) {
        const event = parseBlock(buffer);
        if (event) yield event;
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
