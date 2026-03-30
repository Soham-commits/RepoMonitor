import ShaderShowcase from "@/components/ui/hero";
import { VideoBackground } from "@/components/ui/video-background";

export default function DemoOne() {
  return (
    <div className="min-h-screen h-full w-full relative">
      <VideoBackground />
      <div className="relative z-10">
        <ShaderShowcase />
      </div>
    </div>
  );
}
