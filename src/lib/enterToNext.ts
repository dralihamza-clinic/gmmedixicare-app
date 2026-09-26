// App-wide Enter behavior for forms: Enter in a single-line text input moves
// focus to the next field; on the last field it submits (like clicking Save).
// Selects and textareas are left alone so Enter keeps its native meaning
// there (open the list / new line).
//
// A "form" is a <form>, or any element marked data-enter-scope whose save
// button is marked data-enter-submit (for editors that can't be a <form>,
// e.g. one nested inside another form's page). Inputs in neither, such as
// standalone search boxes, keep the browser's default behavior.

// Single-line input types; checkboxes, radios, files etc. don't qualify.
const TEXT_TYPES = new Set([
  "text",
  "email",
  "password",
  "number",
  "tel",
  "search",
  "url",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
]);

const SKIPPED_INPUT_TYPES = new Set(["hidden", "file", "submit", "button", "reset", "image"]);

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// Fields Enter can move focus to: enabled, tabbable, visible, and not the
// phone input's country picker (the number next to it is what staff want).
function isNavigable(el: Element): el is Field {
  if (
    !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)
  ) {
    return false;
  }
  if (el.disabled || el.tabIndex < 0) return false;
  if (el instanceof HTMLInputElement && (SKIPPED_INPUT_TYPES.has(el.type) || el.readOnly)) return false;
  if (el.classList.contains("PhoneInputCountrySelect")) return false;
  return el.getClientRects().length > 0;
}

function submit(scope: HTMLFormElement | HTMLElement) {
  if (scope instanceof HTMLFormElement) {
    const button = Array.from(scope.elements).find(
      (el): el is HTMLButtonElement | HTMLInputElement =>
        (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) && el.type === "submit"
    );
    // A disabled Save (e.g. while saving) means the form isn't ready.
    if (button?.disabled) return;
    scope.requestSubmit(button);
  } else {
    const button = scope.querySelector<HTMLButtonElement>("[data-enter-submit]");
    if (button && !button.disabled) button.click();
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Enter" || e.defaultPrevented || e.isComposing) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

  const input = e.target;
  if (!(input instanceof HTMLInputElement) || !TEXT_TYPES.has(input.type)) return;

  const scope = input.form ?? input.closest<HTMLElement>("[data-enter-scope]");
  if (!scope) return;

  const fields = (
    scope instanceof HTMLFormElement
      ? Array.from(scope.elements)
      : Array.from(scope.querySelectorAll("input, select, textarea"))
  ).filter(isNavigable);
  const index = fields.indexOf(input);
  if (index === -1) return; // e.g. a read-only input

  e.preventDefault();
  const next = fields[index + 1];
  if (next) next.focus();
  else submit(scope);
}

let installed = false;

// Bubble phase on document, so a component's own Enter handling (which runs
// first and can preventDefault) wins.
export function installEnterToNext() {
  if (installed) return;
  installed = true;
  document.addEventListener("keydown", onKeyDown);
}
