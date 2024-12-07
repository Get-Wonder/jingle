/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import crypto from "crypto";
import syllables from "syllables";

export async function POST(request: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });

  const SALT = process.env.SALT;

  const forbiddenWords = ["monarch", "butterflies", "worker", "immigration"];

  const addSalt = (text: string) => {
    return text + SALT;
  };

  const createMD5 = (text: string) => {
    const textWithSalt = addSalt(text);
    return crypto.createHash("md5").update(textWithSalt).digest("hex");
  };

  try {
    const { text }: { text: string } = await request.json();

    if (text === "") {
      return NextResponse.json(
        {
          error: "The text cannot be empty",
          success: false,
        },
        { status: 400 }
      );
    }

    if (text !== "" && text.length > 300) {
      return NextResponse.json(
        {
          error: "The text must contain less than 300 characters",
          success: false,
        },
        { status: 400 }
      );
    }
    const forbiddenTopics = [
      "Monarchs",
      "Butterflies",
      "Workers",
      "Immigrants",
    ];

    if (forbiddenTopics.some((topic: string) => text?.includes(topic))) {
      return NextResponse.json(
        { error: "Forbidden input", success: false },
        { status: 400 }
      );
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          'Transform the given text into 15 different fun, cheerful, and lighthearted jingles suitable for singing over the "Avocados From Mexico" jingle. Each jingle should vary in length but have at least 5 words, use words with many letters when possible, and be different from each other in structure. Importantly, each jingle should preserve the meaning of the original text as much as possible. Prohibited Words: ["Politics", "Drugs", "Weapons", "Violence", "Monarchs", "Butterflies", "Workers", "Immigrants"] Important Notes: Only check for the exact words listed in the prohibited words. Do not consider synonyms, related terms, or extended meanings. If the input text contains any of these exact words, then return the following JSON object: { "error": true }.Output Format: Return an array containing 15 objects. Each object should have a "text" key with the jingle as its value. Do not include any additional text or formatting.Example:User Input: "I would like to eat some avocados right now"Output: [ { "text": "Craving avocados here" }, { "text": "Yearning for green delights" }, … ]',
      },
      { role: "user", content: text },
    ];

    let retryCount = 0;
    const MAX_RETRIES = 5;
    const examplesOfSevenSyllables: any = [];

    if (syllables(text) === 8) {
      examplesOfSevenSyllables.push(text);
    }

    while (retryCount < MAX_RETRIES && examplesOfSevenSyllables.length < 3) {
      console.log("TRY NUMBER", retryCount + 1);
      const completion: any = await openai.chat.completions.create({
        messages,
        model: "gpt-4o",
      });

      console.log(
        "completion.choices[0].message.content",
        completion.choices[0].message.content,
        typeof completion.choices[0].message.content
      );

      const result: any = await JSON.parse(
        completion.choices[0].message.content
      );

      console.log("result", result);

      if (result?.error) {
        return NextResponse.json(
          { error: "Forbidden input", success: false },
          { status: 400 }
        );
      }

      if (result?.length > 0) {
        result.forEach((element: any) => {
          console.log(element?.text, syllables(element?.text));
          if (
            examplesOfSevenSyllables.length < 3 &&
            syllables(element?.text) === 8
          ) {
            examplesOfSevenSyllables.push(element?.text);
          }
        });
      }

      retryCount++;
    }

    if (examplesOfSevenSyllables.length === 0) {
      return NextResponse.json(
        { error: "An error has occurred, please try again" },
        { status: 500 }
      );
    }

    const resultadosConHash = examplesOfSevenSyllables.map(
      (example: string) => {
        const isFromUser = text === example;

        return {
          text: example,
          hash: createMD5(example),
          isFromUser,
        };
      }
    );

    forbiddenWords.forEach((word: string) => {
      if (
        resultadosConHash.some((result: { text: string; hash: string }) =>
          result?.text.includes(word)
        )
      ) {
        return NextResponse.json({ error: "Forbidden input" }, { status: 500 });
      }
    });

    return NextResponse.json(
      { success: true, data: [...resultadosConHash] },
      {
        status: 201,
      }
    );
  } catch (e) {
    console.log("error in lyrics", e);
    return NextResponse.json(
      { error: "An error has occurred, please try again" },
      { status: 500 }
    );
  }
}
