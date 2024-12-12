import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/db";

export async function POST(request: NextRequest) {
  console.time("settings-api");
  
  try {
    const { forbiddenWords, prompt, examples } = await request.json();
    
    const query = `
      UPDATE prompt 
      SET forbidden_words = $1,
          prompt = $2,
          examples = $3,
          created_at = CURRENT_TIMESTAMP
      WHERE id = 1
      RETURNING *
    `;
    
    const result = await pool.query(query, [forbiddenWords, prompt, JSON.stringify(examples)]);
    return NextResponse.json({ success: true, data: result.rows[0] });
    
  } catch (e) {
    console.log("error in settings", e);
    return NextResponse.json(
      { error: "An error has occurred" },
      { status: 500 }
    );
  } finally {
    console.timeEnd("settings-api");
  }
}

export async function GET() {
  try {
    console.log('GET PROMPT DATA')
    const result = await pool.query('SELECT * FROM prompt WHERE id = 1');
    return NextResponse.json({ data: result.rows[0] });
  } catch (e) {
    console.log("error in get", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}