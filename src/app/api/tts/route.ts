interface TTSRequest {
  text: string;
  speed?: number;
}

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

export async function POST(req: Request): Promise<Response> {
  try {
    const body: TTSRequest = await req.json();
    const { text, speed = 0.8 } = body;

    if (!text) {
      return Response.json(
        { error: "テキストが空です" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const response = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "onyx",
        input: text,
        response_format: "mp3",
        speed,
      }),
    });

    if (!response.ok) {
      console.error(
        "OpenAI TTS API error:",
        response.status,
        response.statusText
      );
      return Response.json(
        { error: "音声合成に失敗しました" },
        { status: 503 }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return Response.json(
      { error: "音声合成に失敗しました" },
      { status: 500 }
    );
  }
}
