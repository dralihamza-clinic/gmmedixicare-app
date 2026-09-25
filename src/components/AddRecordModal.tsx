import { useState, type FormEvent } from "react";
import { saveVisit, type VisitPatient } from "../lib/patients";
import { SEX_OPTIONS, type NewPatientInput, type Patient } from "../lib/types";
import { todayLocal } from "../lib/appointments";
import { phoneError, type PhoneValue } from "../lib/phone";
import Icon from "./Icon";
import Modal from "./Modal";
import PhoneField from "./PhoneField";
import PatientPicker from "./PatientPicker";
import VisitRecordForm, { fieldClass } from "./VisitRecordForm";

type Step =
  | { name: "choose" }
  | { name: "new-patient"; draft?: NewPatientInput }
  | { name: "pick" }
  | { name: "visit"; patient: VisitPatient };

const labelClass = "flex flex-col gap-1.5 text-sm font-semibold text-primary";

function NewPatientForm({
  draft,
  onBack,
  onContinue,
}: {
  draft?: NewPatientInput;
  onBack: () => void;
  onContinue: (input: NewPatientInput) => void;
}) {
  // E.164 from the phone input; a draft coming back from the visit step is
  // already in that format.
  const [phone, setPhone] = useState<PhoneValue | undefined>(
    (draft?.phone as PhoneValue | null) ?? undefined
  );
  const [phoneMessage, setPhoneMessage] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = phoneError(phone);
    if (problem) {
      setPhoneMessage(problem);
      document.getElementById("new-patient-phone")?.focus();
      return;
    }
    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim() || null;
    onContinue({
      full_name: value("full_name") ?? "",
      phone: phone ?? null,
      email: value("email"),
      sex: value("sex"),
      date_of_birth: value("date_of_birth"),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <label className={`${labelClass} col-span-2`}>
        Full name *
        <input name="full_name" required autoFocus defaultValue={draft?.full_name} className={fieldClass} />
      </label>
      {/* A div, not a <label>: clicking a wrapping label would focus the
          country picker instead of the number. */}
      <div className={labelClass}>
        <label htmlFor="new-patient-phone">Phone *</label>
        <PhoneField
          id="new-patient-phone"
          value={phone}
          onChange={(next) => {
            setPhone(next);
            // Once an error is showing, clear it as soon as it's fixed.
            if (phoneMessage) setPhoneMessage(phoneError(next));
          }}
          onBlur={() => {
            if (phone) setPhoneMessage(phoneError(phone));
          }}
          error={phoneMessage}
        />
      </div>
      <label className={labelClass}>
        Email <span className="font-normal text-on-surface-variant">(optional)</span>
        <input name="email" type="email" defaultValue={draft?.email ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Sex *
        <select name="sex" required defaultValue={draft?.sex ?? ""} className={fieldClass}>
          <option value="" disabled>
            Select…
          </option>
          {SEX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Date of birth <span className="font-normal text-on-surface-variant">(optional)</span>
        <input
          name="date_of_birth"
          type="date"
          max={todayLocal()}
          defaultValue={draft?.date_of_birth ?? ""}
          className={fieldClass}
        />
      </label>
      <div className="col-span-2 flex justify-between pt-2">
        <button type="button" onClick={onBack} className="text-sm font-semibold text-on-surface-variant hover:underline">
          Back
        </button>
        <button
          type="submit"
          className="bg-secondary text-on-secondary font-label-caps text-label-caps px-8 py-3 rounded-full hover:bg-secondary/90 transition-colors"
        >
          Continue to Visit Record
        </button>
      </div>
    </form>
  );
}

function ChoiceCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: string;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 text-left p-5 rounded-xl border border-outline-variant hover:border-secondary hover:bg-surface-container-low transition-colors flex flex-col gap-2"
    >
      <Icon name={icon} className="text-3xl text-secondary" />
      <span className="font-bold text-primary">{title}</span>
      <span className="text-sm text-on-surface-variant">{body}</span>
    </button>
  );
}

function AddRecordFlow({
  initialPatient,
  onClose,
  onSaved,
}: {
  initialPatient?: Patient;
  onClose: () => void;
  onSaved: (patientId: string) => void;
}) {
  const [step, setStep] = useState<Step>(
    initialPatient
      ? { name: "visit", patient: { kind: "existing", patient: initialPatient } }
      : { name: "choose" }
  );

  if (step.name === "choose") {
    return (
      <div className="flex gap-4">
        <ChoiceCard
          icon="person_add"
          title="New Patient"
          body="First visit. Enter their details, then the visit record."
          onClick={() => setStep({ name: "new-patient" })}
        />
        <ChoiceCard
          icon="person_search"
          title="Existing Patient"
          body="Find them by name or phone, then add the visit record."
          onClick={() => setStep({ name: "pick" })}
        />
      </div>
    );
  }

  if (step.name === "new-patient") {
    return (
      <NewPatientForm
        draft={step.draft}
        onBack={() => setStep({ name: "choose" })}
        onContinue={(input) => setStep({ name: "visit", patient: { kind: "new", input } })}
      />
    );
  }

  if (step.name === "pick") {
    return (
      <div className="flex flex-col gap-4">
        <PatientPicker
          autoFocus
          listClassName="max-h-[50vh] overflow-y-auto"
          onSelect={(patient) => setStep({ name: "visit", patient: { kind: "existing", patient } })}
        />
        <button
          type="button"
          onClick={() => setStep({ name: "choose" })}
          className="self-start text-sm font-semibold text-on-surface-variant hover:underline"
        >
          Back
        </button>
      </div>
    );
  }

  const visitPatient = step.patient;
  const info = visitPatient.kind === "new" ? visitPatient.input : visitPatient.patient;

  return (
    <VisitRecordForm
      patientName={info.full_name}
      dateOfBirth={info.date_of_birth}
      sex={info.sex}
      submitLabel="Save Record"
      onCancel={() => {
        // Back to the previous step (keeping a new patient's details), or
        // close when we came straight from a patient's profile.
        if (initialPatient) onClose();
        else if (visitPatient.kind === "new") setStep({ name: "new-patient", draft: visitPatient.input });
        else setStep({ name: "pick" });
      }}
      onSubmit={async (visit, sex) => {
        const patient: VisitPatient =
          visitPatient.kind === "existing" ? { ...visitPatient, sex } : visitPatient;
        onSaved(await saveVisit({ patient, visit }));
      }}
    />
  );
}

// "Add Record" from the Patients page (asks New vs Existing), or from a
// patient's profile (initialPatient set: straight to the visit form).
export default function AddRecordModal({
  open,
  onClose,
  onSaved,
  initialPatient,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (patientId: string) => void;
  initialPatient?: Patient;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Add Visit Record" wide>
      <AddRecordFlow initialPatient={initialPatient} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
