import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DoctorForm from "../components/DoctorForm";
import Icon from "../components/Icon";
import { getDoctor, updateDoctor } from "../lib/doctors";
import type { Doctor } from "../lib/types";

export default function DoctorEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getDoctor(id)
      .then((found) => {
        if (cancelled) return;
        setDoctor(found);
        setStatus(found ? "ready" : "missing");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't load this doctor.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        to="/doctors"
        className="text-secondary hover:underline text-sm flex items-center gap-1"
      >
        <Icon name="arrow_back" className="text-sm" />
        Doctors
      </Link>

      {status === "loading" && <p className="text-on-surface-variant text-sm">Loading…</p>}
      {status === "missing" && (
        <p className="text-on-surface-variant">That doctor doesn't exist (or was deleted).</p>
      )}
      {status === "error" && <p className="text-error text-sm">{error}</p>}

      {status === "ready" && doctor && (
        <>
          <h1 className="font-headline-md text-headline-md text-primary">
            Edit {doctor.name}
          </h1>
          <DoctorForm
            doctor={doctor}
            submitLabel="Save Changes"
            onSubmit={async (values) => {
              await updateDoctor(doctor.id, values);
              navigate("/doctors");
            }}
          />
        </>
      )}
    </div>
  );
}
