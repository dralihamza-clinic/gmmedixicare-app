import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DoctorForm from "../components/DoctorForm";
import Icon from "../components/Icon";
import WorkingHoursSection, { NEW_DOCTOR_SCHEDULE } from "../components/WorkingHoursSection";
import { createDoctor, deleteDoctor } from "../lib/doctors";
import { replaceDoctorSchedule, validateSchedule, type ScheduleRow } from "../lib/schedules";

export default function DoctorNewPage() {
  const navigate = useNavigate();
  const [hours, setHours] = useState<ScheduleRow[]>(NEW_DOCTOR_SCHEDULE);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        to="/doctors"
        className="text-secondary hover:underline text-sm flex items-center gap-1"
      >
        <Icon name="arrow_back" className="text-sm" />
        Doctors
      </Link>
      <h1 className="font-headline-md text-headline-md text-primary">Add Doctor</h1>

      <DoctorForm
        submitLabel="Add Doctor"
        onSubmit={async (values) => {
          // The doctor and its hours are saved as one action. Hours need the
          // new doctor's id, so they go second; if they fail, the doctor is
          // deleted again rather than left without the hours staff chose.
          validateSchedule(hours);
          const doctorId = await createDoctor(values);
          try {
            await replaceDoctorSchedule(doctorId, hours, []);
          } catch (err) {
            await deleteDoctor(doctorId).catch((rollbackErr: unknown) =>
              console.error(`Rollback of doctors ${doctorId} failed:`, rollbackErr)
            );
            throw new Error(
              `The doctor wasn't added because the working hours couldn't be saved: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
          navigate("/doctors");
        }}
      >
        <WorkingHoursSection onDraftChange={setHours} />
      </DoctorForm>
    </div>
  );
}
