/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import crypto from "crypto";
import { syllable } from "syllable";

async function getConfig() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/config`);
  const data = await res.json();
  return data.data;
}

export async function POST(request: NextRequest) {
  console.time("lyrics-api");
  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });

  const SALT = process.env.SALT;

  const config = await getConfig();
  console.log('CONFIG', config)
  const forbiddenWords = [config?.forbidden_words] || [];

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


    if (forbiddenWords.some((topic: string) => text?.includes(topic))) {
      return NextResponse.json(
        { error: "Forbidden input", success: false },
        { status: 400 }
      );
    }

    const prompt = config?.prompt || '';

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          `${prompt} Prohibited Words: [${forbiddenWords}]. Only check for the exact words listed. If the input text contains any of these exact words, then return the following JSON object: { "error": true }. Output Format: Provide an array containing 15 objects. Each object should have a "text" key with the option as its value. Do not include any additional text or formatting. Output: [ { "text": "" }, { "text": "" }, … ]`,
      },
      { role: "user", content: text },
    ];

    let retryCount = 0;
    const MAX_RETRIES = 5;
    const examplesOfSevensyllable: any = [];

    if (syllable(text) === 8) {
      examplesOfSevensyllable.push(text);
    }

    while (retryCount < MAX_RETRIES && examplesOfSevensyllable.length < 3) {
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
          console.log("Contando", element?.text, syllable(element?.text));
          if (
            examplesOfSevensyllable.length < 3 &&
            syllable(element?.text) === 8
          ) {
            examplesOfSevensyllable.push(element?.text);
          }
        });
      }

      retryCount++;
    }

    if (examplesOfSevensyllable.length === 0) {
      return NextResponse.json(
        { error: "An error has occurred, please try again" },
        { status: 500 }
      );
    }

    const resultadosConHash = examplesOfSevensyllable.map((example: string) => {
      const isFromUser = text === example;

      return {
        text: example,
        hash: createMD5(example),
        isFromUser,
      };
    });

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
  } finally {
    console.timeEnd("lyrics-api");
  }
}