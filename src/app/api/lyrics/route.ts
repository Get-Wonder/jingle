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

  const addSalt = (text: string) => text + SALT;
  const createMD5 = (text: string) => {
    const textWithSalt = addSalt(text);
    return crypto.createHash("md5").update(textWithSalt).digest("hex");
  };

  const cleanMarkdownFormatting = (content: string): string => {
    // Remove markdown code block if present
    const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      return markdownMatch[1].trim();
    }
    return content.trim();
  };

  try {
    const {
      text,
      prompt: customPrompt,
      forbiddenWords: customForbiddenWords,
      examples: customExamples,
    }: {
      text: string;
      prompt?: string;
      forbiddenWords?: string;
      examples?: any[];
    } = await request.json();

    let forbiddenWords: string[] = [];
    let prompt = "";
    let examples = [];
    let words = 7;

    if (!customPrompt || !customForbiddenWords || !customExamples) {
      const config = await getConfig();
      forbiddenWords = [config?.forbidden_words];
      prompt = config?.prompt || "";
      examples = config?.examples || [];
    } else {
      forbiddenWords = [customForbiddenWords];
      prompt = customPrompt;
      examples = customExamples;
    }

    if (text === "") {
      return NextResponse.json(
        { error: "The text cannot be empty", success: false },
        { status: 400 }
      );
    }

    if (text.length > 300) {
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
    console.log("examples", examples);
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let examplesOfSevensyllable: any = [];
    const eightSyllableExamples: any = [];

    if (syllable(text) === 8) {
      examplesOfSevensyllable.push(text);
    }

    while (retryCount < MAX_RETRIES && examplesOfSevensyllable.length < 3) {
      console.log("TRY NUMBER", retryCount + 1, "words", words);

      // Create a new set of messages for each retry
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `instructions: ${prompt}. Create exactly 15 different variations aiming for ${words} words each. The quantity of words is more important than the first instructions. Output Format: Provide an array containing 15 objects. Each object should have a "text" key with the option as its value. Do not include any additional text or formatting. Output: [ { "text": "" }, { "text": "" }, … ], Examples of conversion: ${examples}`,
        },
        {
          role: "user",
          content: text,
        },
      ];

      const completion: any = await openai.chat.completions.create({
        messages,
        model: "gpt-4o",
      });
      console.log(
        "completion.choices[0].message.content",
        completion.choices[0].message.content
      );
      const cleanedContent = cleanMarkdownFormatting(
        completion.choices[0].message.content
      );

      const result: any = await JSON.parse(cleanedContent);
      const resultWithSyllables = result.map((item: any) => ({
        text: item.text,
        syllables: syllable(item.text),
      }));

      console.log("resultWithSyllables", resultWithSyllables);

      if (result?.error) {
        return NextResponse.json(
          { error: "Forbidden input", success: false },
          { status: 400 }
        );
      }

      if (result?.length > 0) {
        result.forEach((element: any) => {
          if (
            examplesOfSevensyllable.length < 3 &&
            syllable(element?.text) === 8
          ) {
            examplesOfSevensyllable.push(element?.text);
          }
          if (syllable(element?.text) === 8) {
            eightSyllableExamples.push(element?.text);
          }
        });

        const syllableCounts = resultWithSyllables.map(
          (item: any) => item.syllables
        );
        const averageSyllables =
          syllableCounts.reduce((a: number, b: number) => a + b, 0) /
          syllableCounts.length;

        if (averageSyllables > 8) {
          words -= Math.ceil(averageSyllables - 8);
        } else if (averageSyllables < 8) {
          words += Math.ceil(8 - averageSyllables);
        }
      }

      retryCount++;
    }
    console.log("eightSyllableExamples", eightSyllableExamples);
    if (eightSyllableExamples.length > 3) {
      const selectionMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `Select the best three examples. You cannot create new examples, you must return the same examples as the input. Each MUST:
                    -Keep EXACT same pronouns as input (if starts "I love", all must start "I")
                    -Sound like casual conversation, not poetry
                    -Build on original meaning naturally (if "I love my wife" -> "I love my wife more each day")
                    -Keep same subject/relationship
                    -Feel natural, not forced

                    Reject any that:

                    -Change pronouns
                    -Sound fake/formal
                    -Lose original meaning

                    Return exactly 3 best variations in the same format. The input for generating the examples was ${text}`,
        },
        {
          role: "user",
          content: JSON.stringify(eightSyllableExamples),
        },
      ];

      const selectionCompletion: any = await openai.chat.completions.create({
        messages: selectionMessages,
        model: "gpt-4o",
      });

      const selectedExamples: any = await JSON.parse(
        selectionCompletion.choices[0].message.content
      );

      console.log("selectedExamples", selectedExamples);

      examplesOfSevensyllable = selectedExamples.slice(0, 3);
    }

    if (examplesOfSevensyllable.length === 0) {
      return NextResponse.json(
        { error: "An error has occurred, please try again" },
        { status: 500 }
      );
    }

    const resultadosConHash = examplesOfSevensyllable.map(
      (example: string) => ({
        text: example,
        hash: createMD5(example),
        isFromUser: text === example,
      })
    );

    if (
      forbiddenWords.some((word) =>
        resultadosConHash.some((result: any) => result?.text.includes(word))
      )
    ) {
      return NextResponse.json({ error: "Forbidden input" }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, data: [...resultadosConHash] },
      { status: 201 }
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
