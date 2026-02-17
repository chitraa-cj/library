import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

export async function translateText(content: string, targetLanguage: string): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Translate the following text to ${targetLanguage}. Only return the translated text, no explanations or extra formatting.\n\nText:\n${content}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

export async function translateImage(
  imageBuffer: Buffer,
  mimeType: string,
  targetLanguage: string
): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType: mimeType,
    },
  };

  const prompt = `This image contains text content. Please:
1. Extract all the text from this image
2. Translate the extracted text to ${targetLanguage}

Return the result in this format:
--- ORIGINAL TEXT ---
[extracted text here]

--- TRANSLATED TEXT (${targetLanguage}) ---
[translated text here]`;

  const result = await model.generateContent([prompt, imagePart]);
  const response = result.response;
  return response.text();
}
