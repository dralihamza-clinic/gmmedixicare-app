import { formatDate } from "./patients";
import { SEX_OPTIONS, type MedicalRecordWithDoctor, type Patient } from "./types";

// "Ali Hamza (Jr.)" -> "ali-hamza-jr-history.pdf"
export function historyFileName(patientName: string): string {
  const slug = patientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "patient"}-history.pdf`;
}

function show(value: unknown, unit = ""): string {
  return value === null || value === undefined || value === "" ? "-" : `${value}${unit}`;
}

// Builds and downloads an A4 PDF of the patient's full visit history, oldest
// visit first. jsPDF is loaded on demand so it isn't in the startup bundle.
// Note: jsPDF's built-in fonts cover Latin text only; names or notes in
// other scripts (e.g. Urdu) won't render correctly.
export async function exportPatientHistoryPdf(
  patient: Patient,
  records: MedicalRecordWithDoctor[]
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const bottom = pageHeight - margin - 8; // leave room for the footer
  let y = margin;

  const ensureSpace = (height: number) => {
    if (y + height > bottom) {
      doc.addPage();
      y = margin;
    }
  };

  const write = (
    text: string,
    options: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}
  ) => {
    const size = options.size ?? 10;
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(options.color ?? [26, 28, 26]));
    const lineHeight = size * 0.45;
    for (const line of doc.splitTextToSize(text, contentWidth) as string[]) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y + lineHeight * 0.8);
      y += lineHeight;
    }
    y += options.gap ?? 1.5;
  };

  const rule = () => {
    ensureSpace(4);
    doc.setDrawColor(198, 198, 204);
    doc.line(margin, y + 1, pageWidth - margin, y + 1);
    y += 4;
  };

  // Header
  write("GMMedixicare - Patient Visit History", { size: 9, color: [28, 105, 104], bold: true, gap: 2 });
  write(patient.full_name, { size: 18, bold: true, gap: 2 });

  const sex = SEX_OPTIONS.find((o) => o.value === patient.sex)?.label ?? patient.sex;
  const details = [
    patient.mri_id ? `MRI ID: ${patient.mri_id}` : null,
    `Phone: ${patient.phone || "-"}`,
    `Sex: ${sex || "-"}`,
    patient.date_of_birth ? `Date of birth: ${formatDate(patient.date_of_birth)}` : null,
  ].filter(Boolean);
  write(details.join("     "), { size: 10, color: [69, 71, 76] });
  write(
    `${records.length} visit${records.length === 1 ? "" : "s"} · Generated ${new Date().toLocaleString()}`,
    { size: 8, color: [118, 119, 124], gap: 3 }
  );
  rule();

  // Visits, oldest first.
  const ordered = [...records].sort((a, b) =>
    a.visit_date === b.visit_date
      ? a.created_at.localeCompare(b.created_at)
      : a.visit_date.localeCompare(b.visit_date)
  );

  if (ordered.length === 0) write("No visits recorded.", { color: [69, 71, 76] });

  ordered.forEach((r, index) => {
    ensureSpace(30); // keep a visit's heading with at least its vitals
    write(`Visit ${index + 1}  ·  ${formatDate(r.visit_date)}  ·  ${r.doctor?.name ?? "Unknown doctor"}`, {
      size: 12,
      bold: true,
      gap: 2,
    });
    write(
      [
        `Age: ${show(r.age)}`,
        `Temp: ${show(r.temperature, " °F")}`,
        `B.P.: ${show(r.blood_pressure)}`,
        `Pulse: ${show(r.pulse, " bpm")}`,
        `Weight: ${show(r.weight, " kg")}`,
      ].join("     "),
      { size: 10, gap: 2.5 }
    );

    for (const [label, value] of [
      ["Labs", r.labs],
      ["Hx", r.hx],
      ["Treatment Plan / Rx", r.treatment_plan],
    ] as const) {
      write(label, { size: 9, bold: true, color: [28, 105, 104], gap: 0.5 });
      write(value?.trim() || "-", { size: 10, gap: 2.5 });
    }
    rule();
  });

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(118, 119, 124);
    doc.text(`${patient.full_name} - visit history`, margin, pageHeight - margin + 2);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - margin + 2, { align: "right" });
  }

  doc.save(historyFileName(patient.full_name));
}
