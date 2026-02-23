import { getToken } from './auth.js';

const MODELS_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';
const MODEL = 'gpt-4o';

const SYSTEM_PROMPT = `You are a form design assistant. Given a user's description of a data entry form, produce a JSON specification.

Return ONLY valid JSON (no markdown fences, no explanation) matching this schema:

{
  "title": "Form Title",
  "formName": "snake_case_form_name",
  "sections": [
    {
      "heading": "Section Title (markdown supported)",
      "fields": [
        {
          "type": "text|password|dropdown|checkbox|radio|table|button",
          "label": "Field Label",
          "name": "field_name",
          "placeholder": "optional placeholder",
          "required": true|false,
          "options": ["opt1", "opt2"],
          "columns": [
            { "header": "Col Name", "type": "text|dropdown|checkbox", "name": "col_name", "options": [] }
          ],
          "initialRows": 3,
          "events": [
            { "event": "click|change|input|...", "description": "What should happen", "handler": "// JavaScript code" }
          ]
        }
      ]
    }
  ]
}

Rules:
- Use "password" type for any password or secret fields (renders as masked input with toggle)
- "options" is only for dropdown and radio types
- "columns" and "initialRows" are only for table type
- "events" can be on any field type. For buttons, always include a click event.
- Generate meaningful "handler" JavaScript code for each event based on the description.
- Use snake_case for all "name" fields
- Always include a submit button at the end unless the user says otherwise
- The submit button's click handler should be: "document.getElementById('main-form').requestSubmit()"
- For tables, generate "Add Row" button event handlers that clone table rows
- Be creative but practical with the form design`;

export async function generateFormSpec(userPrompt) {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated. Run: adcgen --login');
  }

  const fetch = (await import('node-fetch')).default;

  const res = await fetch(MODELS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from LLM');
  }

  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse LLM response as JSON: ${e.message}\n\nRaw:\n${cleaned}`);
  }
}
