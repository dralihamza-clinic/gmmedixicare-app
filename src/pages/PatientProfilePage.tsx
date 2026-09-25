import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AddRecordModal from "../components/AddRecordModal";
import Icon from "../components/Icon";
import { ageOn, formatDate, getPatient, listPatientRecords } from "../lib/patients";
import { todayLocal } from "../lib/appointments";
import { exportPatientHistoryPdf } from "../lib/exportPatientPdf";
import { SEX_OPTIONS, type MedicalRecordWithDoctor, type Patient } from "../lib/types";

function Vital({ label, value, unit }: { label: string; value: unknown; unit?: string }) {
  const shown = value === null || value === undefined || value === "" ? "—" : `${value}${unit ?? ""}`;
  return (
    <div>
      <p className="text-xs text-on-surface-variant uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-primary">{shown}</p>
    </div>
  );
}

function ClinicalText({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-on-surface whitespace-pre-line">{value}</p>
    </div>
  );
}

function RecordCard({ record: r }: { record: MedicalRecordWithDoctor }) {
  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="font-bold text-primary flex items-center gap-2">
          <Icon name="event" className="text-lg text-secondary" />
          {formatDate(r.visit_date)}
        </p>
        <div className="flex items-center gap-3 text-sm text-on-surface-variant">
          {r.appointment_id && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary-fixed/30 text-on-secondary-fixed-variant">
              From appointment
            </span>
          )}
          <span>{r.doctor?.name ?? "Unknown doctor"}</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4 p-3 rounded-lg bg-surface-container-low">
        <Vital label="Age" value={r.age} />
        <Vital label="Temp" value={r.temperature} unit=" °F" />
        <Vital label="B.P." value={r.blood_pressure} />
        <Vital label="Pulse" value={r.pulse} unit=" bpm" />
        <Vital label="Weight" value={r.weight} unit=" kg" />
      </div>
      <ClinicalText label="Labs" value={r.labs} />
      <ClinicalText label="Hx" value={r.hx} />
      <ClinicalText label="Treatment Plan / Rx" value={r.treatment_plan} />
    </div>
  );
}

export default function PatientProfilePage() {
  const { id = "" } = useParams();
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined);
  const [records, setRecords] = useState<MedicalRecordWithDoctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([getPatient(id), listPatientRecords(id)]);
      setPatient(p);
      setRecords(r);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this patient.");
      setPatient((prev) => prev ?? null);
      setRecords((prev) => prev ?? []);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Link to="/patients" className="text-secondary hover:underline text-sm flex items-center gap-1 self-start">
      <Icon name="arrow_back" className="text-sm" />
      Patients
    </Link>
  );

  if (patient === undefined) {
    return <p className="text-on-surface-variant text-sm">Loading…</p>;
  }
  if (patient === null) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="text-on-surface-variant text-sm">{error ?? "Patient not found."}</p>
      </div>
    );
  }

  const age = patient.date_of_birth ? ageOn(patient.date_of_birth, todayLocal()) : null;
  const sexLabel = SEX_OPTIONS.find((o) => o.value === patient.sex)?.label ?? patient.sex;
  const facts = [
    sexLabel,
    age !== null ? `${age} yrs` : null,
    patient.date_of_birth ? `DOB ${formatDate(patient.date_of_birth)}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {back}

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-md text-headline-md text-primary">{patient.full_name}</h1>
          {facts.length > 0 && <p className="text-sm text-on-surface-variant">{facts.join(" · ")}</p>}
          <p className="text-sm text-on-surface-variant flex items-center gap-4">
            {patient.phone && (
              <span className="flex items-center gap-1">
                <Icon name="call" className="text-base" />
                {patient.phone}
              </span>
            )}
            {patient.email && (
              <span className="flex items-center gap-1">
                <Icon name="mail" className="text-base" />
                {patient.email}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            disabled={exporting || records === null}
            onClick={async () => {
              setExporting(true);
              try {
                await exportPatientHistoryPdf(patient, records ?? []);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't create the PDF.");
              } finally {
                setExporting(false);
              }
            }}
            className="border border-secondary text-secondary font-label-caps text-label-caps px-5 py-2.5 rounded-full flex items-center gap-1.5 hover:bg-secondary/10 transition-colors disabled:opacity-50"
          >
            <Icon name="picture_as_pdf" className="text-lg" />
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
          <button
            onClick={() => setAdding(true)}
            className="bg-secondary text-on-secondary font-label-caps text-label-caps px-5 py-2.5 rounded-full flex items-center gap-1.5 hover:bg-secondary/90 transition-colors"
          >
            <Icon name="add" className="text-lg" />
            Add Visit
          </button>
        </div>
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="flex flex-col gap-2">
        <h2 className="font-bold text-primary">
          Visit history{records ? ` (${records.length})` : ""}
          <span className="font-normal text-sm text-on-surface-variant"> · newest first</span>
        </h2>
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant divide-y divide-outline-variant/40">
          {records === null && <p className="p-6 text-on-surface-variant text-sm">Loading…</p>}
          {records?.length === 0 && (
            <p className="p-6 text-on-surface-variant text-sm">No visits recorded yet.</p>
          )}
          {records?.map((record) => <RecordCard key={record.id} record={record} />)}
        </div>
      </div>

      <AddRecordModal
        open={adding}
        initialPatient={patient}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          void load();
        }}
      />
    </div>
  );
}
