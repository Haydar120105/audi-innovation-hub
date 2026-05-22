import PlantScene from "../components/PlantScene";
import Benefits from "../components/Benefits";
import FocusAreas from "../components/FocusAreas";

export default function Home() {
  return (
    <div className="w-full min-h-screen bg-[#0A0A14] text-white overflow-y-auto">
      <div className="w-full" style={{ height: "100svh" }}>
        <PlantScene />
      </div>
      <Benefits />
      <FocusAreas />
    </div>
  );
}
