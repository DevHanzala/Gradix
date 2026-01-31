export const generateAIPrompt = (assessment) => {
  if (!assessment) return "";

  const questionTypes = [...new Set(assessment.question_blocks?.map(b => b.question_type) || [])];
  const mcqOptionsCount = assessment.question_blocks?.find(b => b.question_type === "multiple_choice")?.num_options || "N/A";

  let promptText = `Generate questions in English language only. All text MUST be in English.

CONTENT TO BASE QUESTIONS ON:
Title: "${assessment.title}"

Instructor Prompt: "${assessment.prompt || "No prompt provided"}"`;

  // Add external links if present
  if ((assessment.external_links || []).length > 0) {
    promptText += `\nExternal Links: ${assessment.external_links.join(", ")}`;
  }

  // Add uploaded resources if present
  if ((assessment.resources || []).length > 0) {
    promptText += `\n\nUploaded Resource Content:\n${assessment.resources.map(r =>
      `Resource "${r.name}":\n${r.chunks?.map(c => c.chunk_text.trim()).join("\n\n") || "No content"}`
    ).join("\n\n---\n\n")}`;
  }

  promptText += `\n\nGenerate questions STRICTLY based on the above content.

Generate ONLY a valid JSON array of questions. NO extra text.

STRICT RULES:
1. Question types exactly: ${questionTypes.join(", ")}
2. Exact counts: ${assessment.question_blocks?.map(b =>
    b.question_type === "multiple_choice"
      ? `${b.question_count} multiple_choice (${b.num_options} options per question)`
      : `${b.question_count} ${b.question_type}`
  ).join(", ") || "None"}
3. EVERY question MUST have:
   - question_type
   - question_text
   - options (array for MCQ with exactly ${mcqOptionsCount} options, ["true","false"] for true_false, null for short_answer)
   - correct_answer
   - positive_marks
   - negative_marks
   - duration_per_question`;

  if (assessment.question_blocks?.length > 0) {
    assessment.question_blocks.forEach(b => {
      promptText += `\n4. For ${b.question_type} questions:
      - positive_marks: ${b.positive_marks}
      - negative_marks: ${b.negative_marks}
      - duration_per_question: ${b.duration_per_question} seconds`;
    });
  }

  promptText += `\n5. MCQ correct_answer MUST be the FULL OPTION TEXT like "B. Paris"
6. true_false correct_answer MUST be boolean true/false
7. No missing fields
8. Output ONLY JSON array [ ... ]
9. Respond with ONLY the JSON array.`;

  return promptText.trim();
};