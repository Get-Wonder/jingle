/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import crypto from "crypto";
import { queueConnection } from "@/app/lib/redis";
import syllable from "syllable";

export async function POST(request: NextRequest) {
  const syllables = syllable;
  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });
  const bucketName = process.env.DO_BUCKET
  const SALT = process.env.SALT;
  const forbiddenWords = ["monarch", "butterflies", "worker", "immigration"];

  console.log('SALT', SALT)

  const addSalt = (text: string) => {
    return text + SALT;
  };

  const createMD5 = (text: string) => {
    const textWithSalt = addSalt(text);
    return crypto.createHash("md5").update(textWithSalt).digest("hex");
  };

  const checkFileExists = async (text: string) => {
    try {
        const hash = createMD5(text)
        const audioUrl = `https://${bucketName}.nyc3.digitaloceanspaces.com/jingle/clips/${hash}.mp3`
        console.log('CHECK IF URL EXISTS', audioUrl)
      const response = await fetch(
        audioUrl,
        { method: "HEAD" }
      );
      return { success: response.ok, audioUrl };
    } catch (e) {
        console.log('e', e)
      return { success: false }

    }
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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          'Transform the given text into 15 different fun, cheerful, and lighthearted jingles suitable for singing over the "Avocados From Mexico" jingle. Each jingle should vary in length but have at least 5 words, use words with many letters when possible, and be different from each other in structure. Importantly, each jingle should preserve the meaning of the original text as much as possible. Prohibited Words: ["Politics", "Drugs", "Weapons", "Violence", "Monarchs", "Butterflies", "Workers", "Immigrants"]Important Notes: Only check for the exact words listed in the prohibited words. Do not consider synonyms, related terms, or extended meanings. If the input text contains any of these exact words, then return the following JSON object: { "error": true }.Output Format: Return an array containing 15 objects. Each object should have a "text" key with the jingle as its value. Do not include any additional text or formatting.Example:User Input: "I would like to eat some avocados right now"Output: [ { "text": "Craving avocados here" }, { "text": "Yearning for green delights" }, … ]',
      },
      { role: "user", content: text },
    ];

    let retryCount = 0;
    const MAX_RETRIES = 5;
    const examplesOfSevenSyllables: any = [];

    while (retryCount < MAX_RETRIES && examplesOfSevenSyllables.length < 1) {
      console.log("TRY NUMBER", retryCount + 1);
      const completion: any = await openai.chat.completions.create({
        messages,
        model: "gpt-4o",
      });

      const result: any = await JSON.parse(
        completion.choices[0].message.content
      );

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
            examplesOfSevenSyllables?.length < 1 &&
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

    forbiddenWords.forEach((word: string) => {
      if (
        examplesOfSevenSyllables.some((text: string) => text.includes(word))
      ) {
        return NextResponse.json({ error: "Forbidden input" }, { status: 500 });
      }
    });

    const alreadyExists = await checkFileExists(examplesOfSevenSyllables[0])

    if(alreadyExists?.success) {
        return NextResponse.json(
            { success: true, audioUrl: alreadyExists?.audioUrl, text: examplesOfSevenSyllables[0] },
            { status: 201 }
          );
    }

    const job = await queueConnection.add("generate", {
      text: examplesOfSevenSyllables[0],
      count: 8,
    });

    let tries = 0;
    const MAX_TRIES = 60;

    const checkJobCompletion = async () => {
      tries += 1;
      try {
        if (queueConnection) {
          const completedJobs = await queueConnection.getJobs(["completed"]);
          const completedJob = completedJobs.find((j) => j.id === job.id);

          if (completedJob) {
            if (completedJob.returnvalue?.error) {
              return NextResponse.json(
                {
                  error: "An error has occurred, please try again",
                  success: false,
                },
                { status: 500 }
              );
            }

            const audioUrl = completedJob.returnvalue.clipUrl;
            console.log("Clip URL:", audioUrl);

            return audioUrl;
          }

          return null;
        }
      } catch (error) {
        console.error("Error obteniendo trabajos completados:", error);
        return NextResponse.json(
          { error: "An error has occurred, please try again", success: false },
          { status: 500 }
        );
      }
    };

    const waitForCompletion = async () => {
      let audioUrl = null;
      while (!audioUrl && tries < MAX_TRIES) {
        console.log(`Intento ${tries} de ${MAX_TRIES}...`);
        audioUrl = await checkJobCompletion();
        if (!audioUrl) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (tries >= MAX_TRIES) {
        return NextResponse.json(
          { error: "connection timeout", success: false },
          { status: 408 }
        );
      }

      return audioUrl;
    };

    const audioUrl = await waitForCompletion();

    return NextResponse.json(
      { success: true, audioUrl, text: examplesOfSevenSyllables[0] },
      { status: 201 }
    );
  } catch (e) {
    console.log("error in lyrics", e);
    return NextResponse.json(
      { error: "An error has occurred, please try again" },
      { status: 500 }
    );
  }
}
