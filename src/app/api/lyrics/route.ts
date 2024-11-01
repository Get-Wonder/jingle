/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import crypto from "crypto";
import syllables from 'syllables';

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

    console.log('syllables text', syllables(text))

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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          'I need to convert any text into a new text. you need to change or modify the text to meet the requirement of Fun, cherful and lighthearded examples. You must return 15 different Jingles of various lengths, each Jingle must have AT LEAST 5 words. Try to use words with many letters. You also have the following topics prohibited ["Politics", "Drugs", "Weapons", "Violence", "Monarchs", "Butterflies", "Workers", "Immigrants"], if the input contains something of this topic, you must return the following: { "error": true }. each different from the other in the structure of the following example: UserInput: "I would like to eat some avocados right now" => "Craving avocados here". You must return an object of text for each of the 15 different texts in the following format [{"text": "craving avocados here"}] you must only return the array containing all the examples DO NOT ADD ```json``` around the array, just return the array, each object for example containing text and syllables. Do as the instruction tell for the following example:',
      },
      { role: "user", content: text },
    ];

    let retryCount = 0;
    const MAX_RETRIES = 5;
    const examplesOfSevenSyllables: any = [];

    while (retryCount < MAX_RETRIES && examplesOfSevenSyllables.length < 3) {
      console.log("TRY NUMBER", retryCount + 1)
      const completion: any = await openai.chat.completions.create({
        messages,
        model: "gpt-4o-mini",
      });

      const result: any = await JSON.parse(completion.choices[0].message.content);

      if (result?.error) {
        return NextResponse.json(
          { error: "Forbidden input", success: false },
          { status: 400 }
        );
      }

      if (result?.length > 0) {
        result.forEach((element: any) => {
          console.log(element?.text, syllables(element?.text))
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

    const resultadosConHash = examplesOfSevenSyllables.map((text: string) => ({
      text,
      hash: createMD5(text),
    }));

    forbiddenWords.forEach((word: string) => {
      if (
        resultadosConHash.some(
          (result: { text: string; hash: string }) =>
            result?.text.includes(word)
        )
      ) {
        return NextResponse.json(
          { error: "Forbidden input" },
          { status: 500 }
        );
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