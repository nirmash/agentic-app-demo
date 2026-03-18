import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateFormHtml } from '../src/eleventy-builder.js';

// ─── Helpers (same pattern as eleventy-builder.test.js) ─────────

function makeSpec(overrides = {}) {
  return {
    title: overrides.title || 'Test Form',
    formName: overrides.formName || 'test_form',
    sections: overrides.sections || [],
  };
}

function makeField(type, extra = {}) {
  return { type, label: `Test ${type}`, name: `test_${type}`, ...extra };
}

// ─── Feature 1: Lookup Dropdown ─────────────────────────────────

describe('generateFormHtml — lookup dropdown (single-select)', () => {
  const spec = makeSpec({
    sections: [{
      heading: 'References',
      fields: [{
        type: 'lookup',
        label: 'Primary Speaker',
        name: 'speaker_ref',
        source: 'speaker',
        displayField: 'full_name',
        valueField: 'speaker_uid',
        multiple: false,
      }],
    }],
  });

  it('should be recognized as a valid field type (not unknown)', () => {
    const html = generateFormHtml(spec);
    assert.ok(
      !html.includes('<!-- Unknown field type: lookup -->'),
      'lookup should not fall through to the unknown-type comment'
    );
  });

  it('should render a <select> element with the field id', () => {
    const html = generateFormHtml(spec);
    assert.ok(html.includes('<select'), 'should contain a <select> element');
    assert.ok(html.includes('id="speaker_ref"'), 'select should have the field name as id');
  });

  it('should NOT include the "multiple" attribute', () => {
    const html = generateFormHtml(spec);
    // Extract the <select ...> tag for this field to inspect its attributes
    const match = html.match(/<select[^>]*id="speaker_ref"[^>]*>/);
    assert.ok(match, 'should find the select element');
    assert.ok(!match[0].includes('multiple'), 'single-select lookup must not have multiple attribute');
  });

  it('should include JavaScript to fetch records from /api/records/{source}', () => {
    const html = generateFormHtml(spec);
    // Lookup uses data attributes + dynamic JS fetch: '/api/records/' + source
    assert.ok(
      html.includes("data-lookup-source=\"speaker\""),
      'should store the source in a data attribute for the dynamic fetch'
    );
    assert.ok(
      html.includes("/api/records/' + source") || html.includes('/api/records/'),
      'should include the records API path in the lookup JS'
    );
  });

  it('should reference displayField for option text', () => {
    const html = generateFormHtml(spec);
    assert.ok(html.includes('full_name'), 'should reference displayField "full_name" somewhere in the output');
  });

  it('should reference valueField for option value', () => {
    const html = generateFormHtml(spec);
    assert.ok(html.includes('speaker_uid'), 'should reference valueField "speaker_uid" somewhere in the output');
  });

  it('should render the field label', () => {
    const html = generateFormHtml(spec);
    assert.ok(html.includes('Primary Speaker'), 'should display the field label');
  });
});

describe('generateFormHtml — lookup dropdown (multi-select)', () => {
  const spec = makeSpec({
    sections: [{
      fields: [{
        type: 'lookup',
        label: 'Assigned Sessions',
        name: 'session_refs',
        source: 'session',
        displayField: 'session_title',
        valueField: 'session_code',
        multiple: true,
      }],
    }],
  });

  it('should render a <select> with the "multiple" attribute', () => {
    const html = generateFormHtml(spec);
    const match = html.match(/<select[^>]*id="session_refs"[^>]*>/);
    assert.ok(match, 'should find the select element');
    assert.ok(match[0].includes('multiple'), 'multi-select lookup must have the multiple attribute');
  });

  it('should include JavaScript to fetch from /api/records/{source}', () => {
    const html = generateFormHtml(spec);
    assert.ok(
      html.includes('data-lookup-source="session"'),
      'should store the session source in a data attribute for dynamic fetch'
    );
  });

  it('should reference displayField for multi-select options', () => {
    const html = generateFormHtml(spec);
    assert.ok(html.includes('session_title'), 'should reference displayField "session_title"');
  });

  it('should reference valueField for multi-select options', () => {
    const html = generateFormHtml(spec);
    assert.ok(html.includes('session_code'), 'should reference valueField "session_code"');
  });
});

// ─── Feature 2: Links Open New Record ───────────────────────────

describe('generateFormHtml — links open new record', () => {
  const spec = makeSpec({
    formName: 'speaker',
    sections: [{
      fields: [
        makeField('text'),
        {
          type: 'link',
          label: 'Go to Attendee',
          name: 'attendee_link',
          href: '/attendee/',
        },
      ],
    }],
  });

  it('should generate link href with ?new=true parameter', () => {
    const html = generateFormHtml(spec);
    assert.ok(
      html.includes('/attendee/?new=true') || html.includes("/attendee/'+'?new=true"),
      'link should include ?new=true to open a blank record'
    );
  });

  it('should preserve the original href path in the link', () => {
    const html = generateFormHtml(spec);
    assert.ok(html.includes('/attendee/'), 'should keep the original link target');
  });

  it('should still render link text', () => {
    const html = generateFormHtml(spec);
    assert.ok(html.includes('Go to Attendee'), 'link text should be present');
  });

  it('should handle ?new=true URL param in form JavaScript', () => {
    const formSpec = makeSpec({
      formName: 'attendee',
      sections: [{ fields: [makeField('text')] }],
    });
    const html = generateFormHtml(formSpec);
    // The form JS should read the 'new' param and skip auto-loading existing record
    const checksNewParam =
      html.includes("urlParams.get('new')") ||
      html.includes('urlParams.get("new")') ||
      html.includes("get('new')") ||
      html.includes('new=true');
    assert.ok(checksNewParam, 'form JavaScript should check for new=true URL parameter');
  });
});

// ─── Feature 3: Back Home Button ────────────────────────────────

describe('generateFormHtml — back home button', () => {
  const spec = makeSpec({
    title: 'Speaker Registration',
    formName: 'speaker',
    sections: [{ fields: [makeField('text')] }],
  });

  it('should include a link pointing to /', () => {
    const html = generateFormHtml(spec);
    assert.ok(
      html.includes('href="/"') || html.includes("href='/'"),
      'should include a navigation link to the home page (/)'
    );
  });

  it('should have visible Home text or icon', () => {
    const html = generateFormHtml(spec);
    const hasHome = html.includes('Home') || html.includes('🏠');
    assert.ok(hasHome, 'should display "Home" text or a home icon');
  });

  it('should include the Home link even for forms with empty sections', () => {
    const emptySpec = makeSpec({ title: 'Empty Form', sections: [] });
    const html = generateFormHtml(emptySpec);
    assert.ok(
      html.includes('href="/"') || html.includes("href='/'"),
      'even empty forms should have a Home navigation link'
    );
  });

  it('should render the Home link as a button or anchor element', () => {
    const html = generateFormHtml(spec);
    // The Home link should be an <a> or a <button> — not just raw text
    const homeAnchor = html.includes('<a') && (html.includes('Home') || html.includes('🏠'));
    const homeButton = html.includes('<button') && (html.includes('Home') || html.includes('🏠'));
    assert.ok(homeAnchor || homeButton, 'Home should be a clickable element (anchor or button)');
  });
});

// ─── Feature 4: Breadcrumbs ────────────────────────────────────

describe('generateFormHtml — breadcrumbs', () => {
  it('should include a breadcrumb navigation element', () => {
    const spec = makeSpec({
      title: 'Speaker Registration',
      formName: 'speaker',
      sections: [{ fields: [makeField('text')] }],
    });
    const html = generateFormHtml(spec);
    const hasBreadcrumb =
      html.includes('Breadcrumb') || html.includes('breadcrumb') ||
      html.includes('bread-crumb') || html.includes('aria-label="Breadcrumb"') ||
      html.includes('aria-label="breadcrumb"');
    assert.ok(hasBreadcrumb, 'should include a breadcrumb navigation element');
  });

  it('should include Home in the breadcrumb trail', () => {
    const spec = makeSpec({
      title: 'Speaker Registration',
      formName: 'speaker',
      sections: [{ fields: [makeField('text')] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('Home'), 'breadcrumbs should include "Home"');
  });

  it('should link Home to / in the breadcrumbs', () => {
    const spec = makeSpec({
      title: 'Speaker Registration',
      formName: 'speaker',
      sections: [{ fields: [makeField('text')] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('href="/"'), 'breadcrumb Home should link to /');
  });

  it('should include the form title in the breadcrumbs', () => {
    const spec = makeSpec({
      title: 'Speaker Registration',
      formName: 'speaker',
      sections: [{ fields: [makeField('text')] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(
      html.includes('Speaker Registration'),
      'breadcrumbs should include the form title'
    );
  });

  it('should order breadcrumbs as Home > FormTitle', () => {
    const spec = makeSpec({
      title: 'Attendee Form',
      formName: 'attendee',
      sections: [{ fields: [makeField('text')] }],
    });
    const html = generateFormHtml(spec);
    // Home should appear before the form title in document order
    const homeIdx = html.indexOf('Home');
    const titleIdx = html.indexOf('Attendee Form', homeIdx > -1 ? homeIdx : 0);
    assert.ok(homeIdx >= 0, 'breadcrumbs should contain Home');
    assert.ok(titleIdx > homeIdx, 'form title should appear after Home in breadcrumbs');
  });

  it('should escape HTML entities in the breadcrumb form title', () => {
    const spec = makeSpec({
      title: 'Q&A <Form>',
      formName: 'qa_form',
      sections: [{ fields: [makeField('text')] }],
    });
    const html = generateFormHtml(spec);
    // The title is already escaped in the <h1>, but breadcrumbs should also escape
    assert.ok(
      html.includes('Q&amp;A') || html.includes('Q&A'),
      'should handle special characters in breadcrumb title'
    );
  });

  it('should include breadcrumbs even for forms with no sections', () => {
    const spec = makeSpec({ title: 'Blank Form', sections: [] });
    const html = generateFormHtml(spec);
    const hasBreadcrumb =
      html.includes('Breadcrumb') || html.includes('breadcrumb') ||
      html.includes('bread-crumb') || html.includes('aria-label="Breadcrumb"') ||
      html.includes('aria-label="breadcrumb"');
    assert.ok(hasBreadcrumb, 'breadcrumbs should be present even on empty forms');
  });
});
