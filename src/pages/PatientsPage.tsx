import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AddRecordModal from "../components/AddRecordModal";
import Icon from "../components/Icon";
import PatientPicker from "../components/PatientPicker";

export default function PatientsPage() {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-headline-md text-headline-md text-primary">Patients</h1>
        <button
          onClick={() => setAdding(true)}
          className="bg-secondary text-on-secondary font-label-caps text-label-caps px-5 py-2.5 rounded-full flex items-center gap-1.5 hover:bg-secondary/90 transition-colors"
        >
          <Icon name="add" className="text-lg" />
          Add Record
        </button>
      </div>

      <PatientPicker onSelect={(p) => navigate(`/patients/${p.id}`)} listClassName="shadow-sm" />

      <AddRecordModal
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(patientId) => {
          setAdding(false);
          navigate(`/patients/${patientId}`);
        }}
      />
    </div>
  );
}
