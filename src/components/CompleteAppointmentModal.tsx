import { useEffect, useState } from "react";
import { markAppointmentDone, formatPreferredSlot } from "../lib/appointments";
import { findPatientByPhone, saveVisit } from "../lib/patients";
import type { Appointment, Patient } from "../lib/types";
import Icon from "./Icon";
import Modal from "./Modal";
import VisitRecordForm from "./VisitRecordForm";

// Mark Done from the Needs Action tab: record the visit, then close out the
// appointment. The patient is matched by phone; if none matches, a new
// patient is created from the appointment's details when the form is saved.
function CompleteAppointmentFlow({
  appointment: a,
  onClose,
  onDone,
}: {
  appointment: Appointment;
  onClose: () => void;
  onDone: () => void;
}) {
  // undefined = still looking; null = no match (a new patient will be created).
  const [match, setMatch] = useState<Patient | null | undefined>(undefined);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    findPatientByPhone(a.patient_phone)
      .then((patient) => {
        if (!cancelled) setMatch(patient);
      })
      .catch((err) => {
        if (cancelled) return;
        setLookupError(err instanceof Error ? err.message : "Couldn't look up the patient.");
      });
    return () => {
      cancelled = true;
    };
  }, [a.patient_phone]);

  if (lookupError) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-error bg-error-container/40 rounded-lg px-3 py-2">{lookupError}</p>
        <button
          type="button"
          onClick={onClose}
          className="self-start text-sm font-semibold text-on-surface-variant hover:underline"
        >
          Close
        </button>
      </div>
    );
  }

  if (match === undefined) {
    return <p className="text-sm text-on-surface-variant">Looking up patient by phone…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm rounded-lg px-4 py-3 bg-surface-container-low border border-outline-variant/50 flex items-start gap-2">
        <Icon name={match ? "how_to_reg" : "person_add"} className="text-lg text-secondary" />
        <p className="text-on-surface-variant">
          Appointment on{" "}
          <span className="font-semibold text-primary">
            {formatPreferredSlot(a.preferred_date, a.preferred_time)}
          </span>
          .{" "}
          {match ? (
            <>
              Matched existing patient{" "}
              <span className="font-semibold text-primary">{match.full_name}</span>
              {match.mri_id && <> (MRI ID {match.mri_id})</>} by phone{" "}
              {a.patient_phone.trim()}.
            </>
          ) : (
            <>No patient with phone {a.patient_phone.trim()} yet, so a new patient will be created.</>
          )}
        </p>
      </div>

      <VisitRecordForm
        patientName={match?.full_name ?? a.patient_name}
        phone={match ? match.phone : a.patient_phone}
        mriId={match?.mri_id}
        dateOfBirth={match?.date_of_birth}
        sex={match?.sex}
        lockPatient={Boolean(match)}
        defaultDoctorId={a.doctor_id}
        lockDoctor
        submitLabel="Save Record & Mark Done"
        onCancel={onClose}
        secondaryAction={{
          label: "Skip — mark done without a record",
          onClick: async () => {
            await markAppointmentDone(a);
            onDone();
          },
        }}
        onSubmit={async (visit, { sex }) => {
          await saveVisit({
            appointmentId: a.id,
            visit,
            patient: match
              ? { kind: "existing", patient: match }
              : {
                  kind: "new",
                  input: {
                    full_name: a.patient_name,
                    phone: a.patient_phone,
                    sex,
                    date_of_birth: null,
                  },
                },
          });
          onDone();
        }}
      />
    </div>
  );
}

export default function CompleteAppointmentModal({
  appointment,
  open,
  onClose,
  onDone,
}: {
  appointment: Appointment;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Complete visit — ${appointment.patient_name}`} wide>
      <CompleteAppointmentFlow appointment={appointment} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}
