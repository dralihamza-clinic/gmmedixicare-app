import { Link, useNavigate } from "react-router-dom";
import DoctorForm from "../components/DoctorForm";
import Icon from "../components/Icon";
import { createDoctor } from "../lib/doctors";

export default function DoctorNewPage() {
  const navigate = useNavigate();

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
          await createDoctor(values);
          navigate("/doctors");
        }}
      />
    </div>
  );
}
