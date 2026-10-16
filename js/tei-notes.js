// Shared CETEIcean behavior for <note>, used by manuscripts.html and persons.html.
// The note vocabulary is defined in MssVersoris/docs/note_types.md:
//   mss.xml:          content, condition, attribution, msRelationship, editorial, paleo, biblio
//   PersonRegister:   bio, role, biblio
// CETEIcean keeps the <tei-note type="…"> host and puts the returned element inside it, so
// labels and layout per type live in versoris.css (tei-note[type="…"]). This function only
// builds what CSS cannot: the condition flag and the collapsible editorial aside.

(function () {
  function contentSpan(e) {
    const span = document.createElement("span");
    span.className = "note-content";
    span.innerHTML = e.innerHTML;
    return span;
  }

  // Editorial remarks stay inline: a small "ed." marker that opens the remark in brackets in the
  // flow of the sentence. A button + span, not <details>: Chrome lays out a <details> body as a
  // block even when the element is display:inline, which broke the line.
  function editorial(e) {
    const wrap = document.createElement("span");
    wrap.className = "note-editorial";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "note-marker";
    btn.textContent = "ed.";
    btn.title = "Editorial note";
    btn.setAttribute("aria-expanded", "false");
    const body = contentSpan(e);
    body.hidden = true;
    btn.addEventListener("click", ev => {
      ev.stopPropagation();
      body.hidden = !body.hidden;
      btn.setAttribute("aria-expanded", String(!body.hidden));
    });
    wrap.append(btn, body);
    return wrap;
  }

  // Condition: always visible, with a flag in front of the statement.
  function condition(e) {
    const wrap = document.createElement("span");
    wrap.className = "note-condition";
    const flag = document.createElement("span");
    flag.className = "note-flag";
    flag.innerHTML = '<i class="bi bi-exclamation-diamond" aria-hidden="true"></i> Condition';
    wrap.appendChild(flag);
    wrap.appendChild(contentSpan(e));
    return wrap;
  }

  window.renderTeiNote = function (e) {
    const type = e.getAttribute("type");
    if (type === "editorial") return editorial(e);
    if (type === "condition") return condition(e);
    return contentSpan(e);
  };
})();
