import { ParticleText } from "@/component/particle-text";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans">
      <div className="aspect-[4/5] w-[min(90vw,480px)] overflow-hidden">
        <ParticleText className="h-full w-full" />
      </div>
    </div>
  );
}
