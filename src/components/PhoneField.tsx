import PhoneInput from "react-phone-number-input/max";
import "react-phone-number-input/style.css";
import { DEFAULT_PHONE_COUNTRY, type PhoneValue } from "../lib/phone";

// react-phone-number-input styled like the app's other fields. The border
// and focus ring sit on the wrapper so the flag picker and the number read
// as one input. Controlled: value is E.164 ("+923001234567") or undefined.
export default function PhoneField({
  id,
  value,
  onChange,
  onBlur,
  error,
  autoFocus,
}: {
  id: string;
  value: PhoneValue | undefined;
  onChange: (value: PhoneValue | undefined) => void;
  onBlur?: () => void;
  /** Inline error text; the field turns red while set. */
  error?: string;
  autoFocus?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <>
      <PhoneInput
        id={id}
        defaultCountry={DEFAULT_PHONE_COUNTRY}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        autoFocus={autoFocus}
        placeholder="0300 1234567"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-lg border px-3 bg-surface-container-lowest focus-within:ring-2 focus-within:ring-secondary ${
          error ? "border-error" : "border-outline-variant"
        }`}
        numberInputProps={{
          className: "border-0 bg-transparent px-0 py-2 text-sm font-normal focus:outline-none focus:ring-0",
        }}
      />
      {error && (
        <span id={errorId} className="text-xs font-normal text-error">
          {error}
        </span>
      )}
    </>
  );
}
