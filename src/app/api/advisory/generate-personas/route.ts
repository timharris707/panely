/**
 * POST /api/advisory/generate-personas
 * Uses direct provider SDK routing (Anthropic/OpenAI/Gemini) to generate
 * topic-specific persona overlays for the advisory board.
 * Accepts { topic: string, modelId?: string } and returns { personas: GeneratedPersona[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/ai/router";
import { resolveProviderModelId } from "@/lib/ai/providers";

interface GeneratedPersona {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic = body?.topic?.trim();
    const modelId = resolveProviderModelId(body?.modelId);

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const systemPrompt = `You are an expert at designing advisory board compositions. Given a discussion topic, you generate specialized expert personas that would provide the most valuable and diverse perspectives for that specific discussion.

Each persona should be a specialized expert lens — not a generic role, but tailored to the specific topic. Think about what unique angles, expertise areas, and critical perspectives would make this advisory discussion excellent. Aim for diversity — cover contrarian views, adjacent domains, and non-obvious angles beyond the core subject.

Return ONLY a valid JSON array with 8-10 persona objects. Each object must have:
- "id": kebab-case identifier (e.g., "market-risk-analyst")
- "name": short expert title (2-4 words)
- "emoji": single relevant emoji
- "description": one sentence describing their specific expertise and what they bring to THIS discussion

No markdown, no explanation — just the JSON array.`;

    const userPrompt = `Generate 8-10 specialized expert personas for an advisory board discussion on this topic:

"${topic}"

Return only the JSON array.`;

    const result = await generateText({
      modelId,
      systemPrompt,
      prompt: userPrompt,
      maxTokens: 2048,
      temperature: 0.7,
    });

    const content = result.text ?? "";

    // Extract JSON array from response (handle possible markdown wrapping)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Could not parse persona JSON from response:", content);
      return NextResponse.json({ error: "Failed to parse generated personas" }, { status: 500 });
    }

    const parsed: GeneratedPersona[] = JSON.parse(jsonMatch[0]);

    // Validate structure
    const personas = parsed
      .filter((p) => p.id && p.name && p.emoji && p.description)
      .slice(0, 12)
      .map((p) => ({
        id: `ai-${p.id}`,
        name: String(p.name).slice(0, 40),
        emoji: String(p.emoji).slice(0, 4),
        description: String(p.description).slice(0, 200),
      }));

    if (personas.length === 0) {
      return NextResponse.json({ error: "No valid personas generated" }, { status: 500 });
    }

    return NextResponse.json({ personas, modelId: result.modelId, provider: result.provider });
  } catch (err) {
    console.error("Error in generate-personas:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
