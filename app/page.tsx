import ShaderShowcase from "@/components/ui/hero";
import { VideoBackground } from "@/components/ui/video-background";

export default function DemoOne() {
  return (
    <div className="min-h-screen h-full w-full relative">
      <VideoBackground />
      <div className="relative z-10">
        <ShaderShowcase />
        <footer className="border-t border-white/10 py-5 text-center text-sm text-white/30">
          Built by{" "}
          <a
            href="https://github.com/Soham-commits"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-white/60 transition-colors duration-200 hover:text-white"
          >
            Soham Nigam
          </a>{" "}
          · Ignisia 2026 · MIT-WPU
        </footer>
      </div>
    </div>
  );
}
