"use client";

export type ExportChoice =
  | "skp"
  | "dae"
  | "kmz"
  | "obj"
  | "dxf"
  | "dwg"
  | "json";

const OPTIONS: {
  id: ExportChoice;
  title: string;
  file: string;
  opens: string;
}[] = [
  {
    id: "skp",
    title: "SketchUp (.skp)",
    file: "Cadence-House-SketchUp.zip",
    opens: "Unzip, then File → Import the .dae in SketchUp and Save As .skp. Or run Save-as-SKP.rb to write the .skp for you.",
  },
  {
    id: "dae",
    title: "SketchUp 3D (.dae)",
    file: "Cadence-House.dae",
    opens: "Opens now in SketchUp: File → Import. Units = metres.",
  },
  {
    id: "kmz",
    title: "SketchUp / Google Earth (.kmz)",
    file: "Cadence-House.kmz",
    opens: "Double-click or File → Import in SketchUp.",
  },
  {
    id: "obj",
    title: "3D object (.obj)",
    file: "Cadence-House-OBJ.zip",
    opens: "SketchUp, Blender, Rhino, 3ds Max, Cinema 4D.",
  },
  {
    id: "dxf",
    title: "AutoCAD / ZWCAD (.dxf)",
    file: "cadence-plan.dxf",
    opens: "Open directly in AutoCAD, ZWCAD, DraftSight, BricsCAD.",
  },
  {
    id: "dwg",
    title: "CAD pack (DXF → DWG)",
    file: "Cadence-Plan-CAD.zip",
    opens: "Open the DXF, then Save As DWG in AutoCAD or ZWCAD.",
  },
  {
    id: "json",
    title: "Cadence copy (.json)",
    file: "cadence-design.json",
    opens: "Keep a backup or send to another Cadence session.",
  },
];

export default function ExportPicker({
  open,
  exporting,
  onClose,
  onPick,
}: {
  open: boolean;
  exporting?: boolean;
  onClose: () => void;
  onPick: (choice: ExportChoice) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 md:items-center">
      <div className="glass w-full max-w-lg rounded-[28px] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl text-white">Choose a file type</p>
            <p className="mt-1 font-sans text-sm text-titanium">
              Pick the app you will open next. The 3D house is the same — only the file format changes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-1 font-sans text-sm"
          >
            Close
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                disabled={exporting}
                onClick={() => onPick(option.id)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:border-champagne/40 disabled:opacity-50"
              >
                <p className="font-sans text-sm text-white">{option.title}</p>
                <p className="mt-0.5 font-sans text-xs text-titanium">{option.opens}</p>
                <p className="mt-1 font-mono text-[10px] text-cobalt">{option.file}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
