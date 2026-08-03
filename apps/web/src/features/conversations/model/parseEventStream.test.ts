import { describe, expect, it } from "vitest";

import { parseEventStream } from "./parseEventStream";

describe("parseEventStream", () => {
  it("parses chunked SSE blocks and preserves monotonic cursors", async () => {
    const encoder = new TextEncoder();
    const source = [
      'id: 0\nevent: session\ndata: {"event":"session","cursor":0}\n',
      '\nid: 1\nevent: done\ndata: {"event":"done","cursor":1}\n\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        source.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    });

    const events = [];
    for await (const event of parseEventStream(stream)) events.push(event);

    expect(events.map(({ event, cursor }) => ({ event, cursor }))).toEqual([
      { event: "session", cursor: 0 },
      { event: "done", cursor: 1 },
    ]);
  });
});
