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
          "type": "text|password|dropdown|checkbox|radio|table|button|link",
          "label": "Field Label",
          "name": "field_name",
          "placeholder": "optional placeholder",
          "required": true|false,
          "options": ["opt1", "opt2"],
          "href": "/page_name/",
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
- Use "link" type for navigation links to other pages. Set "href" to the page path (e.g. "/add_user/" for the add_user page). The "label" is the link text.
- "options" is only for dropdown and radio types
- "href" is only for link type
- "columns" and "initialRows" are only for table type
- "events" can be on any field type. For buttons, always include a click event.
- Generate meaningful "handler" JavaScript code for each event based on the description.
- Use snake_case for all "name" fields
- Always include a submit button at the end unless the user says otherwise
- IMPORTANT: The form element always has id="main-form". Any handler that submits the form MUST use: document.getElementById('main-form').requestSubmit()
- NEVER reference any other form ID in handlers. The only form ID is "main-form".
- DO NOT generate "Add Row" or "Delete Row" buttons or event handlers for tables — the system adds those automatically.
- Table columns can have "required": true to mark them as required. Example column: { "header": "Email", "type": "text", "name": "email", "required": true }
- Set "initialRows" to 1 for tables (the user can add more rows with the built-in Add Row button)
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
    const spec = JSON.parse(cleaned);
    sanitizeHandlers(spec);
    return spec;
  } catch (e) {
    throw new Error(`Failed to parse LLM response as JSON: ${e.message}\n\nRaw:\n${cleaned}`);
  }
}

// Fix any event handlers that reference wrong form IDs and strip auto-managed table buttons
function sanitizeHandlers(spec) {
  for (const section of spec.sections || []) {
    // Remove LLM-generated "Add Row" / "Delete Row" buttons (we add those automatically)
    section.fields = (section.fields || []).filter(field => {
      if (field.type === 'button') {
        const label = (field.label || '').toLowerCase();
        if (label.includes('add row') || label.includes('delete row') || label.includes('remove row')) {
          return false;
        }
      }
      return true;
    });

    for (const field of section.fields || []) {
      // Strip table-row add/delete events from table fields
      if (field.type === 'table' && field.events) {
        field.events = field.events.filter(evt => {
          const desc = (evt.description || '').toLowerCase();
          return !desc.includes('add') || !desc.includes('row');
        });
      }
      if (!field.events) continue;
      for (const evt of field.events) {
        if (evt.handler) {
          evt.handler = evt.handler.replace(
            /document\.getElementById\(['"][^'"]+['"]\)\.requestSubmit\(\)/g,
            "document.getElementById('main-form').requestSubmit()"
          );
        }
      }
    }
  }
}

const EDIT_SYSTEM_PROMPT = `You are a form design assistant. You are given an existing form specification as JSON and a user's requested change.

Apply the requested change and return the COMPLETE updated JSON specification.

Return ONLY valid JSON (no markdown fences, no explanation). Keep the same schema structure. Preserve all existing fields and settings that are not affected by the change. The form element always has id="main-form" — any handler that submits the form MUST use: document.getElementById('main-form').requestSubmit()

For links to other pages, use type "link" with "href" set to "/<page_name>/" and "label" for the link text.
DO NOT generate "Add Row" or "Delete Row" buttons or event handlers for tables — the system adds those automatically.
Table columns can have "required": true. Set "initialRows" to 1 for tables.`;

const EDIT_HTML_PROMPT = `You are an HTML form editor. You are given an existing HTML page and a user's requested change.

Apply the requested change to the HTML and return the COMPLETE updated HTML page.

Return ONLY the full HTML (no markdown fences, no explanation). Preserve all existing content, styles, scripts, and structure that are not affected by the change. Keep the GitHub Primer CSS dark mode styling. Keep all form submission logic and event handlers intact unless the user explicitly asks to change them.`;

export async function editFormSpec(currentSpec, changeRequest, availablePages) {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated. Run: adcgen login');
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
        { role: 'system', content: EDIT_SYSTEM_PROMPT },
        { role: 'user', content: `Current form spec:\n${JSON.stringify(currentSpec, null, 2)}\n\nAvailable pages in the site: ${(availablePages || []).map(p => `/${p}/`).join(', ') || 'none'}\n\nRequested change:\n${changeRequest}` }
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
  if (!content) throw new Error('No response from LLM');

  const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  try {
    const spec = JSON.parse(cleaned);
    sanitizeHandlers(spec);
    return spec;
  } catch (e) {
    throw new Error(`Failed to parse LLM response as JSON: ${e.message}\n\nRaw:\n${cleaned}`);
  }
}

export async function editFormHtml(currentHtml, changeRequest, availablePages) {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated. Run: adcgen login');
  }

  const fetch = (await import('node-fetch')).default;

  const pagesContext = (availablePages || []).length > 0
    ? `\n\nAvailable pages in the site: ${availablePages.map(p => `/${p}/`).join(', ')}`
    : '';

  const res = await fetch(MODELS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: EDIT_HTML_PROMPT },
        { role: 'user', content: `Current HTML:\n${currentHtml}${pagesContext}\n\nRequested change:\n${changeRequest}` }
      ],
      temperature: 0.7,
      max_tokens: 8000
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from LLM');

  // Strip markdown fences if present
  return content.replace(/^```(?:html)?\n?/m, '').replace(/\n?```$/m, '').trim();
}
